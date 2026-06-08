import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@prisma/client";
import { z } from "zod";

const batchPaySchema = z.object({
  bookingIds: z.array(z.string()).min(1),
  negotiatedAmount: z.number().nonnegative(),
  paymentMethod: z.enum(["CASH", "ONLINE", "MIXED"]),
  cashAmount: z.number().nonnegative().optional(),
  onlineAmount: z.number().nonnegative().optional(),
  snacksAmount: z.number().nonnegative().optional(),
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

    const { bookingIds, negotiatedAmount, paymentMethod, cashAmount = 0, onlineAmount = 0, snacksAmount = 0 } = parsed.data;

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

    // Verify all bookings are unpaid or partial
    const invalidStatus = bookings.filter((b) => b.paymentStatus === PaymentStatus.PAID);
    if (invalidStatus.length > 0) {
      return NextResponse.json(
        { error: "One or more selected bookings are already paid" },
        { status: 400 }
      );
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
          paymentStatus: PaymentStatus.PAID,
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
