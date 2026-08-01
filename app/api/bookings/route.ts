import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkAvailability, suggestAvailableUnit, expireStaleHolds } from "@/lib/booking-helpers";
import { calculateBookingPrice } from "@/lib/pricing";
import { BookingStatus, BookingSource, BookingType, PaymentStatus } from "@prisma/client";
import { addMinutes } from "date-fns";
import { z } from "zod";

const createBookingSchema = z.object({
  userId: z.string().optional().nullable(),
  guestName: z.string().optional().nullable(),
  guestPhone: z.string().optional().nullable(),
  gameId: z.string(),
  resourceUnitId: z.string().optional().nullable(),
  startDateTime: z.string().datetime(),
  durationMinutes: z.number().min(5).max(480),
  bookingType: z.nativeEnum(BookingType).default("HOURLY"),
  paymentStatus: z.nativeEnum(PaymentStatus).default("UNPAID"),
  source: z.nativeEnum(BookingSource).default("WALK_IN"),
  notes: z.string().optional().nullable(),
  priceOverride: z.number().optional().nullable(),
  accessoriesCount: z.number().int().min(0).default(0),
  couponCode: z.string().optional().nullable(),
  referredByPhone: z.string().optional().nullable(),
  advanceAmount: z.number().nonnegative().optional(),
  paymentMethod: z.enum(["CASH", "ONLINE", "MIXED"]).optional(),
  cashAmount: z.number().nonnegative().optional(),
  onlineAmount: z.number().nonnegative().optional(),
  usePrepaidCredits: z.boolean().optional().default(false),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  const userId = (session.user as any).id;
  const { searchParams } = req.nextUrl;

  // Expire stale holds in background
  expireStaleHolds().catch(console.error);

  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const status = searchParams.get("status") as BookingStatus | null;
  const paymentStatus = searchParams.get("paymentStatus") as PaymentStatus | null;
  const gameId = searchParams.get("gameId");
  const search = searchParams.get("q");
  const dateFrom = searchParams.get("from");
  const dateTo = searchParams.get("to");
  const includeAdvance = searchParams.get("includeAdvance") !== "0";
  const forCalendar = searchParams.get("calendar") === "1";

  const where: any = {
    durationMinutes: { gt: 0 } // Hide legacy dummy snack bookings
  };

  // Role-based visibility
  if (role === "STAFF") {
    // Staff: today + future only in IST timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === "year")!.value, 10);
    const month = parseInt(parts.find(p => p.type === "month")!.value, 10) - 1;
    const day = parseInt(parts.find(p => p.type === "day")!.value, 10);
    const todayStartIST = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
    where.startDateTime = { gte: todayStartIST };
  } else if (role === "CUSTOMER") {
    // Customer: own bookings only
    where.userId = userId;
  }

  if (status) where.bookingStatus = status;
  if (paymentStatus === "UNPAID") {
    where.paymentStatus = { in: ["UNPAID", "PARTIAL"] };
  } else if (paymentStatus) {
    where.paymentStatus = paymentStatus;
  }
  if (gameId) where.gameId = gameId;
  if (dateFrom || dateTo) {
    where.startDateTime = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }
  if (search) {
    where.OR = [
      { guestName: { contains: search, mode: "insensitive" } },
      { guestPhone: { contains: search } },
      { notes: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { phone: { contains: search } } },
    ];
  }
  if (!includeAdvance) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === "year")!.value, 10);
    const month = parseInt(parts.find(p => p.type === "month")!.value, 10) - 1;
    const day = parseInt(parts.find(p => p.type === "day")!.value, 10);
    const todayEndIST = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));

    const existingStartFilter = where.startDateTime ?? {};
    let cappedLte = todayEndIST;

    if (existingStartFilter.lte) {
      const existingLte = new Date(existingStartFilter.lte);
      cappedLte = existingLte < todayEndIST ? existingLte : todayEndIST;
    }

    where.startDateTime = {
      ...existingStartFilter,
      lte: cappedLte,
    };
  }

  if (forCalendar) {
    // Calendar needs all bookings in a date range, no pagination
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        game: { select: { name: true, tag: true } },
        resourceUnit: { select: { unitName: true } },
        user: { select: { name: true, phone: true, createdAt: true, referredByPhone: true, _count: { select: { bookings: { where: { paymentStatus: "PAID" } } } } } },
        createdBy: { select: { name: true } },
        allocations: true,
      },
      orderBy: { startDateTime: "asc" },
    });
    return NextResponse.json(bookings);
  }

  const includeSnacks = searchParams.get("includeSnacks") === "1";

  const [bookings, total, snackOrders] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        game: { select: { name: true, tag: true } },
        resourceUnit: { select: { unitName: true } },
        user: { select: { name: true, phone: true, createdAt: true, referredByPhone: true, _count: { select: { bookings: { where: { paymentStatus: "PAID" } } } } } },
        createdBy: { select: { name: true } },
        allocations: true,
      },
      orderBy: { startDateTime: "desc" },
      ...(includeSnacks ? {} : { skip: (page - 1) * limit, take: limit }),
    }),
    includeSnacks ? Promise.resolve(0) : prisma.booking.count({ where }),
    // Fetch snack orders only if requested and matching the same payment status criteria
    (includeSnacks && !status ? prisma.snackOrder.findMany({
      where: paymentStatus === "UNPAID" ? { paymentStatus: { in: ["UNPAID", "PARTIAL"] } } : (paymentStatus ? { paymentStatus } : {}),
      include: {
        user: { select: { name: true, phone: true, createdAt: true, referredByPhone: true, _count: { select: { bookings: { where: { paymentStatus: "PAID" } } } } } },
        allocations: true,
      },
      orderBy: { createdAt: "desc" }
    }) : Promise.resolve([]))
  ]);

  // Map snack orders to dummy booking shape
  const mappedSnacks = includeSnacks ? snackOrders.map((snack: any) => ({
    id: `SNACK_${snack.id}`,
    userId: snack.userId,
    guestName: snack.guestName,
    guestPhone: snack.guestPhone,
    isNewUser: false,
    startDateTime: snack.createdAt.toISOString(),
    endDateTime: snack.createdAt.toISOString(),
    durationMinutes: 0,
    bookingStatus: "COMPLETED",
    paymentStatus: snack.paymentStatus,
    finalAmount: Number(snack.amount),
    negotiatedAmount: 0,
    paymentMethod: null,
    cashAmount: null,
    onlineAmount: null,
    source: "WALK_IN",
    game: { name: "Snack Sale", tag: "snack" },
    resourceUnit: null,
    user: snack.user ? { name: snack.user.name, phone: snack.user.phone, referredByPhone: snack.user.referredByPhone } : null,
    updatedAt: snack.updatedAt.toISOString(),
    paymentId: snack.paymentId,
    snacksAmount: Number(snack.amount),
    allocations: snack.allocations ?? [],
  })) : [];

  // Map bookings to calculate balance due and clean up big decimals
  const mappedBookings = bookings.map((b: any) => {
    let isNewUser = false;
    if (b.user) {
      isNewUser = b.user._count?.bookings === 0;
    }
    
    return {
      ...b,
      isNewUser,
      finalAmount: Number(b.finalAmount),
      negotiatedAmount: b.negotiatedAmount !== null ? Number(b.negotiatedAmount) : null,
      discountAmount: Number(b.discountAmount),
      couponDiscount: Number(b.couponDiscount),
      createdByName: b.createdBy?.name || null,
    };
  });

  const combinedBookings = [...mappedBookings, ...mappedSnacks].sort((a: any, b: any) =>
    new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime()
  );

  const finalBookings = includeSnacks 
    ? combinedBookings.slice((page - 1) * limit, page * limit) 
    : combinedBookings;

  const finalTotal = includeSnacks ? combinedBookings.length : total;

  return NextResponse.json({ bookings: finalBookings, total: finalTotal, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  const actorId = (session.user as any).id;
  if (!["ADMIN", "STAFF", "CUSTOMER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Enforce customer lockdown: Customers can only book for themselves
  if (role === "CUSTOMER") {
    data.userId = actorId;
    data.guestName = null;
    data.guestPhone = null;
    // Customers can't override prices or set specific sources
    data.priceOverride = null;
    data.source = BookingSource.ONLINE;
  }

  let resolvedUserId = data.userId ?? null;
  if (!resolvedUserId && data.guestPhone) {
    let guestUser = await prisma.appUser.findUnique({
      where: { phone: data.guestPhone },
    });
    if (!guestUser) {
      let referredById = null;
      let referredByPhone = null;
      if (data.source === BookingSource.REFERRAL && data.referredByPhone) {
        const cleanedPhone = data.referredByPhone.replace(/\D/g, "");
        if (cleanedPhone) {
          const referrer = await prisma.appUser.findFirst({
            where: {
              OR: [
                { phone: data.referredByPhone },
                { phone: { contains: cleanedPhone } }
              ]
            }
          });
          if (!referrer) {
            return NextResponse.json({ error: "Referrer phone number not found in database. Please register the referring customer first." }, { status: 400 });
          }
          referredById = referrer.id;
          referredByPhone = referrer.phone;
        }
      }

      guestUser = await prisma.appUser.create({
        data: {
          name: data.guestName || "Guest Customer",
          phone: data.guestPhone,
          role: "CUSTOMER",
          referredById,
          referredByPhone,
        },
      });
    }
    resolvedUserId = guestUser.id;
  }

  const startDateTime = new Date(data.startDateTime);
  const endDateTime = addMinutes(startDateTime, data.durationMinutes);

  // Auto-suggest unit if not provided
  let resourceUnitId = data.resourceUnitId ?? null;
  if (!resourceUnitId) {
    const suggested = await suggestAvailableUnit({ gameId: data.gameId, startDateTime, endDateTime });
    if (!suggested) {
      return NextResponse.json({ error: "No available units for this time slot" }, { status: 409 });
    }
    resourceUnitId = suggested;
  } else {
    // Validate availability
    const { available, conflictingBooking } = await checkAvailability({ resourceUnitId, startDateTime, endDateTime });
    if (!available) {
      return NextResponse.json({
        error: "This unit is already booked for the selected time",
        conflict: conflictingBooking,
      }, { status: 409 });
    }
  }

  // Fetch game config to validate accessories count
  const game = await prisma.game.findUniqueOrThrow({ where: { id: data.gameId } });
  if (game.hasAccessories && data.accessoriesCount > game.maxAccessories) {
    return NextResponse.json({ error: `Maximum allowed accessories is ${game.maxAccessories}` }, { status: 400 });
  }

  // Calculate price
  const pricing = await calculateBookingPrice({
    gameId: data.gameId,
    durationMinutes: data.durationMinutes,
    startDateTime,
    userId: resolvedUserId,
    accessoriesCount: data.accessoriesCount,
    couponCode: data.couponCode ?? undefined,
    userRole: role,
  });

  if (data.couponCode && pricing.couponError) {
    return NextResponse.json({ error: pricing.couponError }, { status: 400 });
  }

  let dbCouponId: string | null = null;
  if (pricing.couponCode) {
    const cp = await prisma.coupon.findUnique({
      where: { code: pricing.couponCode }
    });
    if (cp) {
      dbCouponId = cp.id;
    }
  }

  let finalAmount = data.priceOverride != null && role === "ADMIN"
    ? data.priceOverride
    : pricing.finalAmount;

  let usedCreditAmount = 0;
  let creditBalanceIdToDeduct: string | null = null;
  
  if (data.usePrepaidCredits && resolvedUserId) {
    const balances = await prisma.userCreditBalance.findMany({
      where: { userId: resolvedUserId, balance: { gt: 0 } },
      include: { applicableGames: true }
    });
    
    // Prioritize specific game balances, fallback to general "all games" balances
    let applicableBalance = balances.find(b => !b.isAllGames && b.applicableGames.some(g => g.id === data.gameId));
    if (!applicableBalance) {
      applicableBalance = balances.find(b => b.isAllGames);
    }

    if (applicableBalance) {
      const balanceValue = Number(applicableBalance.balance);
      if (balanceValue >= finalAmount) {
        usedCreditAmount = finalAmount;
        creditBalanceIdToDeduct = applicableBalance.id;
        finalAmount = 0;
      } else {
        usedCreditAmount = balanceValue;
        creditBalanceIdToDeduct = applicableBalance.id;
        finalAmount -= usedCreditAmount;
      }
    } else {
      return NextResponse.json({ error: "Insufficient prepaid credit balance for this game" }, { status: 400 });
    }
  }

  let initialPaymentStatus = data.paymentStatus;
  if (finalAmount === 0 && usedCreditAmount > 0) {
    initialPaymentStatus = PaymentStatus.PAID;
  } else if (data.advanceAmount && data.advanceAmount > 0) {
    if (data.advanceAmount >= finalAmount) {
      initialPaymentStatus = PaymentStatus.PAID;
    } else {
      initialPaymentStatus = PaymentStatus.PARTIAL;
    }
  }

  let finalSource = data.source;
  if (finalAmount === 0 && usedCreditAmount > 0) {
    finalSource = "CREDITS" as any; // Cast as any because zod schema uses nativeEnum which may not immediately reflect prisma enum change
  }

  const booking = await prisma.booking.create({
    data: {
      userId: resolvedUserId,
      guestName: data.guestName ?? null,
      guestPhone: data.guestPhone ?? null,
      gameId: data.gameId,
      resourceUnitId,
      startDateTime,
      endDateTime,
      durationMinutes: data.durationMinutes,
      accessoriesCount: data.accessoriesCount,
      bookingType: data.bookingType,
      basePrice: pricing.basePrice,
      discountPct: pricing.discountPct,
      discountAmount: pricing.discountAmount,
      couponId: dbCouponId,
      couponDiscount: pricing.couponDiscount ?? 0,
      finalAmount,
      usedCreditAmount,
      paymentStatus: initialPaymentStatus,
      bookingStatus: BookingStatus.CONFIRMED,
      source: finalSource,
      notes: data.notes ?? null,
      holdExpiresAt: null,
      createdById: actorId,
    },
    include: {
      game: { select: { name: true, tag: true } },
      resourceUnit: { select: { unitName: true } },
      user: { select: { name: true, phone: true } },
    },
  });

  if (dbCouponId) {
    await prisma.coupon.update({
      where: { id: dbCouponId },
      data: { usedCount: { increment: 1 } }
    });
  }

  if (usedCreditAmount > 0 && resolvedUserId && creditBalanceIdToDeduct) {
    await prisma.userCreditBalance.update({
      where: { id: creditBalanceIdToDeduct },
      data: { balance: { decrement: usedCreditAmount } }
    });
    await prisma.prepaidTransaction.create({
      data: {
        userId: resolvedUserId,
        creditBalanceId: creditBalanceIdToDeduct,
        amount: -usedCreditAmount,
        description: `Booking #${booking.id.slice(-6).toUpperCase()}`,
        bookingId: booking.id
      }
    });
  }

  if (data.advanceAmount && data.advanceAmount > 0 && data.paymentMethod) {
    const pmMethod = data.paymentMethod;
    const cashAmt = pmMethod === "MIXED" ? (data.cashAmount || 0) : pmMethod === "CASH" ? data.advanceAmount : 0;
    const onlineAmt = pmMethod === "MIXED" ? (data.onlineAmount || 0) : pmMethod === "ONLINE" ? data.advanceAmount : 0;

    // Create actual payment receipt
    const payment = await prisma.payment.create({
      data: {
        paymentMethod: pmMethod,
        negotiatedAmount: finalAmount,
        cashAmount: cashAmt,
        onlineAmount: onlineAmt,
        userId: resolvedUserId,
        customerNames: booking.user?.name ?? data.guestName ?? "Guest",
      }
    });

    // Allocate that payment exactly to this new booking
    await prisma.paymentAllocation.create({
      data: {
        amount: data.advanceAmount,
        paymentId: payment.id,
        bookingId: booking.id,
      }
    });
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      actorId,
      actorName: session.user.name ?? undefined,
      action: "CREATE_BOOKING",
      entityType: "Booking",
      entityId: booking.id,
    },
  });

  return NextResponse.json(booking, { status: 201 });
}
