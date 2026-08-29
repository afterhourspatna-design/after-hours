import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";

export interface PriceCalculation {
  basePrice: number;           // base cost of the game block + accessories
  discountPct: number;         // progressive same-day discount (now always 0)
  discountAmount: number;      // progressive savings (now always 0)
  finalAmount: number;         // amount to charge after coupon
  breakdown: HourBlock[];      // per-block breakdown
  accessorySurcharge: number;  // surcharge for extra hardware accessories (now always 0 since it is built-in)
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
 * Custom helper to calculate the base amount for a block of time, based on game tag and accessories.
 */
/**
 * Helper to extract the local hour and minute for the Asia/Kolkata (IST) timezone.
 * Falls back to local system timezone if formatting fails.
 */
function getLocalHourAndMinute(date: Date): { hour: number; minute: number } {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      hour: "numeric",
      minute: "numeric",
    });
    const parts = formatter.formatToParts(date);
    const hourVal = parts.find(p => p.type === "hour")?.value;
    const minuteVal = parts.find(p => p.type === "minute")?.value;
    if (hourVal !== undefined && minuteVal !== undefined) {
      return { hour: parseInt(hourVal, 10), minute: parseInt(minuteVal, 10) };
    }
  } catch (e) {
    console.error("Timezone formatter error", e);
  }
  return { hour: date.getHours(), minute: date.getMinutes() };
}

/**
 * Custom helper to calculate the base amount for a block of time, based on game tag and accessories.
 */
function calculateBlockBaseAmount(params: {
  tag: string;
  durationMinutes: number;
  blockMinutes: number;
  blockNumber: number;
  accessoriesCount: number;
  baseRatePerHour: number;
  startDateTime?: Date;
}): number {
  const { tag, durationMinutes, blockMinutes, blockNumber, accessoriesCount, baseRatePerHour, startDateTime } = params;

  if (tag === "ps5") {
    // PS5 Rates:
    // 1 Controller: 30m = 80, 1h = 120
    // 2 Controllers: 30m = 100, 1h = 150
    // 3 Controllers: 30m = 120, 1h = 180
    // 4 Controllers: 30m = 150, 1h = 200
    let rHalf = 80;
    let rHour = 120;
    if (accessoriesCount === 2) {
      rHalf = 100;
      rHour = 150;
    } else if (accessoriesCount === 3) {
      rHalf = 120;
      rHour = 180;
    } else if (accessoriesCount === 4) {
      rHalf = 150;
      rHour = 200;
    }

    if (blockMinutes <= 30) {
      return rHalf;
    }
    return rHour;
  }

  if (tag === "ps4") {
    // PS4 Rates:
    // 1 Controller: 30m = 70, 1h = 100
    // 2 Controllers: 30m = 80, 1h = 120
    // 3 Controllers: 30m = 100, 1h = 150
    // 4 Controllers: 30m = 120, 1h = 180
    let rHalf = 70;
    let rHour = 100;
    if (accessoriesCount === 2) {
      rHalf = 80;
      rHour = 120;
    } else if (accessoriesCount === 3) {
      rHalf = 100;
      rHour = 150;
    } else if (accessoriesCount === 4) {
      rHalf = 120;
      rHour = 180;
    }

    if (blockMinutes <= 30) {
      return rHalf;
    }
    return rHour;
  }

  if (tag === "metaquest") {
    // Meta Quest Rates: 20m: ₹80, 30m: ₹120, 40m: ₹150, 60m: ₹200
    if (blockMinutes <= 20) return 80;
    if (blockMinutes <= 30) return 120;
    if (blockMinutes <= 40) return 150;
    return 200;
  }

  if (tag === "foosball") {
    // Foosball: 30m = ₹80, 1h = ₹150
    if (blockMinutes <= 30) return 80;
    return 150;
  }

  if (tag === "soccer" || tag === "carrom" || tag === "cards") {
    // Soccer / Carrom / Cards: 30m = ₹50, 1h = ₹100
    if (blockMinutes <= 30) return 50;
    return 100;
  }

  if (tag === "tabletennis") {
    // Table Tennis:
    // 2 Racquets: 30m = ₹80, 1h = ₹150
    // 4 Racquets: 30m = ₹120, 1h = ₹200
    let rHalf = 80;
    let rHour = 150;
    if (accessoriesCount === 4) {
      rHalf = 120;
      rHour = 200;
    }
    if (blockMinutes <= 30) {
      return rHalf;
    }
    return rHour;
  }

  if (tag === "pool") {
    // Pool Table:
    // 2 Sticks: 30m = ₹80, 1h = ₹150
    // 4 Sticks: 30m = ₹100, 1h = ₹180
    let rHalf = 80;
    let rHour = 150;
    if (accessoriesCount === 4) {
      rHalf = 100;
      rHour = 180;
    }
    if (blockMinutes <= 30) {
      return rHalf;
    }
    return rHour;
  }

  if (tag === "basketball" || tag === "dart" || tag === "jenga") {
    // Basketball / Dart / Jenga: ₹20 flat
    return blockNumber === 1 ? 20 : 0;
  }

  if (tag === "event") {
    // Event Booking:
    // 11:00 AM – 5:00 PM: ₹750 per hour
    // After 5:00 PM: ₹1,000 per hour
    const startDT = startDateTime || new Date();
    const { hour: startHour, minute: startMin } = getLocalHourAndMinute(startDT);
    const startMinutesOfDay = startHour * 60 + startMin;
    
    let total = 0;
    const startOffset = (blockNumber - 1) * 60;
    
    for (let m = 0; m < blockMinutes; m++) {
      const currentMin = (startMinutesOfDay + startOffset + m) % 1440;
      const currentHour = Math.floor(currentMin / 60);
      const minRate = (currentHour >= 11 && currentHour < 17) ? (750 / 60) : (1000 / 60);
      total += minRate;
    }
    return Math.round(total * 100) / 100;
  }

  return (blockMinutes / 60) * baseRatePerHour;
}

