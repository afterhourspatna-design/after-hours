import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { addMinutes } from "date-fns";

/**
 * Checks if a resource unit is available for the given time slot.
 * Returns true if available, false if conflicting.
 */
export async function checkAvailability(params: {
  resourceUnitId: string;
  startDateTime: Date;
  endDateTime: Date;
  excludeBookingId?: string;
}): Promise<{ available: boolean; conflictingBooking?: any }> {
  const { resourceUnitId, startDateTime, endDateTime, excludeBookingId } = params;

  const conflict = await prisma.booking.findFirst({
    where: {
      resourceUnitId,
      bookingStatus: {
        notIn: [BookingStatus.CANCELLED, BookingStatus.EXPIRED],
      },
      AND: [
        { startDateTime: { lt: endDateTime } },
        { endDateTime: { gt: startDateTime } },
      ],
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    include: {
      user: { select: { name: true, phone: true } },
      game: { select: { name: true } },
    },
  });

  return {
    available: !conflict,
    conflictingBooking: conflict ?? undefined,
  };
}

/**
 * Auto-assigns a free resource unit for the given game + time slot.
 */
export async function suggestAvailableUnit(params: {
  gameId: string;
  startDateTime: Date;
  endDateTime: Date;
}): Promise<string | null> {
  const { gameId, startDateTime, endDateTime } = params;

  const units = await prisma.resourceUnit.findMany({
    where: { gameId, isActive: true },
    select: { id: true, unitName: true },
  });

  for (const unit of units) {
    const { available } = await checkAvailability({
      resourceUnitId: unit.id,
      startDateTime,
      endDateTime,
    });
    if (available) return unit.id;
  }

  return null;
}

/**
 * Expires HOLD bookings whose holdExpiresAt has passed.
 * Returns count of expired bookings.
 */
export async function expireStaleHolds(): Promise<number> {
  const result = await prisma.booking.updateMany({
    where: {
      bookingStatus: BookingStatus.HOLD,
      holdExpiresAt: { lt: new Date() },
    },
    data: {
      bookingStatus: BookingStatus.EXPIRED,
    },
  });
  return result.count;
}
