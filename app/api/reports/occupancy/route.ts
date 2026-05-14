import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { startOfDay, subDays, differenceInMinutes } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const days = parseInt(searchParams.get("days") ?? "30");

  const since = startOfDay(subDays(new Date(), days - 1));
  // Operating hours: 10:00–24:00 = 14 hours/day per unit
  const OPERATING_MINUTES_PER_DAY = 14 * 60;
  const totalMinutesAvailable = OPERATING_MINUTES_PER_DAY * days;

  const games = await prisma.game.findMany({
    include: {
      resourceUnits: { where: { isActive: true }, select: { id: true, unitName: true } },
    },
  });

  const results = await Promise.all(
    games.map(async (game) => {
      const unitCount = game.resourceUnits.length;
      if (unitCount === 0) return null;

      const bookings = await prisma.booking.findMany({
        where: {
          gameId: game.id,
          startDateTime: { gte: since },
          bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        },
        select: { durationMinutes: true, startDateTime: true, endDateTime: true },
      });

      const bookedMinutes = bookings.reduce((sum, b) => sum + b.durationMinutes, 0);
      const totalAvailableMinutes = totalMinutesAvailable * unitCount;
      const occupancyPct = totalAvailableMinutes > 0
        ? Math.round((bookedMinutes / totalAvailableMinutes) * 100)
        : 0;

      return {
        gameId: game.id,
        game: game.name,
        tag: game.tag,
        units: unitCount,
        bookingCount: bookings.length,
        bookedMinutes,
        occupancyPct: Math.min(occupancyPct, 100),
      };
    })
  );

  const occupancy = results.filter(Boolean).sort((a, b) => (b?.occupancyPct ?? 0) - (a?.occupancyPct ?? 0));
  return NextResponse.json({ occupancy, days });
}
