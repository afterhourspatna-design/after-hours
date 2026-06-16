import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkAvailability, suggestAvailableUnit } from "@/lib/booking-helpers";
import { calculateBookingPrice } from "@/lib/pricing";
import { BookingStatus, PaymentStatus } from "@prisma/client";
import { addMinutes } from "date-fns";
import { z } from "zod";

const updateSchema = z.object({
  bookingStatus: z.nativeEnum(BookingStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  notes: z.string().optional().nullable(),
  startDateTime: z.string().datetime().optional(),
  durationMinutes: z.number().min(5).optional(),
  resourceUnitId: z.string().optional().nullable(),
  finalAmount: z.number().optional(),
  source: z.string().optional(),
  action: z.enum(["CHECK_IN", "CHECK_OUT"]).optional(),
  accessoriesCount: z.number().int().min(0).optional(),
  couponCode: z.string().optional().nullable(),
  gameId: z.string().optional(),
  userId: z.string().optional().nullable(),
  guestName: z.string().optional().nullable(),
  guestPhone: z.string().optional().nullable(),
  referredByPhone: z.string().optional().nullable(),
});

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      game: true,
      resourceUnit: true,
      user: { select: { id: true, name: true, phone: true, email: true } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(booking);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const existing = await prisma.booking.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = parsed.data;
  const updateData: any = { ...data };
  delete updateData.action;
  delete updateData.couponCode;
  delete updateData.referredByPhone;

  // Resolve userId if user/guest details are changed
  let resolvedUserId = existing.userId;
  if (data.userId !== undefined || data.guestPhone !== undefined) {
    if (data.userId) {
      resolvedUserId = data.userId;
    } else if (data.guestPhone) {
      let guestUser = await prisma.appUser.findUnique({
        where: { phone: data.guestPhone },
      });
      if (!guestUser) {
        let referredById = null;
        let referredByPhone = null;
        if (data.source === "REFERRAL" && data.referredByPhone) {
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
            if (referrer) {
              referredById = referrer.id;
              referredByPhone = referrer.phone;
            }
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
    } else {
      resolvedUserId = null;
    }
    updateData.userId = resolvedUserId;
  }

  // Resolve gameId
  const gameId = data.gameId ?? existing.gameId;

  // Validate accessoriesCount against game config
  if (data.accessoriesCount !== undefined) {
    const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
    if (game.hasAccessories && data.accessoriesCount > game.maxAccessories) {
      return NextResponse.json({ error: `Maximum allowed accessories is ${game.maxAccessories}` }, { status: 400 });
    }
  }

  // Resolve start time, duration, and end time
  let start = existing.startDateTime;
  let duration = existing.durationMinutes;

  if (data.action === "CHECK_IN") {
    start = new Date();
    updateData.startDateTime = start;
    
    // Validate or auto-assign unit for start
    const end = addMinutes(start, duration);
    let resourceUnitId = existing.resourceUnitId;
    if (!resourceUnitId) {
      resourceUnitId = await suggestAvailableUnit({
        gameId,
        startDateTime: start,
        endDateTime: end,
        excludeBookingId: id,
      });
      if (!resourceUnitId) {
        return NextResponse.json({ error: "No available units for this time slot" }, { status: 409 });
      }
      updateData.resourceUnitId = resourceUnitId;
    }
  } else if (data.action === "CHECK_OUT") {
    const end = new Date();
    duration = Math.max(15, Math.ceil((end.getTime() - existing.startDateTime.getTime()) / 60000));
    updateData.endDateTime = end;
    updateData.durationMinutes = duration;
    updateData.bookingStatus = BookingStatus.COMPLETED;
  } else if (data.startDateTime || data.durationMinutes || data.gameId || data.resourceUnitId !== undefined) {
    if (data.startDateTime) {
      start = new Date(data.startDateTime);
      updateData.startDateTime = start;
    }
    if (data.durationMinutes) {
      duration = data.durationMinutes;
    }
    const end = addMinutes(start, duration);
    updateData.endDateTime = end;

    // Resolve resource unit
    let resourceUnitId = data.resourceUnitId !== undefined ? data.resourceUnitId : existing.resourceUnitId;

    // If gameId changed, make sure the unit belongs to the new game
    if (data.gameId && data.gameId !== existing.gameId) {
      if (resourceUnitId) {
        const unit = await prisma.resourceUnit.findUnique({ where: { id: resourceUnitId } });
        if (!unit || unit.gameId !== data.gameId) {
          resourceUnitId = null;
        }
      }
    }

    if (!resourceUnitId) {
      const suggested = await suggestAvailableUnit({
        gameId,
        startDateTime: start,
        endDateTime: end,
        excludeBookingId: id,
      });
      if (!suggested) {
        return NextResponse.json({ error: "No available units for this time slot" }, { status: 409 });
      }
      resourceUnitId = suggested;
    } else {
      const { available, conflictingBooking } = await checkAvailability({
        resourceUnitId,
        startDateTime: start,
        endDateTime: end,
        excludeBookingId: id,
      });
      if (!available) {
        return NextResponse.json({
          error: "Unit is already booked for this time",
          conflict: conflictingBooking,
        }, { status: 409 });
      }
    }
    updateData.resourceUnitId = resourceUnitId;
  }

  // Role limits check
  if (role === "STAFF" && !data.action) {
    const allowedStaffStatuses: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.CANCELLED];
    if (data.bookingStatus && !allowedStaffStatuses.includes(data.bookingStatus as BookingStatus)) {
      return NextResponse.json({ error: "Staff can only confirm or cancel bookings" }, { status: 403 });
    }
  }

  // Recalculate price if fields affecting price are updated
  const needsPriceRecalculation =
    updateData.durationMinutes !== undefined ||
    updateData.startDateTime !== undefined ||
    updateData.accessoriesCount !== undefined ||
    data.couponCode !== undefined ||
    updateData.gameId !== undefined ||
    data.userId !== undefined ||
    data.guestPhone !== undefined;

  if (needsPriceRecalculation && existing.paymentStatus === "PAID") {
    return NextResponse.json({ error: "Cannot modify details (duration, game, time, etc.) of a booking that is already paid." }, { status: 400 });
  }

  if (needsPriceRecalculation) {
    const accessories = updateData.accessoriesCount ?? existing.accessoriesCount;

    let couponCodeToUse: string | undefined = undefined;
    if (data.couponCode !== undefined) {
      couponCodeToUse = data.couponCode ?? undefined;
    } else if (existing.couponId) {
      const existingCoupon = await prisma.coupon.findUnique({
        where: { id: existing.couponId }
      });
      couponCodeToUse = existingCoupon?.code;
    }

    const pricing = await calculateBookingPrice({
      gameId,
      durationMinutes: duration,
      startDateTime: start,
      userId: resolvedUserId,
      accessoriesCount: accessories,
      couponCode: couponCodeToUse,
      userRole: role,
    });

    if (pricing.couponError) {
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

    updateData.basePrice = pricing.basePrice;
    updateData.discountPct = pricing.discountPct;
    updateData.discountAmount = pricing.discountAmount;
    updateData.couponId = dbCouponId;
    updateData.couponDiscount = pricing.couponDiscount ?? 0;
    
    // Only overwrite finalAmount if it wasn't manually overridden by an ADMIN in the request
    if (updateData.finalAmount === undefined || role !== "ADMIN") {
      updateData.finalAmount = pricing.finalAmount;
    }

    // Increment usedCount if it is a new coupon for this booking
    if (dbCouponId && existing.couponId !== dbCouponId) {
      await prisma.coupon.update({
        where: { id: dbCouponId },
        data: { usedCount: { increment: 1 } }
      });
    }
  }

  const booking = await prisma.booking.update({
    where: { id },
    data: updateData,
    include: {
      game: { select: { name: true, tag: true } },
      resourceUnit: { select: { unitName: true } },
      user: { select: { name: true, phone: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: (session?.user as any)?.id,
      actorName: session?.user?.name ?? undefined,
      action: "UPDATE_BOOKING",
      entityType: "Booking",
      entityId: booking.id,
      meta: { changes: data },
    },
  });

  return NextResponse.json(booking);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.booking.delete({ where: { id } });
    if (booking.couponId) {
      await tx.coupon.updateMany({
        where: { id: booking.couponId, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: (session?.user as any)?.id,
        actorName: session?.user?.name ?? undefined,
        action: "DELETE_BOOKING",
        entityType: "Booking",
        entityId: id,
        meta: { bookingDetails: booking },
      },
    });
  });

  return NextResponse.json({ success: true });
}
