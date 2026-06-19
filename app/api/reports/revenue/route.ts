import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { subDays, eachDayOfInterval } from "date-fns";

function getISTStartOfDay(date: Date) {
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

  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
}

function formatInIST(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === "year")!.value;
  const month = parts.find(p => p.type === "month")!.value;
  const day = parts.find(p => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const days = parseInt(searchParams.get("days") ?? "30");

  const now = new Date();
  const todayStartIST = getISTStartOfDay(now);
  const since = subDays(todayStartIST, days - 1);

  // Daily revenue bookings
  const bookings = await prisma.booking.findMany({
    where: {
      startDateTime: { gte: since },
      bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
    },
    select: { startDateTime: true, finalAmount: true, negotiatedAmount: true, paymentStatus: true, gameId: true, userId: true },
  });

  // Daily standalone snacks
  const standaloneSnacks = await prisma.snackOrder.findMany({
    where: {
      createdAt: { gte: since },
    },
    select: { createdAt: true, amount: true }
  });

  // Group by day using IST formatting
  const dayMap: Record<string, { game: number; snacks: number }> = {};
  const interval = eachDayOfInterval({ start: since, end: now });
  for (const day of interval) {
    dayMap[formatInIST(day)] = { game: 0, snacks: 0 };
  }
  
  for (const b of bookings) {
    const key = formatInIST(b.startDateTime);
    if (key in dayMap) {
      if (b.paymentStatus === "PAID") {
        dayMap[key].game += Number(b.negotiatedAmount ?? b.finalAmount);
      }
    }
  }

  for (const s of standaloneSnacks) {
    const key = formatInIST(s.createdAt);
    if (key in dayMap) {
      dayMap[key].snacks += Number(s.amount);
    }
  }

  const daily = Object.entries(dayMap).map(([date, data]) => ({ 
    date, 
    revenue: data.game + data.snacks,
    gameRevenue: data.game,
    snacksRevenue: data.snacks
  }));
  const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);

  // Revenue by game
  const games = await prisma.game.findMany({ select: { id: true, name: true, tag: true } });
  const revenueByGame = games.map((g) => {
    const gameBookings = bookings.filter((b) => b.gameId === g.id);
    const revenue = gameBookings.reduce((sum, b) => {
      if (b.paymentStatus !== "PAID") return sum;
      return sum + Number(b.negotiatedAmount ?? b.finalAmount);
    }, 0);
    return {
      game: g.name,
      tag: g.tag,
      revenue,
    };
  }).filter((g) => g.revenue > 0).sort((a, b) => b.revenue - a.revenue);

  // Guest vs registered
  const guestCount = bookings.filter((b) => !b.userId).length;
  const registeredCount = bookings.length - guestCount;

  return NextResponse.json({ daily, totalRevenue, revenueByGame, guestCount, registeredCount });
}
