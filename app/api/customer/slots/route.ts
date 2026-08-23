import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addMinutes } from "date-fns";

// IST offset in ms
const IST = 5.5 * 60 * 60 * 1000;

function toISTMidnight(dateStr: string): Date {
  // dateStr = "YYYY-MM-DD" — treat as IST midnight
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - IST);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const gameId = searchParams.get("gameId");
  const dateStr = searchParams.get("date"); // YYYY-MM-DD

  if (!gameId || !dateStr) {
    return NextResponse.json({ error: "gameId and date are required" }, { status: 400 });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { resourceUnits: { where: { isActive: true } } },
  });

  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const totalUnits = game.resourceUnits.length;
  const stepMinutes = game.minTimeMinutes; // slot increment = min booking time

  // Window: 12:00 noon to 23:00 (11 PM) IST
  const dayStart = toISTMidnight(dateStr);
  const windowStart = new Date(dayStart.getTime() + 12 * 60 * 60 * 1000); // 12:00 noon IST
  const windowEnd   = new Date(dayStart.getTime() + 23 * 60 * 60 * 1000); // 11:00 PM IST

  // Fetch all existing bookings for this game on this day that overlap the window
  const existingBookings = await prisma.booking.findMany({
    where: {
      gameId,
      bookingStatus: { notIn: ["CANCELLED", "EXPIRED"] },
      OR: [
        { startDateTime: { gte: windowStart, lt: windowEnd } },
        { endDateTime:   { gt: windowStart, lte: windowEnd } },
        { startDateTime: { lte: windowStart }, endDateTime: { gte: windowEnd } },
      ],
    },
    select: {
      startDateTime: true,
      endDateTime: true,
      resourceUnitId: true,
    },
  });

  // Build slots: each slot = { startTime, endTime (one step), available, unitsAvailable }
  const slots: { time: string; startISO: string; available: boolean }[] = [];

  let cursor = windowStart;
  while (cursor < windowEnd) {
    const slotStart = cursor;
    const slotEnd = addMinutes(slotStart, stepMinutes);
    if (slotEnd > windowEnd) break;

    // Count how many units are occupied during this slot
    const occupiedUnitIds = new Set<string>();
    for (const bk of existingBookings) {
      const bkStart = new Date(bk.startDateTime);
      const bkEnd   = new Date(bk.endDateTime);
      // Overlap check
      if (bkStart < slotEnd && bkEnd > slotStart) {
        if (bk.resourceUnitId) occupiedUnitIds.add(bk.resourceUnitId);
      }
    }

    const unitsAvailable = totalUnits - occupiedUnitIds.size;

    // Format time in IST for display
    const timeLabel = slotStart.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    slots.push({
      time: timeLabel,
      startISO: slotStart.toISOString(),
      available: unitsAvailable > 0,
    });

    cursor = slotEnd;
  }

  return NextResponse.json({ slots, stepMinutes, gameTag: game.tag });
}
