import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { BookingStatus } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [
    totalBookings, todayBookings, activeNow, weeklyRevenue, monthlyRevenue, holdCount,
  ] = await Promise.all([
    // Total all-time
    prisma.booking.count(),

    // Today
    prisma.booking.count({
      where: { startDateTime: { gte: todayStart, lte: todayEnd } },
    }),

    // Active right now
    prisma.booking.count({
      where: {
        bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.HOLD] },
        startDateTime: { lte: now },
        endDateTime: { gte: now },
      },
    }),

    // Weekly revenue (CONFIRMED + COMPLETED)
    prisma.booking.aggregate({
      where: {
        startDateTime: { gte: weekStart, lte: weekEnd },
        bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      },
      _sum: { finalAmount: true },
    }),

    // Monthly revenue
    prisma.booking.aggregate({
      where: {
        startDateTime: { gte: monthStart, lte: monthEnd },
        bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      },
      _sum: { finalAmount: true },
    }),

    // Active holds
    prisma.booking.count({
      where: { bookingStatus: BookingStatus.HOLD, holdExpiresAt: { gt: now } },
    }),
  ]);

  return NextResponse.json({
    totalBookings,
    todayBookings,
    activeNow,
    weeklyRevenue: Number(weeklyRevenue._sum.finalAmount ?? 0),
    monthlyRevenue: Number(monthlyRevenue._sum.finalAmount ?? 0),
    holdCount,
  });
}
