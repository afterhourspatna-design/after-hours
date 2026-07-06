import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, BookingStatus } from "@prisma/client";
import { z } from "zod";

const batchPaySchema = z.object({
  bookingIds: z.array(z.string()).optional(),
  negotiatedAmount: z.number().nonnegative(),
  paymentMethod: z.enum(["CASH", "ONLINE", "MIXED"]),
  amountPayingNow: z.number().nonnegative().optional(),
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
  amountPayingNow: z.number().nonnegative().optional(),
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
      amountPayingNow,
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

      const paidToday = amountPayingNow !== undefined ? amountPayingNow : snacksAmount;
      if (paidToday > snacksAmount) {
        return NextResponse.json({ error: "Cannot pay more than total snacks amount" }, { status: 400 });
      }
      
      // Create Payment record
      const payment = await prisma.payment.create({
        data: {
          paymentMethod,
          negotiatedAmount: 0,
          cashAmount: paymentMethod === "MIXED" ? cashAmount : paymentMethod === "CASH" ? paidToday : 0,
          onlineAmount: paymentMethod === "MIXED" ? onlineAmount : paymentMethod === "ONLINE" ? paidToday : 0,
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
          paymentStatus: paidToday >= snacksAmount ? PaymentStatus.PAID : (paidToday > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID),
          items: {
            create: {
              amount: snacksAmount,
              notes: "Initial Amount",
              addedById: (session.user as any).id,
            }
          }
        },
      });

      if (paidToday > 0) {
        await prisma.paymentAllocation.create({
          data: { amount: paidToday, paymentId, snackOrderId: newSnack.id }
        });
      }

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
    const totalInvoice = Number((negotiatedAmount + snacksAmount).toFixed(2));
    const paidToday = amountPayingNow !== undefined ? amountPayingNow : totalInvoice;

    if (paymentMethod === "MIXED") {
      const sum = Number((cashAmount + onlineAmount).toFixed(2));
      if (Math.abs(sum - paidToday) > 0.01) {
        return NextResponse.json(
          { error: "Cash + Online amounts must equal the amount paying now" },
          { status: 400 }
        );
      }
    }

    // Retrieve bookings and snack orders
    const bookings = await prisma.booking.findMany({
      where: { id: { in: actualBookingIds } },
      include: { user: true, allocations: true }
    });

    const snackOrders = await prisma.snackOrder.findMany({
      where: { id: { in: snackOrderIds } },
      include: { user: true, allocations: true }
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
        negotiatedAmount: negotiatedAmount,
        cashAmount: paymentMethod === "MIXED" ? cashAmount : paymentMethod === "CASH" ? paidToday : 0,
        onlineAmount: paymentMethod === "MIXED" ? onlineAmount : paymentMethod === "ONLINE" ? paidToday : 0,
        customerNames: customerNamesStr,
      }
    });
    const paymentId = payment.id;

    // We need to distribute paidToday using Waterfall: Snacks first, then Bookings
    const allocationsToCreate: any[] = [];
    let remainingPaidToday = paidToday;

    // 1. Process Existing Snacks
    if (snackOrderIds.length > 0) {
      const snackUpdatePromises = snackOrders.map(s => {
         const previouslyPaid = s.allocations.reduce((sum: number, a: any) => sum + Number(a.amount), 0);
         const amountNeeded = Number(s.amount) - previouslyPaid;
         const allocation = Math.min(amountNeeded > 0 ? amountNeeded : 0, remainingPaidToday);
         
         allocationsToCreate.push({ amount: allocation, paymentId, snackOrderId: s.id });
         remainingPaidToday = Number((remainingPaidToday - allocation).toFixed(2));

         const totalPaidSoFar = previouslyPaid + allocation;
         let newStatus: PaymentStatus = PaymentStatus.UNPAID;
         if (Math.abs(totalPaidSoFar - Number(s.amount)) < 0.01 || totalPaidSoFar >= Number(s.amount)) {
            newStatus = PaymentStatus.PAID;
         } else if (totalPaidSoFar > 0) {
            newStatus = PaymentStatus.PARTIAL;
         }

         return prisma.snackOrder.update({ where: { id: s.id }, data: { paymentStatus: newStatus } });
      });
      await prisma.$transaction(snackUpdatePromises);
    }

    // 2. Process New Snacks
    const newSnacksAmount = Math.max(0, snacksAmount - preExistingSnacksTotal);
    if (newSnacksAmount > 0) {
      const allocation = Math.min(newSnacksAmount, remainingPaidToday);
      let newStatus: PaymentStatus = PaymentStatus.UNPAID;
      if (Math.abs(allocation - newSnacksAmount) < 0.01 || allocation >= newSnacksAmount) {
         newStatus = PaymentStatus.PAID;
      } else if (allocation > 0) {
         newStatus = PaymentStatus.PARTIAL;
      }

      const newSnack = await prisma.snackOrder.create({
        data: {
          amount: newSnacksAmount,
          paymentStatus: newStatus,
          guestName: customerNamesStr || "Snack Sale",
          items: {
            create: {
              amount: newSnacksAmount,
              notes: "Added at checkout",
              addedById: (session.user as any).id,
            }
          }
        }
      });

      allocationsToCreate.push({ amount: allocation, paymentId, snackOrderId: newSnack.id });
      remainingPaidToday = Number((remainingPaidToday - allocation).toFixed(2));
    }

    // 3. Process Bookings
    let sumOfBNegotiated = 0;
    const updatePromises = bookings.map((b, index) => {
      let bNegotiated = 0;
      if (index === bookings.length - 1) {
        bNegotiated = Number((negotiatedAmount - sumOfBNegotiated).toFixed(2));
      } else {
        let ratio = 1 / (bookings.length || 1);
        if (totalFinalAmount > 0) {
          ratio = Number(b.finalAmount) / totalFinalAmount;
        }
        bNegotiated = Math.round(negotiatedAmount * ratio * 100) / 100;
        sumOfBNegotiated += bNegotiated;
      }
      
      const previouslyPaid = b.allocations.reduce((s: number, a: any) => s + Number(a.amount), 0);
      const amountNeeded = bNegotiated - previouslyPaid;
      const allocation = Math.min(amountNeeded > 0 ? amountNeeded : 0, remainingPaidToday);
      
      allocationsToCreate.push({ amount: allocation, paymentId, bookingId: b.id });
      remainingPaidToday = Number((remainingPaidToday - allocation).toFixed(2));

      const totalPaidSoFar = previouslyPaid + allocation;
      let newStatus: PaymentStatus = PaymentStatus.UNPAID;
      // Use < 0.011 to safely cover float inaccuracies around 0.01
      if (Math.abs(totalPaidSoFar - bNegotiated) < 0.011 || totalPaidSoFar >= bNegotiated) {
        newStatus = PaymentStatus.PAID;
      } else if (totalPaidSoFar > 0) {
        newStatus = PaymentStatus.PARTIAL;
      }

      const now = new Date();
      const shouldComplete = !isOnlySnacks && new Date(b.endDateTime) <= now;

      let finalBookingStatus = b.bookingStatus;
      if (!isOnlySnacks) {
        if (shouldComplete) {
          finalBookingStatus = BookingStatus.COMPLETED;
        } else if (b.bookingStatus === "HOLD") {
          finalBookingStatus = BookingStatus.CONFIRMED;
        }
      }

      return prisma.booking.update({
        where: { id: b.id },
        data: {
          paymentStatus: isOnlySnacks ? b.paymentStatus : newStatus,
          bookingStatus: finalBookingStatus,
          negotiatedAmount: bNegotiated,
          couponId: b.couponId,
          couponDiscount: b.couponDiscount,
          finalAmount: b.finalAmount,
        },
      });
    });

    await prisma.$transaction(updatePromises);

    // Finally insert all allocations
    if (allocationsToCreate.length > 0) {
      await prisma.paymentAllocation.createMany({ data: allocationsToCreate });
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
          snacksAmount,
          amountPayingNow,
          paymentMethod,
          cashAmount,
          onlineAmount
        },
      },
    });

    return NextResponse.json({ success: true, count: bookings.length + snackOrders.length + (newSnacksAmount > 0 ? 1 : 0) });
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

    const { paymentId, negotiatedAmount, snacksAmount, paymentMethod, cashAmount = 0, onlineAmount = 0, amountPayingNow } = parsed.data;

    const allocations = await prisma.paymentAllocation.findMany({
      where: { paymentId },
      include: { booking: true, snackOrder: true }
    });

    if (allocations.length === 0) {
      return NextResponse.json({ error: "No allocations found for this payment ID" }, { status: 404 });
    }

    const bookings = Array.from(new Map(allocations.map(a => a.booking).filter(Boolean).map((b: any) => [b.id, b])).values());
    const snackOrders = Array.from(new Map(allocations.map(a => a.snackOrder).filter(Boolean).map((s: any) => [s.id, s])).values());

    const totalInvoice = Number((negotiatedAmount + snacksAmount).toFixed(2));
    const paidToday = amountPayingNow !== undefined ? amountPayingNow : totalInvoice;

    if (paymentMethod === "MIXED") {
      const sum = Number((cashAmount + onlineAmount).toFixed(2));
      if (Math.abs(sum - paidToday) > 0.01) {
        return NextResponse.json(
          { error: "Cash + Online amounts must equal the amount paying now" },
          { status: 400 }
        );
      }
    }

    // 1. Update Payment record
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        paymentMethod,
        negotiatedAmount: negotiatedAmount,
        cashAmount: paymentMethod === "MIXED" ? cashAmount : paymentMethod === "CASH" ? paidToday : 0,
        onlineAmount: paymentMethod === "MIXED" ? onlineAmount : paymentMethod === "ONLINE" ? paidToday : 0,
      }
    });

    // 2. Delete existing allocations for this payment
    await prisma.paymentAllocation.deleteMany({
      where: { paymentId }
    });

    const isOnlySnacks = negotiatedAmount === 0 && snacksAmount > 0;
    const allocationsToCreate: any[] = [];
    let remainingPaidToday = paidToday;

    const totalFinalAmount = bookings.reduce((sum, b) => sum + Number(b.finalAmount), 0);

    // Re-fetch active bookings and snack orders
    const activeBookings = await prisma.booking.findMany({
       where: { id: { in: bookings.map((b: any) => b.id) } },
       include: { allocations: { where: { paymentId: { not: paymentId } } } }
    });
    
    const activeSnacks = await prisma.snackOrder.findMany({
       where: { id: { in: snackOrders.map((s: any) => s.id) } },
       include: { allocations: { where: { paymentId: { not: paymentId } } } }
    });

    // 3. Process Snacks First
    if (activeSnacks.length > 0) {
      const snackUpdatePromises = activeSnacks.map((s) => {
         const previouslyPaid = s.allocations.reduce((sum: number, a: any) => sum + Number(a.amount), 0);
         const amountNeeded = Number(s.amount) - previouslyPaid;
         const allocation = Math.min(amountNeeded > 0 ? amountNeeded : 0, remainingPaidToday);

         allocationsToCreate.push({ amount: allocation, paymentId, snackOrderId: s.id });
         remainingPaidToday = Number((remainingPaidToday - allocation).toFixed(2));

         const totalPaidSoFar = previouslyPaid + allocation;
         let newStatus: PaymentStatus = PaymentStatus.UNPAID;
         if (Math.abs(totalPaidSoFar - Number(s.amount)) < 0.01 || totalPaidSoFar >= Number(s.amount)) {
           newStatus = PaymentStatus.PAID;
         } else if (totalPaidSoFar > 0) {
           newStatus = PaymentStatus.PARTIAL;
         }

         return prisma.snackOrder.update({
           where: { id: s.id },
           data: { paymentStatus: newStatus }
         });
      });
      await prisma.$transaction(snackUpdatePromises);
    }

    // 4. Process Bookings
    let sumOfBNegotiated = 0;
    const updatePromises = activeBookings.map((b, index) => {
      let bNegotiated = 0;
      if (index === activeBookings.length - 1) {
        bNegotiated = Number((negotiatedAmount - sumOfBNegotiated).toFixed(2));
      } else {
        let ratio = 1 / (activeBookings.length || 1);
        if (totalFinalAmount > 0) ratio = Number(b.finalAmount) / totalFinalAmount;
        bNegotiated = Math.round(negotiatedAmount * ratio * 100) / 100;
        sumOfBNegotiated += bNegotiated;
      }
      
      const previouslyPaid = b.allocations.reduce((s: number, a: any) => s + Number(a.amount), 0);
      const amountNeeded = bNegotiated - previouslyPaid;
      const allocation = Math.min(amountNeeded > 0 ? amountNeeded : 0, remainingPaidToday);

      allocationsToCreate.push({ amount: allocation, paymentId, bookingId: b.id });
      remainingPaidToday = Number((remainingPaidToday - allocation).toFixed(2));

      const totalPaidSoFar = previouslyPaid + allocation;
      let newStatus: PaymentStatus = PaymentStatus.UNPAID;
      if (Math.abs(totalPaidSoFar - bNegotiated) < 0.011 || totalPaidSoFar >= bNegotiated) {
        newStatus = PaymentStatus.PAID;
      } else if (totalPaidSoFar > 0) {
        newStatus = PaymentStatus.PARTIAL;
      }

      const now = new Date();
      const shouldComplete = !isOnlySnacks && new Date(b.endDateTime) <= now;

      let finalBookingStatus = b.bookingStatus;
      if (!isOnlySnacks) {
        if (shouldComplete) {
          finalBookingStatus = BookingStatus.COMPLETED;
        } else if (b.bookingStatus === "HOLD") {
          finalBookingStatus = BookingStatus.CONFIRMED;
        }
      }

      return prisma.booking.update({
        where: { id: b.id },
        data: {
          paymentStatus: isOnlySnacks ? b.paymentStatus : newStatus,
          bookingStatus: finalBookingStatus,
          negotiatedAmount: bNegotiated,
        },
      });
    });

    await prisma.$transaction(updatePromises);

    if (allocationsToCreate.length > 0) {
      await prisma.paymentAllocation.createMany({ data: allocationsToCreate });
    }

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "EDIT_BATCH_PAY_BOOKINGS",
        entityType: "Booking",
        meta: { paymentId, negotiatedAmount, snacksAmount, amountPayingNow, paymentMethod, cashAmount, onlineAmount },
      },
    });

    return NextResponse.json({ success: true, count: bookings.length + snackOrders.length });
  } catch (error: any) {
    console.error("Batch payment edit failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
