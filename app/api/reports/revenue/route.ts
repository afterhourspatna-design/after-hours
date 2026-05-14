import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { startOfDay, subDays, eachDayOfInterval, format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const days = parseInt(searchParams.get("days") ?? "30");

  const since = startOfDay(subDays(new Date(), days - 1));

  // Daily revenue
  const bookings = await prisma.booking.findMany({
    where: {
      startDateTime: { gte: since },
      bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
    },
    select: { startDateTime: true, finalAmount: true, gameId: true, userId: true },
  });

  // Group by day
  const dayMap: Record<string, number> = {};
  const interval = eachDayOfInterval({ start: since, end: new Date() });
  for (const day of interval) dayMap[format(day, "yyyy-MM-dd")] = 0;
  for (const b of bookings) {
    const key = format(b.startDateTime, "yyyy-MM-dd");
    if (key in dayMap) dayMap[key] += Number(b.finalAmount);
  }

  const daily = Object.entries(dayMap).map(([date, revenue]) => ({ date, revenue }));
  const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);

  // Revenue by game
  const games = await prisma.game.findMany({ select: { id: true, name: true, tag: true } });
  const revenueByGame = games.map((g) => ({
    game: g.name,
    tag: g.tag,
    revenue: bookings.filter((b) => b.gameId === g.id).reduce((s, b) => s + Number(b.finalAmount), 0),
  })).filter((g) => g.revenue > 0).sort((a, b) => b.revenue - a.revenue);

  // Guest vs registered
  const guestCount = bookings.filter((b) => !b.userId).length;
  const registeredCount = bookings.length - guestCount;

  return NextResponse.json({ daily, totalRevenue, revenueByGame, guestCount, registeredCount });
}
