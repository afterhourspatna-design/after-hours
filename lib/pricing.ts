import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { startOfDay, endOfDay } from "date-fns";

export interface PriceCalculation {
  basePrice: number;           // unit price × hours + accessory surcharge (no discount on accessories)
  discountPct: number;         // effective discount percentage applied
  discountAmount: number;      // rupees saved
  finalAmount: number;         // amount to charge
  breakdown: HourBlock[];      // per-block breakdown
  accessorySurcharge: number;  // accessory rental surcharge
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
  accessoriesCount?: number;
}): Promise<PriceCalculation> {
  const { gameId, durationMinutes, startDateTime, userId, excludeBookingId, accessoriesCount = 0 } = params;

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

  // Calculate accessory surcharge (flat surcharge, not subject to user discounts)
  let accessorySurcharge = 0;
  if (game.hasAccessories) {
    const extraAccessories = Math.max(0, accessoriesCount - game.defaultAccessories);
    const ratePerExtra = Number(game.accessoryPrice);
    accessorySurcharge = Math.round(ratePerExtra * extraAccessories * (durationMinutes / 60));
  }

  const gameBasePrice = Math.round((durationMinutes / 60) * baseRatePerHour);
  const gameFinalAmount = blocks.reduce((sum, b) => sum + b.amount, 0);
  const discountAmount = gameBasePrice - gameFinalAmount;

  // Weighted average discount percentage (on game pricing only)
  const discountPct = gameBasePrice > 0 ? Math.round((discountAmount / gameBasePrice) * 100 * 10) / 10 : 0;

  const basePrice = gameBasePrice + accessorySurcharge;
  const finalAmount = gameFinalAmount + accessorySurcharge;

  return { 
    basePrice, 
    discountPct, 
    discountAmount, 
    finalAmount, 
    breakdown: blocks,
    accessorySurcharge 
  };
}

/**
 * Quick sync version for display — uses pre-known existing hours
 */
export function calculatePriceSync(params: {
  baseRatePerHour: number;
  durationMinutes: number;
  existingMinutesOnDay: number;
  isGuest: boolean;
  hasAccessories?: boolean;
  defaultAccessories?: number;
  accessoryPrice?: number;
  accessoriesCount?: number;
}): PriceCalculation {
  const { 
    baseRatePerHour, 
    durationMinutes, 
    existingMinutesOnDay, 
    isGuest,
    hasAccessories = false,
    defaultAccessories = 0,
    accessoryPrice = 0,
    accessoriesCount = 0
  } = params;

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

  // Calculate accessory surcharge
  let accessorySurcharge = 0;
  if (hasAccessories) {
    const extraAccessories = Math.max(0, accessoriesCount - defaultAccessories);
    accessorySurcharge = Math.round(accessoryPrice * extraAccessories * (durationMinutes / 60));
  }

  const gameBasePrice = Math.round((durationMinutes / 60) * baseRatePerHour);
  const gameFinalAmount = blocks.reduce((sum, b) => sum + b.amount, 0);
  const discountAmount = gameBasePrice - gameFinalAmount;
  const discountPct = gameBasePrice > 0 ? Math.round((discountAmount / gameBasePrice) * 100 * 10) / 10 : 0;

  const basePrice = gameBasePrice + accessorySurcharge;
  const finalAmount = gameFinalAmount + accessorySurcharge;

  return { 
    basePrice, 
    discountPct, 
    discountAmount, 
    finalAmount, 
    breakdown: blocks,
    accessorySurcharge 
  };
}
