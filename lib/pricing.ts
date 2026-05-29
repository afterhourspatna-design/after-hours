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
  couponDiscount?: number;     // coupon discount applied
  couponCode?: string;         // coupon code applied
  couponError?: string;        // coupon validation error if any
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
  couponCode?: string;
  userRole?: string;
}): Promise<PriceCalculation> {
  const { 
    gameId, 
    durationMinutes, 
    startDateTime, 
    userId, 
    excludeBookingId, 
    accessoriesCount = 0,
    couponCode,
    userRole
  } = params;

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
  let finalAmount = gameFinalAmount + accessorySurcharge;

  // Coupon processing
  let couponDiscount = 0;
  let couponError: string | undefined = undefined;
  let finalCouponCode: string | undefined = undefined;

  if (couponCode) {
    const cleanedCode = couponCode.trim().toUpperCase();
    const coupon = await prisma.coupon.findUnique({
      where: { code: cleanedCode }
    });

    if (!coupon) {
      couponError = "Invalid coupon code";
    } else if (!coupon.isActive) {
      couponError = "This coupon code is inactive";
    } else if (userRole && !coupon.allowedRoles.includes(userRole as any)) {
      couponError = "This coupon is not valid for your account role";
    } else if (finalAmount < Number(coupon.minBookingAmount)) {
      couponError = `Minimum booking amount of Rs. ${coupon.minBookingAmount} required`;
    } else {
      finalCouponCode = coupon.code;
      if (coupon.discountType === "PERCENTAGE") {
        let discount = finalAmount * (Number(coupon.discountValue) / 100);
        if (coupon.maxDiscountAmount) {
          discount = Math.min(discount, Number(coupon.maxDiscountAmount));
        }
        couponDiscount = Math.round(discount);
      } else {
        // FIXED
        couponDiscount = Math.min(finalAmount, Math.round(Number(coupon.discountValue)));
      }
    }
  }

  finalAmount = Math.max(0, finalAmount - couponDiscount);

  return { 
    basePrice, 
    discountPct, 
    discountAmount, 
    finalAmount, 
    breakdown: blocks,
    accessorySurcharge,
    couponDiscount,
    couponCode: finalCouponCode,
    couponError
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
  couponDiscount?: number;
  couponCode?: string;
  couponError?: string;
}): PriceCalculation {
  const { 
    baseRatePerHour, 
    durationMinutes, 
    existingMinutesOnDay, 
    isGuest,
    hasAccessories = false,
    defaultAccessories = 0,
    accessoryPrice = 0,
    accessoriesCount = 0,
    couponDiscount = 0,
    couponCode,
    couponError
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
  let finalAmount = gameFinalAmount + accessorySurcharge;
  if (couponDiscount) {
    finalAmount = Math.max(0, finalAmount - couponDiscount);
  }

  return { 
    basePrice, 
    discountPct, 
    discountAmount, 
    finalAmount, 
    breakdown: blocks,
    accessorySurcharge,
    couponDiscount,
    couponCode,
    couponError
  };
}