/**
 * Calculates price for a new booking, applying same-day per-user discounts:
 * (Progressive discounts are now disabled per request)
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
    accessoriesCount = 0,
    couponCode,
    userRole
  } = params;

  const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
  const baseRatePerHour = Number(game.basePrice);

  // Build per-block distribution (minimum slot unit)
  const blocks: HourBlock[] = [];
  let remainingMinutes = durationMinutes;
  let blockNumber = 1;

  while (remainingMinutes > 0) {
    const blockMinutes = Math.min(remainingMinutes, 60);

    const blockBaseAmount = calculateBlockBaseAmount({
      tag: game.tag,
      durationMinutes,
      blockMinutes,
      blockNumber,
      accessoriesCount,
      baseRatePerHour,
      startDateTime,
    });

    const discountPct = 0; // Disabled same-day progressive discounts
    const amount = Math.round(blockBaseAmount * 100) / 100;

    blocks.push({
      blockNumber,
      durationMinutes: blockMinutes,
      ratePerHour: baseRatePerHour,
      discountPct,
      amount,
    });

    remainingMinutes -= blockMinutes;
    blockNumber++;
  }

  const gameBasePrice = blocks.reduce((sum, b) => sum + b.amount, 0);
  const gameFinalAmount = gameBasePrice;
  const discountAmount = 0;
  const discountPct = 0;

  const basePrice = gameBasePrice;
  let finalAmount = gameFinalAmount;

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
        couponDiscount = Math.round(discount * 100) / 100;
      } else {
        // FIXED
        couponDiscount = Math.min(finalAmount, Math.round(Number(coupon.discountValue) * 100) / 100);
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
    accessorySurcharge: 0,
    couponDiscount,
    couponCode: finalCouponCode,
    couponError
  };
}

/**
 * Quick sync version for display
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
  gameTag?: string;
  startDateTime?: Date | string;
}): PriceCalculation {
  const { 
    baseRatePerHour, 
    durationMinutes, 
    accessoriesCount = 0,
    couponDiscount = 0,
    couponCode,
    couponError,
    gameTag = "ps5",
    startDateTime
  } = params;

  const startDT = startDateTime ? new Date(startDateTime) : new Date();

  const blocks: HourBlock[] = [];
  let remainingMinutes = durationMinutes;
  let blockNumber = 1;

  while (remainingMinutes > 0) {
    const blockMinutes = Math.min(remainingMinutes, 60);

    const blockBaseAmount = calculateBlockBaseAmount({
      tag: gameTag,
      durationMinutes,
      blockMinutes,
      blockNumber,
      accessoriesCount,
      baseRatePerHour,
      startDateTime: startDT,
    });

    const discountPct = 0; // Disabled same-day progressive discounts
    const amount = Math.round(blockBaseAmount * 100) / 100;

    blocks.push({
      blockNumber,
      durationMinutes: blockMinutes,
      ratePerHour: baseRatePerHour,
      discountPct,
      amount,
    });

    remainingMinutes -= blockMinutes;
    blockNumber++;
  }

  const gameBasePrice = blocks.reduce((sum, b) => sum + b.amount, 0);
  const gameFinalAmount = gameBasePrice;
  const discountAmount = 0;
  const discountPct = 0;

  const basePrice = gameBasePrice;
  let finalAmount = gameFinalAmount;
  if (couponDiscount) {
    finalAmount = Math.max(0, finalAmount - couponDiscount);
  }

  return { 
    basePrice, 
    discountPct, 
    discountAmount, 
    finalAmount, 
    breakdown: blocks,
    accessorySurcharge: 0,
    couponDiscount,
    couponCode,
    couponError
  };
}
