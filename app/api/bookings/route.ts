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
  durationMinutes: z.number().min(15).max(480),
  bookingType: z.nativeEnum(BookingType).default("HOURLY"),
  paymentStatus: z.nativeEnum(PaymentStatus).default("UNPAID"),
  source: z.nativeEnum(BookingSource).default("WALK_IN"),
  notes: z.string().optional().nullable(),
  priceOverride: z.number().optional().nullable(),
  accessoriesCount: z.number().int().min(0).default(0),
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
  const gameId = searchParams.get("gameId");
  const search = searchParams.get("q");
  const dateFrom = searchParams.get("from");
  const dateTo = searchParams.get("to");
  const forCalendar = searchParams.get("calendar") === "1";

  const where: any = {};

  // Role-based visibility
  if (role === "STAFF") {
    // Staff: today + future only
    where.startDateTime = { gte: new Date(new Date().setHours(0, 0, 0, 0)) };
  } else if (role === "CUSTOMER") {
    // Customer: own bookings only
    where.userId = userId;
  }

  if (status) where.bookingStatus = status;
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

  if (forCalendar) {
    // Calendar needs all bookings in a date range, no pagination
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        game: { select: { name: true, tag: true } },
        resourceUnit: { select: { unitName: true } },
        user: { select: { name: true, phone: true } },
      },
      orderBy: { startDateTime: "asc" },
    });
    return NextResponse.json(bookings);
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        game: { select: { name: true, tag: true } },
        resourceUnit: { select: { unitName: true } },
        user: { select: { name: true, phone: true } },
      },
      orderBy: { startDateTime: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return NextResponse.json({ bookings, total, page, limit });
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
    userId: data.userId ?? null,
    accessoriesCount: data.accessoriesCount,
  });

  const finalAmount = data.priceOverride != null && role === "ADMIN"
    ? data.priceOverride
    : pricing.finalAmount;

  const holdExpiresAt = addMinutes(new Date(), parseInt(process.env.HOLD_EXPIRY_MINUTES ?? "15"));

  const booking = await prisma.booking.create({
    data: {
      userId: data.userId ?? null,
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
      finalAmount,
      paymentStatus: data.paymentStatus,
      bookingStatus: role === "CUSTOMER" ? BookingStatus.CONFIRMED : BookingStatus.HOLD,
      source: data.source,
      notes: data.notes ?? null,
      holdExpiresAt,
      createdById: actorId,
    },
    include: {
      game: { select: { name: true, tag: true } },
      resourceUnit: { select: { unitName: true } },
      user: { select: { name: true, phone: true } },
    },
  });

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
