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
    totalBookings, todayBookings, activeNow, holdCount,
    weeklyBookingRev, monthlyBookingRev, weeklySnacksRev, monthlySnacksRev
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



    // Active holds
    prisma.booking.count({
      where: { bookingStatus: BookingStatus.HOLD, holdExpiresAt: { gt: now } },
    }),

    // Weekly Booking Revenue
    prisma.$queryRaw`
      SELECT COALESCE(SUM(pa.amount), 0) as total
      FROM payment_allocations pa
      JOIN bookings b ON pa."bookingId" = b.id
      WHERE b."startDateTime" >= ${weekBounds.start} AND b."startDateTime" <= ${weekBounds.end}
      AND b."bookingStatus" IN ('CONFIRMED', 'COMPLETED')
    `.then((res: any) => Number(res[0]?.total || 0)),

    // Monthly Booking Revenue
    prisma.$queryRaw`
      SELECT COALESCE(SUM(pa.amount), 0) as total
      FROM payment_allocations pa
      JOIN bookings b ON pa."bookingId" = b.id
      WHERE b."startDateTime" >= ${monthBounds.start} AND b."startDateTime" <= ${monthBounds.end}
      AND b."bookingStatus" IN ('CONFIRMED', 'COMPLETED')
    `.then((res: any) => Number(res[0]?.total || 0)),

    // Weekly Snacks Revenue
    prisma.$queryRaw`
      SELECT COALESCE(SUM(pa.amount), 0) as total
      FROM payment_allocations pa
      JOIN snack_orders s ON pa."snackOrderId" = s.id
      WHERE s."createdAt" >= ${weekBounds.start} AND s."createdAt" <= ${weekBounds.end}
    `.then((res: any) => Number(res[0]?.total || 0)),

    // Monthly Snacks Revenue
    prisma.$queryRaw`
      SELECT COALESCE(SUM(pa.amount), 0) as total
      FROM payment_allocations pa
      JOIN snack_orders s ON pa."snackOrderId" = s.id
      WHERE s."createdAt" >= ${monthBounds.start} AND s."createdAt" <= ${monthBounds.end}
    `.then((res: any) => Number(res[0]?.total || 0)),
  ]);

  const weeklyRevenue = weeklyBookingRev + weeklySnacksRev;
  const monthlyRevenue = monthlyBookingRev + monthlySnacksRev;

  return NextResponse.json({
    totalBookings,
    todayBookings,
    activeNow,
    weeklyRevenue,
    monthlyRevenue,
    holdCount,
  });
}
