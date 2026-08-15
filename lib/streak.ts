import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { addDays } from "date-fns";

// ─────────────────────────────────────────
// STREAK CONSTANTS (spec-locked)
// ─────────────────────────────────────────
export const STREAK_THRESHOLD_PER_DAY = 120; // ₹ — a day qualifies when its game-booking total >= this
export const STREAK_TARGET_DAYS = 6; // qualifying days needed to issue the gift
export const STREAK_WINDOW_DAYS = 30; // challenge window length

export interface StreakDailyTotal {
  /** IST calendar date key, e.g. "2026-08-15" */
  date: string;
  /** summed finalAmount for that day (number) */
  total: number;
  /** whether this day meets the >= threshold rule */
  qualifies: boolean;
}

export interface StreakProgress {
  qualifyingDays: number;
  target: number;
  remaining: number;
  isEligible: boolean; // qualifyingDays >= target
  dailyTotals: StreakDailyTotal[];
}

/**
 * Get the IST (Asia/Kolkata) calendar-day key (YYYY-MM-DD) for a date.
 * Mirrors the timezone convention used in lib/pricing.ts.
 */
function getISTDateKey(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date); // en-CA => YYYY-MM-DD
  } catch {
    // Fallback: local date
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

/**
 * Computes streak progress for a user over a fixed window, entirely on the fly
 * from the Booking table (game bookings only — SnackOrder is a separate model).
 *
 * A day "qualifies" when the sum of that IST calendar day's game-booking
 * finalAmount for the user is >= STREAK_THRESHOLD_PER_DAY (>= so exactly ₹120 counts).
 * Only real sessions count: CANCELLED and EXPIRED bookings are excluded.
 */
export async function getStreakProgress(params: {
  userId: string;
  startDate: Date;
  endDate: Date;
}): Promise<StreakProgress> {
  const { userId, startDate, endDate } = params;

  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      startDateTime: {
        gte: startDate,
        lte: endDate,
      },
      bookingStatus: {
        notIn: [BookingStatus.CANCELLED, BookingStatus.EXPIRED],
      },
    },
    select: {
      startDateTime: true,
      finalAmount: true,
    },
  });

  // Bucket by IST calendar day
  const byDay = new Map<string, number>();
  for (const b of bookings) {
    const key = getISTDateKey(new Date(b.startDateTime));
    const amount = Number(b.finalAmount) || 0;
    byDay.set(key, (byDay.get(key) ?? 0) + amount);
  }

  const dailyTotals: StreakDailyTotal[] = Array.from(byDay.entries())
    .map(([date, total]) => ({
      date,
      total: Math.round(total * 100) / 100,
      qualifies: total >= STREAK_THRESHOLD_PER_DAY,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const qualifyingDays = dailyTotals.filter((d) => d.qualifies).length;

  return {
    qualifyingDays,
    target: STREAK_TARGET_DAYS,
    remaining: Math.max(0, STREAK_TARGET_DAYS - qualifyingDays),
    isEligible: qualifyingDays >= STREAK_TARGET_DAYS,
    dailyTotals,
  };
}

/**
 * If a challenge's window has passed and it is still ACTIVE (never issued),
 * flip it to EXPIRED. Returns the (possibly updated) status.
 */
export async function reconcileStreakStatus(challenge: {
  id: string;
  status: string;
  endDate: Date;
}): Promise<string> {
  if (challenge.status === "ACTIVE" && new Date(challenge.endDate) < new Date()) {
    await prisma.streakChallenge.update({
      where: { id: challenge.id },
      data: { status: "EXPIRED" },
    });
    return "EXPIRED";
  }
  return challenge.status;
}

/** Convenience: compute the window end date from a start date. */
export function computeEndDate(startDate: Date): Date {
  return addDays(startDate, STREAK_WINDOW_DAYS);
}
