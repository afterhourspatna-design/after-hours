import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { subDays, eachDayOfInterval } from "date-fns";

function getISTStartOfDay(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === "year")!.value, 10);
  const month = parseInt(parts.find(p => p.type === "month")!.value, 10) - 1;
  const day = parseInt(parts.find(p => p.type === "day")!.value, 10);

  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
}

function formatInIST(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === "year")!.value;
  const month = parts.find(p => p.type === "month")!.value;
  const day = parts.find(p => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const days = parseInt(searchParams.get("days") ?? "30");

  const now = new Date();
  const todayStartIST = getISTStartOfDay(now);
  const since = subDays(todayStartIST, days - 1);

  const bookings = await prisma.booking.findMany({
    where: {
      startDateTime: { gte: since },
      bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
    },
    select: { 
      id: true,
      startDateTime: true, 
      durationMinutes: true,
      basePrice: true,
      discountAmount: true,
      couponDiscount: true,
      finalAmount: true, 
      negotiatedAmount: true, 
      paymentStatus: true, 
      gameId: true, 
      userId: true,
      guestName: true,
      guestPhone: true,
      source: true,
      coupon: { select: { code: true } },
      user: { select: { name: true, phone: true } },
      allocations: {
        include: { payment: true }
      }
    },
  });

  const standaloneSnacks = await prisma.snackOrder.findMany({
    where: {
      createdAt: { gte: since },
    },
    select: { 
      createdAt: true, 
      amount: true,
      paymentStatus: true,
      allocations: {
        include: { payment: true }
      }
    }
  });

  const dayMap: Record<string, { game: number; snacks: number }> = {};
  const interval = eachDayOfInterval({ start: since, end: now });
  for (const day of interval) {
    dayMap[formatInIST(day)] = { game: 0, snacks: 0 };
  }
  
  let grossRevenue = 0;
  let totalDiscounts = 0;
  let cashTotal = 0;
  let onlineTotal = 0;
  let totalPaidBookingsCount = 0;
  let totalDurationMinutes = 0;

  const peakHoursMap: Record<string, number> = {};
  for (let i = 10; i <= 23; i++) peakHoursMap[i.toString().padStart(2, '0') + ":00"] = 0;

  const sourceMap: Record<string, number> = {
    WALK_IN: 0, PHONE: 0, INSTAGRAM: 0, ONLINE: 0, REFERRAL: 0
  };

  const spendersMap: Record<string, { name: string, phone: string, spent: number }> = {};
  const promoMap: Record<string, { code: string, uses: number, discountGiven: number }> = {};

  for (const b of bookings) {
    const key = formatInIST(b.startDateTime);
    if (!(key in dayMap)) continue;

    const totalPaid = b.allocations.reduce((s: number, a: any) => s + Number(a.amount), 0);
    dayMap[key].game += totalPaid;

    // Source breakdown
    sourceMap[b.source] = (sourceMap[b.source] || 0) + 1;

    // Peak hours (Using IST hour)
    const istTime = new Date(b.startDateTime.getTime() + (5.5 * 60 * 60 * 1000));
    const hour = istTime.getUTCHours();
    const hourKey = hour.toString().padStart(2, '0') + ":00";
    if (peakHoursMap[hourKey] !== undefined) {
      peakHoursMap[hourKey]++;
    }

    // Only count as "paid booking" for AOV if it has any payment
    if (totalPaid > 0 || b.paymentStatus === "PAID") {
      totalPaidBookingsCount++;
      totalDurationMinutes += b.durationMinutes;

      const standardDiscounts = Number(b.discountAmount) + Number(b.couponDiscount);
      const trueGross = Number(b.finalAmount) + standardDiscounts;
      grossRevenue += trueGross;
      
      const manualDiscount = b.negotiatedAmount !== null ? Number(b.finalAmount) - Number(b.negotiatedAmount) : 0;
      totalDiscounts += standardDiscounts + manualDiscount;
      
      for (const allocation of b.allocations) {
        const allocAmount = Number(allocation.amount);
        const paymentMethod = allocation.payment.paymentMethod;
        const pCash = Number(allocation.payment.cashAmount || 0);
        const pOnline = Number(allocation.payment.onlineAmount || 0);
        const pTotal = pCash + pOnline;

        if (paymentMethod === "CASH") {
          cashTotal += allocAmount;
        } else if (paymentMethod === "ONLINE") {
          onlineTotal += allocAmount;
        } else if (paymentMethod === "MIXED") {
          if (pTotal > 0) {
            const cashRatio = pCash / pTotal;
            cashTotal += allocAmount * cashRatio;
            onlineTotal += allocAmount * (1 - cashRatio);
          } else {
            cashTotal += allocAmount;
          }
        } else {
          cashTotal += allocAmount;
        }
      }

      // Spenders mapping (combining registered + unregistered by phone)
      let identifier = "";
      let spName = "";
      let spPhone = "";
      if (b.userId && b.user) {
        identifier = b.user.phone || b.userId;
        spName = b.user.name;
        spPhone = b.user.phone;
      } else if (b.guestPhone) {
        identifier = b.guestPhone;
        spName = b.guestName || "Guest";
        spPhone = b.guestPhone;
      }

      if (identifier) {
        if (!spendersMap[identifier]) {
          spendersMap[identifier] = { name: spName, phone: spPhone, spent: 0 };
        }
        spendersMap[identifier].spent += totalPaid;
      }

      // Promo mapping
      if (b.coupon && b.coupon.code) {
        const cCode = b.coupon.code;
        if (!promoMap[cCode]) {
          promoMap[cCode] = { code: cCode, uses: 0, discountGiven: 0 };
        }
        promoMap[cCode].uses++;
        promoMap[cCode].discountGiven += Number(b.couponDiscount);
      }
    }
  }

  // Snacks addition
  for (const s of standaloneSnacks) {
    const key = formatInIST(s.createdAt);
    if (!(key in dayMap)) continue;

    const totalPaid = s.allocations.reduce((sum: number, a: any) => sum + Number(a.amount), 0);
    dayMap[key].snacks += totalPaid;
    
    if (totalPaid > 0 || s.paymentStatus === "PAID") {
      grossRevenue += Number(s.amount);

      for (const allocation of s.allocations) {
        const allocAmount = Number(allocation.amount);
        const paymentMethod = allocation.payment.paymentMethod;
        const pCash = Number(allocation.payment.cashAmount || 0);
        const pOnline = Number(allocation.payment.onlineAmount || 0);
        const pTotal = pCash + pOnline;

        if (paymentMethod === "CASH") {
          cashTotal += allocAmount;
        } else if (paymentMethod === "ONLINE") {
          onlineTotal += allocAmount;
        } else if (paymentMethod === "MIXED") {
          if (pTotal > 0) {
            const cashRatio = pCash / pTotal;
            cashTotal += allocAmount * cashRatio;
            onlineTotal += allocAmount * (1 - cashRatio);
          } else {
            cashTotal += allocAmount;
          }
        } else {
          cashTotal += allocAmount;
        }
      }
    }
  }

  const daily = Object.entries(dayMap).map(([date, data]) => ({ 
    date, 
    revenue: data.game + data.snacks,
    gameRevenue: data.game,
    snacksRevenue: data.snacks
  }));
  
  const totalNetRevenue = daily.reduce((s, d) => s + d.revenue, 0);
  const aov = totalPaidBookingsCount > 0 ? Math.round(totalNetRevenue / totalPaidBookingsCount) : 0;
  const avgDuration = totalPaidBookingsCount > 0 ? Math.round(totalDurationMinutes / totalPaidBookingsCount) : 0;

  const peakHours = Object.entries(peakHoursMap).map(([hour, count]) => ({ hour, count }));
  
  const sources = Object.entries(sourceMap)
    .filter(([_, count]) => count > 0)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  const topSpenders = Object.values(spendersMap)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  const topPromos = Object.values(promoMap)
    .sort((a, b) => b.discountGiven - a.discountGiven)
    .slice(0, 5);

  // Revenue by game
  const games = await prisma.game.findMany({ select: { id: true, name: true, tag: true } });
  const revenueByGame = games.map((g) => {
    const gameBookings = bookings.filter((b) => b.gameId === g.id);
    const revenue = gameBookings.reduce((sum, b) => {
      const totalPaid = b.allocations.reduce((s: number, a: any) => s + Number(a.amount), 0);
      return sum + totalPaid;
    }, 0);
    return {
      game: g.name,
      tag: g.tag,
      revenue,
    };
  }).filter((g) => g.revenue > 0).sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({ 
    daily, 
    totalRevenue: totalNetRevenue, 
    revenueByGame,
    grossRevenue,
    totalDiscounts,
    netRevenue: totalNetRevenue,
    cashTotal,
    onlineTotal,
    aov,
    avgDuration,
    peakHours,
    sources,
    topSpenders,
    topPromos
  });
}
