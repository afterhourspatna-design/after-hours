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
  couponCode: z.string().optional().nullable(),
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
      bookingIds: allIds = [],
      negotiatedAmount,
      paymentMethod,
      cashAmount = 0,
      onlineAmount = 0,
      snacksAmount = 0,
      userId = null,
      guestName = null,
      guestPhone = null,
      couponCode = null,
    } = parsed.data;

    const actualBookingIds = allIds.filter(id => !id.startsWith("SNACK_"));
    const snackOrderIds = allIds.filter(id => id.startsWith("SNACK_")).map(id => id.replace("SNACK_", ""));

    // Check if standalone snacks sale (no bookings and no unpaid snacks selected)
    if (actualBookingIds.length === 0 && snackOrderIds.length === 0) {
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

      // Create Payment record
      const payment = await prisma.payment.create({
        data: {
          paymentMethod,
          negotiatedAmount: 0,
          cashAmount: paymentMethod === "MIXED" ? cashAmount : paymentMethod === "CASH" ? snacksAmount : 0,
          onlineAmount: paymentMethod === "MIXED" ? onlineAmount : paymentMethod === "ONLINE" ? snacksAmount : 0,
          userId: resolvedUserId,
          customerNames: guestName ?? "Guest",
        }
      });
      const paymentId = payment.id;

      // Create new SnackOrder
      const newSnack = await prisma.snackOrder.create({
        data: {
          userId: resolvedUserId,
          guestName: resolvedUserId ? null : guestName,
          guestPhone: resolvedUserId ? null : guestPhone,
          amount: snacksAmount,
          paymentStatus: PaymentStatus.PAID,
          paymentId: paymentId,
        },
      });

      // Create Audit Log
      await prisma.auditLog.create({
        data: {
          actorId: (session.user as any).id,
          actorName: session.user.name ?? undefined,
          action: "STANDALONE_SNACK_SALE",
          entityType: "Payment",
          meta: {
            paymentId,
            snackOrderId: newSnack.id,
            snacksAmount,
            paymentMethod,
            cashAmount,
            onlineAmount,
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

    // Retrieve bookings and snack orders
    const bookings = await prisma.booking.findMany({
      where: { id: { in: actualBookingIds } },
      include: { user: true }
    });

    const snackOrders = await prisma.snackOrder.findMany({
      where: { id: { in: snackOrderIds } },
      include: { user: true }
    });

    if (bookings.length !== actualBookingIds.length || snackOrders.length !== snackOrderIds.length) {
      return NextResponse.json({ error: "Some items were not found" }, { status: 404 });
    }

    const preExistingSnacksTotal = snackOrders.reduce((sum, s) => sum + Number(s.amount), 0);
    if (snacksAmount < preExistingSnacksTotal) {
      return NextResponse.json(
        { error: `Snacks amount cannot be less than pre-existing selected unpaid snacks (₹${preExistingSnacksTotal})` },
        { status: 400 }
      );
    }

    // Verify all bookings are unpaid or partial (unless paying only snacks)
    if (!isOnlySnacks) {
      const invalidStatus = bookings.filter((b) => b.paymentStatus === PaymentStatus.PAID);
      const invalidSnacks = snackOrders.filter((s) => s.paymentStatus === PaymentStatus.PAID);
      if (invalidStatus.length > 0 || invalidSnacks.length > 0) {
        return NextResponse.json(
          { error: "One or more selected items are already paid" },
          { status: 400 }
        );
      }
    }

    // Process coupon code on un-couponed bookings
    if (couponCode) {
      const cleanedCode = couponCode.trim().toUpperCase();
      const coupon = await prisma.coupon.findUnique({
        where: { code: cleanedCode }
      });

      if (!coupon) {
        return NextResponse.json({ error: "Invalid coupon code" }, { status: 400 });
      } else if (!coupon.isActive) {
        return NextResponse.json({ error: "This coupon code is inactive" }, { status: 400 });
      } else if (!coupon.allowedRoles.includes(role as any)) {
        return NextResponse.json({ error: "This coupon is not valid for your account role" }, { status: 400 });
      }

      // Identify eligible bookings: those without a coupon applied
      const eligibleBookings = bookings.filter(b => !b.couponId);
      
      if (eligibleBookings.length > 0) {
        const eligibleBasePriceSum = eligibleBookings.reduce((sum, b) => sum + Number(b.basePrice), 0);
        
        if (eligibleBasePriceSum >= Number(coupon.minBookingAmount)) {
          let totalDiscount = 0;
          if (coupon.discountType === "PERCENTAGE") {
            let discount = eligibleBasePriceSum * (Number(coupon.discountValue) / 100);
            if (coupon.maxDiscountAmount) {
              discount = Math.min(discount, Number(coupon.maxDiscountAmount));
            }
            totalDiscount = Math.round(discount * 100) / 100;
          } else {
            totalDiscount = Math.min(eligibleBasePriceSum, Math.round(Number(coupon.discountValue) * 100) / 100);
          }

          let usedCountIncremented = false;

          // Distribute discount proportionally
          for (let i = 0; i < eligibleBookings.length; i++) {
            const b = eligibleBookings[i];
            let bDiscount = 0;
            
            if (i === eligibleBookings.length - 1) {
              // Last item gets remainder to avoid rounding issues
              const sumOfOthers = eligibleBookings.slice(0, -1).reduce((sum, b2) => {
                return sum + Math.round((Number(b2.basePrice) / eligibleBasePriceSum) * totalDiscount * 100) / 100;
              }, 0);
              bDiscount = Number((totalDiscount - sumOfOthers).toFixed(2));
            } else {
              bDiscount = Math.round((Number(b.basePrice) / eligibleBasePriceSum) * totalDiscount * 100) / 100;
            }

            b.couponId = coupon.id;
            b.couponDiscount = bDiscount as any;
            b.finalAmount = (Number(b.basePrice) - bDiscount) as any;

            if (!usedCountIncremented) {
              await prisma.coupon.update({
                where: { id: coupon.id },
                data: { usedCount: { increment: 1 } }
              });
              usedCountIncremented = true;
            }
          }
        } else {
          return NextResponse.json({ error: `Minimum base amount of Rs. ${coupon.minBookingAmount} required for un-couponed bookings to apply this coupon.` }, { status: 400 });
        }
      }
    }

    // Compute total final amount of selected bookings
    const totalFinalAmount = bookings.reduce((sum, b) => sum + Number(b.finalAmount), 0);

    // Collect names for Payment record
    const allNames = new Set<string>();
    bookings.forEach(b => {
      const n = b.user?.name ?? b.guestName ?? "Guest";
      allNames.add(n);
    });
    snackOrders.forEach(s => {
      const n = s.user?.name ?? s.guestName ?? "Guest";
      allNames.add(n);
    });
    const customerNamesStr = Array.from(allNames).join(", ") || "Guest";

    // Create Payment record
    const payment = await prisma.payment.create({
      data: {
        paymentMethod,
        negotiatedAmount,
        cashAmount,
        onlineAmount,
        customerNames: customerNamesStr,
      }
    });
    const paymentId = payment.id;

    // Update bookings
    const updatePromises = bookings.map((b) => {
      let ratio = 1 / (bookings.length || 1);
      if (totalFinalAmount > 0) {
        ratio = Number(b.finalAmount) / totalFinalAmount;
      }

      const bNegotiated = Math.round(negotiatedAmount * ratio * 100) / 100;
      let bCash = 0;
      let bOnline = 0;

      if (paymentMethod === "CASH") {
        bCash = Number((bNegotiated).toFixed(2));
      } else if (paymentMethod === "ONLINE") {
        bOnline = Number((bNegotiated).toFixed(2));
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
          couponId: b.couponId,
          couponDiscount: b.couponDiscount,
          finalAmount: b.finalAmount,
          // DO NOT store snacksAmount on booking anymore
        },
      });
    });

    const updatedBookings = await prisma.$transaction(updatePromises);

    // Update selected existing SnackOrders
    if (snackOrderIds.length > 0) {
      await prisma.snackOrder.updateMany({
        where: { id: { in: snackOrderIds } },
        data: {
          paymentStatus: PaymentStatus.PAID,
          paymentId,
        }
      });
    }

    // Create a NEW SnackOrder for the newly entered snacksAmount if any
    const newSnacksAmount = Math.max(0, snacksAmount - preExistingSnacksTotal);
    if (newSnacksAmount > 0) {
      await prisma.snackOrder.create({
        data: {
          amount: newSnacksAmount,
          paymentStatus: PaymentStatus.PAID,
          paymentId,
          guestName: customerNamesStr || "Snack Sale",
        }
      });
    }

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "BATCH_PAY_BOOKINGS",
        entityType: "Payment",
        meta: {
          paymentId,
          bookingIds: actualBookingIds,
          snackOrderIds,
          negotiatedAmount,
          paymentMethod,
          cashAmount,
          onlineAmount,
          snacksAmount,
        },
      },
    });

    return NextResponse.json({ success: true, count: updatedBookings.length + snackOrderIds.length });
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
      include: { user: true }
    });

    if (bookings.length === 0) {
      return NextResponse.json({ error: "No bookings found for this payment ID" }, { status: 404 });
    }

    // Retrieve associated snack orders
    const snackOrders = await prisma.snackOrder.findMany({
      where: { paymentId },
    });

    // Update the Payment record itself
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        paymentMethod,
        negotiatedAmount,
        cashAmount,
        onlineAmount,
      }
    });

    // Compute total final amount of selected bookings
    const totalFinalAmount = bookings.reduce((sum, b) => sum + Number(b.finalAmount), 0);

    // Update bookings using a transaction
    const updatePromises = bookings.map((b, index) => {
      let ratio = 1 / bookings.length;
      if (totalFinalAmount > 0) {
        ratio = Number(b.finalAmount) / totalFinalAmount;
      }

      // Calculate proportional shares
      let bNegotiated = Math.round(negotiatedAmount * ratio * 100) / 100;
      if (index === bookings.length - 1) {
        const sumOfOthers = bookings.slice(0, -1).reduce((sum, b2) => {
          let r2 = 1 / bookings.length;
          if (totalFinalAmount > 0) r2 = Number(b2.finalAmount) / totalFinalAmount;
          return sum + Math.round(negotiatedAmount * r2 * 100) / 100;
        }, 0);
        bNegotiated = Number((negotiatedAmount - sumOfOthers).toFixed(2));
      }

      let bCash = 0;
      let bOnline = 0;

      if (paymentMethod === "CASH") {
        bCash = Number((bNegotiated).toFixed(2));
      } else if (paymentMethod === "ONLINE") {
        bOnline = Number((bNegotiated).toFixed(2));
      } else if (paymentMethod === "MIXED") {
        bCash = Math.round(cashAmount * ratio * 100) / 100;
        bOnline = Math.round(onlineAmount * ratio * 100) / 100;
        
        if (index === bookings.length - 1) {
          const cashOthers = bookings.slice(0, -1).reduce((sum, b2) => {
            let r2 = 1 / bookings.length;
            if (totalFinalAmount > 0) r2 = Number(b2.finalAmount) / totalFinalAmount;
            return sum + Math.round(cashAmount * r2 * 100) / 100;
          }, 0);
          const onlineOthers = bookings.slice(0, -1).reduce((sum, b2) => {
            let r2 = 1 / bookings.length;
            if (totalFinalAmount > 0) r2 = Number(b2.finalAmount) / totalFinalAmount;
            return sum + Math.round(onlineAmount * r2 * 100) / 100;
          }, 0);
          bCash = Number((cashAmount - cashOthers).toFixed(2));
          bOnline = Number((onlineAmount - onlineOthers).toFixed(2));
        }
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
          snacksAmount: 0,
        },
      });
    });

    const updatedBookings = await prisma.$transaction(updatePromises);

    // Update associated SnackOrders
    const totalExistingSnacks = snackOrders.reduce((sum, s) => sum + Number(s.amount), 0);
    if (snacksAmount === 0 && totalExistingSnacks > 0) {
      // Unlink existing snack orders from this payment and mark them UNPAID
      await prisma.snackOrder.updateMany({
        where: { paymentId },
        data: {
          paymentId: null,
          paymentStatus: PaymentStatus.UNPAID,
        }
      });
    } else if (totalExistingSnacks > 0) {
      const ratio = snacksAmount / totalExistingSnacks;
      const snackUpdatePromises = snackOrders.map((s, index) => {
        let newAmount = Math.round(Number(s.amount) * ratio * 100) / 100;
        if (index === snackOrders.length - 1) {
          const sumOfOthers = snackOrders.slice(0, -1).reduce((sum, s2) => sum + Math.round(Number(s2.amount) * ratio * 100) / 100, 0);
          newAmount = Number((snacksAmount - sumOfOthers).toFixed(2));
        }
        return prisma.snackOrder.update({
          where: { id: s.id },
          data: {
            amount: Math.max(0, newAmount),
            paymentStatus: PaymentStatus.PAID,
          }
        });
      });
      await Promise.all(snackUpdatePromises);
    } else if (snacksAmount > 0) {
      // Create a new snack order for this payment since none existed but now snacksAmount is specified
      const firstBooking = bookings[0];
      const allNames = new Set<string>();
      bookings.forEach(b => {
        const n = b.user?.name ?? b.guestName ?? "Guest";
        allNames.add(n);
      });
      const customerNamesStr = Array.from(allNames).join(", ");
      await prisma.snackOrder.create({
        data: {
          amount: snacksAmount,
          paymentStatus: PaymentStatus.PAID,
          paymentId,
          userId: firstBooking.userId,
          guestName: firstBooking.userId ? null : (firstBooking.guestName || customerNamesStr || "Snack Sale"),
          guestPhone: firstBooking.userId ? null : firstBooking.guestPhone,
        }
      });
    }

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
