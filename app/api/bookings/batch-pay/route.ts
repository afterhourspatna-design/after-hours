import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, BookingStatus } from "@prisma/client";
import { z } from "zod";

const batchPaySchema = z.object({
  bookingIds: z.array(z.string()).optional(),
  negotiatedAmount: z.number().nonnegative(),
  paymentMethod: z.enum(["CASH", "ONLINE", "MIXED"]),
  cashAmount: z.number().nonnegative().optional(),
  onlineAmount: z.number().nonnegative().optional(),
  snacksAmount: z.number().nonnegative().optional(),
  userId: z.string().optional().nullable(),
  guestName: z.string().optional().nullable(),
  guestPhone: z.string().optional().nullable(),
});

const editBatchPaySchema = z.object({
  paymentId: z.string(),
  negotiatedAmount: z.number().nonnegative(),
  snacksAmount: z.number().nonnegative(),
  paymentMethod: z.enum(["CASH", "ONLINE", "MIXED"]),
  cashAmount: z.number().nonnegative().optional(),
  onlineAmount: z.number().nonnegative().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = batchPaySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      bookingIds = [],
      negotiatedAmount,
      paymentMethod,
      cashAmount = 0,
      onlineAmount = 0,
      snacksAmount = 0,
      userId = null,
      guestName = null,
      guestPhone = null,
    } = parsed.data;

    // Check if standalone snacks sale (no bookings)
    if (bookingIds.length === 0) {
      if (snacksAmount <= 0) {
        return NextResponse.json({ error: "Snacks amount must be greater than zero for snack sales" }, { status: 400 });
      }

      // Auto-register guest if guestPhone is provided
      let resolvedUserId = userId ?? null;
      if (!resolvedUserId && guestPhone) {
        let guestUser = await prisma.appUser.findUnique({
          where: { phone: guestPhone },
        });
        if (!guestUser) {
          guestUser = await prisma.appUser.create({
            data: {
              name: guestName || "Guest Customer",
              phone: guestPhone,
              role: "CUSTOMER",
            },
          });
        }
        resolvedUserId = guestUser.id;
      }

      // Find an active game for reference
      const game = await prisma.game.findFirst({
        where: { isActive: true },
      }) || await prisma.game.findFirst();

      if (!game) {
        return NextResponse.json({ error: "No games found in the database. Please create a game first." }, { status: 400 });
      }

      const paymentId = `SNACK-${Date.now()}`;
      const bCash = paymentMethod === "MIXED" ? cashAmount : paymentMethod === "CASH" ? snacksAmount : 0;
      const bOnline = paymentMethod === "MIXED" ? onlineAmount : paymentMethod === "ONLINE" ? snacksAmount : 0;

      const newBooking = await prisma.booking.create({
        data: {
          userId: resolvedUserId,
          guestName: resolvedUserId ? null : guestName,
          guestPhone: resolvedUserId ? null : guestPhone,
          gameId: game.id,
          startDateTime: new Date(),
          endDateTime: new Date(),
          durationMinutes: 0,
          basePrice: 0,
          finalAmount: 0,
          paymentStatus: PaymentStatus.PAID,
          bookingStatus: BookingStatus.COMPLETED,
          negotiatedAmount: 0,
          paymentMethod,
          cashAmount: bCash,
          onlineAmount: bOnline,
          snacksAmount,
          paymentId,
          source: "WALK_IN",
        },
      });

      // Create Audit Log
      await prisma.auditLog.create({
        data: {
          actorId: (session.user as any).id,
          actorName: session.user.name ?? undefined,
          action: "STANDALONE_SNACK_SALE",
          entityType: "Booking",
          meta: {
            paymentId,
            bookingId: newBooking.id,
            snacksAmount,
            paymentMethod,
            cashAmount: bCash,
            onlineAmount: bOnline,
          },
        },
      });

      return NextResponse.json({ success: true, count: 1 });
    }

    const isOnlySnacks = negotiatedAmount === 0 && snacksAmount > 0;

    // Validate MIXED payment type equation
    if (paymentMethod === "MIXED") {
      const sum = Number((cashAmount + onlineAmount).toFixed(2));
      const totalWithSnacks = Number((negotiatedAmount + snacksAmount).toFixed(2));
      if (Math.abs(sum - totalWithSnacks) > 0.01) {
        return NextResponse.json(
          { error: "Cash + Online amounts must equal the total settled amount (including snacks)" },
          { status: 400 }
        );
      }
    }

    // Retrieve bookings
    const bookings = await prisma.booking.findMany({
      where: { id: { in: bookingIds } },
    });

    if (bookings.length !== bookingIds.length) {
      return NextResponse.json({ error: "Some bookings were not found" }, { status: 404 });
    }

    // Verify all bookings are unpaid or partial (unless paying only snacks)
    if (!isOnlySnacks) {
      const invalidStatus = bookings.filter((b) => b.paymentStatus === PaymentStatus.PAID);
      if (invalidStatus.length > 0) {
        return NextResponse.json(
          { error: "One or more selected bookings are already paid" },
          { status: 400 }
        );
      }
    }

    // Compute total final amount of selected bookings
    const totalFinalAmount = bookings.reduce((sum, b) => sum + Number(b.finalAmount), 0);

    // Generate a unique payment ID as UUID for this batch transaction
    const paymentId = crypto.randomUUID();

    // Update bookings using a transaction
    const updatePromises = bookings.map((b) => {
      let ratio = 1 / bookings.length;
      if (totalFinalAmount > 0) {
        ratio = Number(b.finalAmount) / totalFinalAmount;
      }

      // Calculate proportional shares
      const bNegotiated = Math.round(negotiatedAmount * ratio * 100) / 100;
      const bSnacks = Math.round(snacksAmount * ratio * 100) / 100;
      let bCash = 0;
      let bOnline = 0;

      if (paymentMethod === "CASH") {
        bCash = Number((bNegotiated + bSnacks).toFixed(2));
      } else if (paymentMethod === "ONLINE") {
        bOnline = Number((bNegotiated + bSnacks).toFixed(2));
      } else if (paymentMethod === "MIXED") {
        bCash = Math.round(cashAmount * ratio * 100) / 100;
        bOnline = Math.round(onlineAmount * ratio * 100) / 100;
      }

      return prisma.booking.update({
        where: { id: b.id },
        data: {
          paymentStatus: isOnlySnacks ? PaymentStatus.UNPAID : PaymentStatus.PAID,
          bookingStatus: isOnlySnacks ? undefined : BookingStatus.COMPLETED,
          negotiatedAmount: bNegotiated,
          paymentMethod,
          cashAmount: bCash,
          onlineAmount: bOnline,
          paymentId,
          snacksAmount: bSnacks,
        },
      });
    });

    const updatedBookings = await prisma.$transaction(updatePromises);

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "BATCH_PAY_BOOKINGS",
        entityType: "Booking",
        meta: {
          paymentId,
          bookingIds,
          negotiatedAmount,
          paymentMethod,
          cashAmount,
          onlineAmount,
          snacksAmount,
        },
      },
    });

    return NextResponse.json({ success: true, count: updatedBookings.length });
  } catch (error: any) {
    console.error("Batch payment failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = editBatchPaySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { paymentId, negotiatedAmount, snacksAmount, paymentMethod, cashAmount = 0, onlineAmount = 0 } = parsed.data;

    const isOnlySnacks = negotiatedAmount === 0 && snacksAmount > 0;

    // Validate MIXED payment type equation
    const totalWithSnacks = Number((negotiatedAmount + snacksAmount).toFixed(2));
    if (paymentMethod === "MIXED") {
      const sum = Number((cashAmount + onlineAmount).toFixed(2));
      if (Math.abs(sum - totalWithSnacks) > 0.01) {
        return NextResponse.json(
          { error: "Cash + Online amounts must equal the total settled amount (including snacks)" },
          { status: 400 }
        );
      }
    }

    // Retrieve bookings with this paymentId
    const bookings = await prisma.booking.findMany({
      where: { paymentId },
    });

    if (bookings.length === 0) {
      return NextResponse.json({ error: "No bookings found for this payment ID" }, { status: 404 });
    }

    // Compute total final amount of selected bookings
    const totalFinalAmount = bookings.reduce((sum, b) => sum + Number(b.finalAmount), 0);

    // Update bookings using a transaction
    const updatePromises = bookings.map((b) => {
      let ratio = 1 / bookings.length;
      if (totalFinalAmount > 0) {
        ratio = Number(b.finalAmount) / totalFinalAmount;
      }

      // Calculate proportional shares
      const bNegotiated = Math.round(negotiatedAmount * ratio * 100) / 100;
      const bSnacks = Math.round(snacksAmount * ratio * 100) / 100;
      let bCash = 0;
      let bOnline = 0;

      if (paymentMethod === "CASH") {
        bCash = Number((bNegotiated + bSnacks).toFixed(2));
      } else if (paymentMethod === "ONLINE") {
        bOnline = Number((bNegotiated + bSnacks).toFixed(2));
      } else if (paymentMethod === "MIXED") {
        bCash = Math.round(cashAmount * ratio * 100) / 100;
        bOnline = Math.round(onlineAmount * ratio * 100) / 100;
      }

      return prisma.booking.update({
        where: { id: b.id },
        data: {
          paymentStatus: isOnlySnacks ? PaymentStatus.UNPAID : PaymentStatus.PAID,
          bookingStatus: isOnlySnacks ? undefined : BookingStatus.COMPLETED,
          negotiatedAmount: bNegotiated,
          paymentMethod,
          cashAmount: bCash,
          onlineAmount: bOnline,
          snacksAmount: bSnacks,
        },
      });
    });

    const updatedBookings = await prisma.$transaction(updatePromises);

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "EDIT_BATCH_PAY_BOOKINGS",
        entityType: "Booking",
        meta: {
          paymentId,
          bookingIds: bookings.map((b) => b.id),
          negotiatedAmount,
          paymentMethod,
          cashAmount,
          onlineAmount,
          snacksAmount,
        },
      },
    });

    return NextResponse.json({ success: true, count: updatedBookings.length });
  } catch (error: any) {
    console.error("Batch payment edit failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
