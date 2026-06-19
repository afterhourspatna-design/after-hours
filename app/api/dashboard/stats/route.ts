import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";

function getISTStartAndEnd(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === "year")!.value, 10);
  const month = parseInt(parts.find(p => p.type === "month")!.value, 10) - 1;
  const day = parseInt(parts.find(p => p.type === "day")!.value, 10);

  const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
  const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
  return { start, end };
}

function getISTWeekBounds(date: Date) {
  const istTime = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
  const dayOfWeek = istTime.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const mondayVal = new Date(istTime);
  mondayVal.setUTCDate(istTime.getUTCDate() - daysToMonday);

  const sundayVal = new Date(mondayVal);
  sundayVal.setUTCDate(mondayVal.getUTCDate() + 6);

  const start = new Date(Date.UTC(mondayVal.getUTCFullYear(), mondayVal.getUTCMonth(), mondayVal.getUTCDate(), 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
  const end = new Date(Date.UTC(sundayVal.getUTCFullYear(), sundayVal.getUTCMonth(), sundayVal.getUTCDate(), 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
  return { start, end };
}

function getISTMonthBounds(date: Date) {
  const istTime = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
  const year = istTime.getUTCFullYear();
  const month = istTime.getUTCMonth();

  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
  
  const nextMonthFirst = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  const lastDay = new Date(nextMonthFirst.getTime() - 1);
  const end = new Date(lastDay.getTime() - (5.5 * 60 * 60 * 1000));

  return { start, end };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const todayBounds = getISTStartAndEnd(now);
  const weekBounds = getISTWeekBounds(now);
  const monthBounds = getISTMonthBounds(now);

  const [
    totalBookings, todayBookings, activeNow, weeklyBookings, monthlyBookings, holdCount, weeklyBookings_snacks, monthlyBookings_snacks
  ] = await Promise.all([
    // Total all-time
    prisma.booking.count(),

    // Today
    prisma.booking.count({
      where: { startDateTime: { gte: todayBounds.start, lte: todayBounds.end } },
    }),

    // Active right now
    prisma.booking.count({
      where: {
        bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.HOLD] },
        startDateTime: { lte: now },
        endDateTime: { gte: now },
      },
    }),

    // Weekly bookings (CONFIRMED + COMPLETED)
    prisma.booking.findMany({
      where: {
        startDateTime: { gte: weekBounds.start, lte: weekBounds.end },
        bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      },
      select: { finalAmount: true, negotiatedAmount: true, paymentStatus: true },
    }),

    // Monthly bookings (CONFIRMED + COMPLETED)
    prisma.booking.findMany({
      where: {
        startDateTime: { gte: monthBounds.start, lte: monthBounds.end },
        bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      },
      select: { finalAmount: true, negotiatedAmount: true, paymentStatus: true },
    }),

    // Active holds
    prisma.booking.count({
      where: { bookingStatus: BookingStatus.HOLD, holdExpiresAt: { gt: now } },
    }),

    // Weekly standalone snacks
    prisma.snackOrder.findMany({
      where: {
        createdAt: { gte: weekBounds.start, lte: weekBounds.end },
      },
      select: { amount: true }
    }),

    // Monthly standalone snacks
    prisma.snackOrder.findMany({
      where: {
        createdAt: { gte: monthBounds.start, lte: monthBounds.end },
      },
      select: { amount: true }
    }),
  ]);

  const weeklyBookingRevenue = weeklyBookings.reduce((sum, b) => {
    if (b.paymentStatus !== "PAID") return sum;
    return sum + Number(b.negotiatedAmount ?? b.finalAmount);
  }, 0);
  const weeklySnacksRevenue = weeklyBookings_snacks.reduce((sum, p) => sum + Number(p.amount), 0);
  const weeklyRevenue = weeklyBookingRevenue + weeklySnacksRevenue;

  const monthlyBookingRevenue = monthlyBookings.reduce((sum, b) => {
    if (b.paymentStatus !== "PAID") return sum;
    return sum + Number(b.negotiatedAmount ?? b.finalAmount);
  }, 0);
  const monthlySnacksRevenue = monthlyBookings_snacks.reduce((sum, p) => sum + Number(p.amount), 0);
  const monthlyRevenue = monthlyBookingRevenue + monthlySnacksRevenue;

  return NextResponse.json({
    totalBookings,
    todayBookings,
    activeNow,
    weeklyRevenue,
    monthlyRevenue,
    holdCount,
  });
}
