import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { startOfDay, endOfDay } from "date-fns";

export interface PriceCalculation {
  basePrice: number;           // unit price × hours (no discount)
  discountPct: number;         // effective discount percentage applied
  discountAmount: number;      // rupees saved
  finalAmount: number;         // amount to charge
  breakdown: HourBlock[];      // per-block breakdown
}

export interface HourBlock {
  blockNumber: number;         // 1, 2, 3, ...
  durationMinutes: number;
  ratePerHour: number;
  discountPct: number;
  amount: number;
}

/**
 * Calculates price for a new booking, applying same-day per-user discounts:
 *   Hour 1        → full price
 *   Hour 2        → 5% discount
 *   Hour 3+       → 15% discount
 *
 * Guest bookings (userId = null) never get discounts.
 */
export async function calculateBookingPrice(params: {
  gameId: string;
  durationMinutes: number;
  startDateTime: Date;
  userId?: string | null;
  excludeBookingId?: string;  // for edits — exclude the current booking
}): Promise<PriceCalculation> {
  const { gameId, durationMinutes, startDateTime, userId, excludeBookingId } = params;

  const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
  const baseRatePerHour = Number(game.basePrice);

  // Fetch same-day existing hours for this user
  let existingMinutesOnDay = 0;
  if (userId) {
    const dayStart = startOfDay(startDateTime);
    const dayEnd = endOfDay(startDateTime);

    const existing = await prisma.booking.findMany({
      where: {
        userId,
        bookingStatus: { in: ["HOLD", "PENDING", "CONFIRMED"] },
        startDateTime: { gte: dayStart, lte: dayEnd },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { durationMinutes: true },
    });

    existingMinutesOnDay = existing.reduce((sum, b) => sum + b.durationMinutes, 0);
  }

  // Build per-30-min blocks (minimum slot unit)
  const blocks: HourBlock[] = [];
  let remainingMinutes = durationMinutes;
  let accumulatedMinutes = existingMinutesOnDay;
  let blockNumber = 1;

  while (remainingMinutes > 0) {
    const blockMinutes = Math.min(remainingMinutes, 60);
    const cumulativeHours = (accumulatedMinutes + blockMinutes) / 60;

    let discountPct = 0;
    if (userId) {
      if (cumulativeHours > 2) discountPct = 15;
      else if (cumulativeHours > 1) discountPct = 5;
    }

    const proRatedRate = (blockMinutes / 60) * baseRatePerHour;
    const discountedAmount = proRatedRate * (1 - discountPct / 100);

    blocks.push({
      blockNumber,
      durationMinutes: blockMinutes,
      ratePerHour: baseRatePerHour,
      discountPct,
      amount: Math.round(discountedAmount),
    });

    accumulatedMinutes += blockMinutes;
    remainingMinutes -= blockMinutes;
    blockNumber++;
  }

  const basePrice = Math.round((durationMinutes / 60) * baseRatePerHour);
  const finalAmount = blocks.reduce((sum, b) => sum + b.amount, 0);
  const discountAmount = basePrice - finalAmount;

  // Weighted average discount percentage
  const discountPct = basePrice > 0 ? Math.round((discountAmount / basePrice) * 100 * 10) / 10 : 0;

  return { basePrice, discountPct, discountAmount, finalAmount, breakdown: blocks };
}

/**
 * Quick sync version for display — uses pre-known existing hours
 */
export function calculatePriceSync(params: {
  baseRatePerHour: number;
  durationMinutes: number;
  existingMinutesOnDay: number;
  isGuest: boolean;
}): PriceCalculation {
  const { baseRatePerHour, durationMinutes, existingMinutesOnDay, isGuest } = params;

  const blocks: HourBlock[] = [];
  let remainingMinutes = durationMinutes;
  let accumulatedMinutes = existingMinutesOnDay;
  let blockNumber = 1;

  while (remainingMinutes > 0) {
    const blockMinutes = Math.min(remainingMinutes, 60);
    const cumulativeHours = (accumulatedMinutes + blockMinutes) / 60;

    let discountPct = 0;
    if (!isGuest) {
      if (cumulativeHours > 2) discountPct = 15;
      else if (cumulativeHours > 1) discountPct = 5;
    }

    const proRatedRate = (blockMinutes / 60) * baseRatePerHour;
    const amount = Math.round(proRatedRate * (1 - discountPct / 100));

    blocks.push({ blockNumber, durationMinutes: blockMinutes, ratePerHour: baseRatePerHour, discountPct, amount });

    accumulatedMinutes += blockMinutes;
    remainingMinutes -= blockMinutes;
    blockNumber++;
  }

  const basePrice = Math.round((durationMinutes / 60) * baseRatePerHour);
  const finalAmount = blocks.reduce((sum, b) => sum + b.amount, 0);
  const discountAmount = basePrice - finalAmount;
  const discountPct = basePrice > 0 ? Math.round((discountAmount / basePrice) * 100 * 10) / 10 : 0;

  return { basePrice, discountPct, discountAmount, finalAmount, breakdown: blocks };
}
