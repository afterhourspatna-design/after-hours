import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, BookingStatus } from "@prisma/client";
import { z } from "zod";

const snackItemSchema = z.object({
  amount: z.number().positive(),
  notes: z.string().trim().max(300).optional().nullable(),
});

const batchPaySchema = z.object({
  bookingIds: z.array(z.string()).optional(),
  negotiatedAmount: z.number().nonnegative(),
  paymentMethod: z.enum(["CASH", "ONLINE", "MIXED"]),
  amountPayingNow: z.number().nonnegative().optional(),
  cashAmount: z.number().nonnegative().optional(),
  onlineAmount: z.number().nonnegative().optional(),
  // New snack items being added at checkout (on top of any pre-existing
  // unpaid snack orders referenced via bookingIds' SNACK_ entries). Replaces
  // the old flat `snacksAmount` number so each item carries its own
  // description instead of a single unlabeled lump sum.
  snackItems: z.array(snackItemSchema).optional().default([]),
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
      snackItems = [],
      userId = null,
      guestName = null,
      guestPhone = null,
      couponCode = null,
    } = parsed.data;

    const newSnackItemRows = snackItems.map((i) => ({
      amount: i.amount,
      notes: i.notes?.trim() || null,
      addedById: (session.user as any).id,
    }));
    const newSnacksTotal = Number(snackItems.reduce((sum, i) => sum + i.amount, 0).toFixed(2));

    const actualBookingIds = allIds.filter(id => !id.startsWith("SNACK_"));
    const snackOrderIds = allIds.filter(id => id.startsWith("SNACK_")).map(id => id.replace("SNACK_", ""));

    // Check if standalone snacks sale (no bookings and no unpaid snacks selected)
    if (actualBookingIds.length === 0 && snackOrderIds.length === 0) {
      if (newSnacksTotal <= 0) {
        return NextResponse.json({ error: "Add at least one snack item for a snack-only sale" }, { status: 400 });
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

      // Join the customer's existing open tab (if any) instead of leaving two
      // separate unpaid snack orders lying around for the same person.
      const existingOrder = resolvedUserId
        ? await prisma.snackOrder.findFirst({
            where: { userId: resolvedUserId, paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] } },
            include: { allocations: true },
          })
        : null;

      const previouslyPaidOnOrder = existingOrder
        ? existingOrder.allocations.reduce((sum, a) => sum + Number(a.amount), 0)
        : 0;
      const orderTotal = Number(((existingOrder ? Number(existingOrder.amount) : 0) + newSnacksTotal).toFixed(2));
      const outstandingNow = Number((orderTotal - previouslyPaidOnOrder).toFixed(2));

      const paidToday = amountPayingNow !== undefined ? amountPayingNow : outstandingNow;
      if (paidToday > outstandingNow + 0.01) {
        return NextResponse.json({ error: "Cannot pay more than the outstanding snacks amount" }, { status: 400 });
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

      const totalPaidSoFar = Number((previouslyPaidOnOrder + paidToday).toFixed(2));
      const newStatus: PaymentStatus =
        totalPaidSoFar >= orderTotal - 0.01 ? PaymentStatus.PAID
        : totalPaidSoFar > 0 ? PaymentStatus.PARTIAL
        : PaymentStatus.UNPAID;

      const snackOrder = existingOrder
        ? await prisma.snackOrder.update({
            where: { id: existingOrder.id },
            data: {
              amount: orderTotal,
              paymentStatus: newStatus,
              items: { createMany: { data: newSnackItemRows } },
            },
          })
        : await prisma.snackOrder.create({
            data: {
              userId: resolvedUserId,
              guestName: resolvedUserId ? null : guestName,
              guestPhone: resolvedUserId ? null : guestPhone,
              amount: newSnacksTotal,
              paymentStatus: newStatus,
              items: { createMany: { data: newSnackItemRows } },
            },
          });

      if (paidToday > 0) {
        await prisma.paymentAllocation.create({
          data: { amount: paidToday, paymentId, snackOrderId: snackOrder.id }
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
            snackOrderId: snackOrder.id,
            joinedExistingOrder: !!existingOrder,
            snackItems,
            newSnacksTotal,
            paymentMethod,
            cashAmount,
            onlineAmount,
          },
        },
      });

      return NextResponse.json({ success: true, count: 1 });
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

    // Total snack invoice for this payment = whatever's already on the selected
    // pre-existing tab(s) + the new items being added right now at checkout.
    const preExistingSnacksTotal = snackOrders.reduce((sum, s) => sum + Number(s.amount), 0);
    const snacksAmount = Number((preExistingSnacksTotal + newSnacksTotal).toFixed(2));

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

    // Verify bookings if we are paying for them
    if (!isOnlySnacks) {
      const invalidStatus = bookings.filter((b) => b.paymentStatus === PaymentStatus.PAID);
      if (invalidStatus.length > 0) {
        return NextResponse.json(
          { error: "One or more selected bookings are already paid" },
          { status: 400 }
        );
      }
    }

    // Always verify snacks if we are paying for them
    if (snacksAmount > 0) {
      const invalidSnacks = snackOrders.filter((s) => s.paymentStatus === PaymentStatus.PAID);
      if (invalidSnacks.length > 0) {
        return NextResponse.json(
          { error: "One or more selected snacks are already paid" },
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

    // If new snack items are being added at checkout AND the customer already
    // has a pre-existing tab selected in this same payment, fold the new
    // items into that tab instead of creating a second, disconnected order.
    // We do this before the waterfall below so its allocation/status math
    // (which reads `s.amount`) sees the updated total.
    const joiningExistingSnackOrder = newSnacksTotal > 0 && snackOrders.length > 0;
    if (joiningExistingSnackOrder) {
      const target = snackOrders[0];
      const updatedAmount = Number((Number(target.amount) + newSnacksTotal).toFixed(2));
      await prisma.snackOrder.update({
        where: { id: target.id },
        data: {
          amount: updatedAmount,
          items: { createMany: { data: newSnackItemRows } },
        },
      });
      target.amount = updatedAmount as any; // reflect in-memory for the waterfall below
    }

    // We need to distribute paidToday using Waterfall: Snacks first, then Bookings
    const allocationsToCreate: any[] = [];
    let remainingPaidToday = paidToday;

    // 1. Process Existing (and now possibly topped-up) Snacks
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

    // 2. Process New Snacks that had no existing tab to join — create a fresh
    // order carrying each item's own description (no more one fake lump line).
    if (newSnacksTotal > 0 && !joiningExistingSnackOrder) {
      const allocation = Math.min(newSnacksTotal, remainingPaidToday);
      let newStatus: PaymentStatus = PaymentStatus.UNPAID;
      if (Math.abs(allocation - newSnacksTotal) < 0.01 || allocation >= newSnacksTotal) {
         newStatus = PaymentStatus.PAID;
      } else if (allocation > 0) {
         newStatus = PaymentStatus.PARTIAL;
      }

      // Tag the order with the primary customer (first selected booking or
      // tab's owner) so it groups with their other items in the Unpaid tab,
      // and so a future checkout for this same person can find and join it —
      // not just a display string, or this new tab becomes an orphan.
      const primaryUserId = bookings[0]?.userId ?? snackOrders[0]?.userId ?? null;
      const primaryGuestPhone = primaryUserId ? null : (bookings[0]?.guestPhone ?? snackOrders[0]?.guestPhone ?? null);

      const newSnack = await prisma.snackOrder.create({
        data: {
          amount: newSnacksTotal,
          paymentStatus: newStatus,
          userId: primaryUserId,
          guestName: primaryUserId ? null : (customerNamesStr || "Snack Sale"),
          guestPhone: primaryGuestPhone,
          items: { createMany: { data: newSnackItemRows } },
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
          newSnackItems: snackItems,
          joinedExistingSnackOrder: joiningExistingSnackOrder,
          amountPayingNow,
          paymentMethod,
          cashAmount,
          onlineAmount
        },
      },
    });

    return NextResponse.json({ success: true, count: bookings.length + snackOrders.length + (newSnacksTotal > 0 && !joiningExistingSnackOrder ? 1 : 0) });
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
