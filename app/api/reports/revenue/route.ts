import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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

  // 1. Daily Revenue (Cash vs Online Split)
  const rawDaily: any[] = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC('day', COALESCE(b."startDateTime", s."createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as date,
      SUM(
        CASE 
          WHEN p."paymentMethod" = 'CASH' THEN pa.amount
          WHEN p."paymentMethod" = 'MIXED' AND (COALESCE(p."cashAmount",0) + COALESCE(p."onlineAmount",0)) > 0 
               THEN pa.amount * (COALESCE(p."cashAmount",0) / (COALESCE(p."cashAmount",0) + COALESCE(p."onlineAmount",0)))
          WHEN p."paymentMethod" = 'MIXED' THEN pa.amount
          ELSE 0
        END
      ) as cash,
      SUM(
        CASE 
          WHEN p."paymentMethod" = 'ONLINE' THEN pa.amount
          WHEN p."paymentMethod" = 'MIXED' AND (COALESCE(p."cashAmount",0) + COALESCE(p."onlineAmount",0)) > 0 
               THEN pa.amount * (COALESCE(p."onlineAmount",0) / (COALESCE(p."cashAmount",0) + COALESCE(p."onlineAmount",0)))
          ELSE 0
        END
      ) as online,
      SUM(CASE WHEN pa."bookingId" IS NOT NULL THEN pa.amount ELSE 0 END) as game_revenue,
      SUM(CASE WHEN pa."snackOrderId" IS NOT NULL THEN pa.amount ELSE 0 END) as snack_revenue,
      SUM(pa.amount) as total
    FROM "payment_allocations" pa
    JOIN "payments" p ON pa."paymentId" = p.id
    LEFT JOIN "bookings" b ON pa."bookingId" = b.id
    LEFT JOIN "snack_orders" s ON pa."snackOrderId" = s.id
    WHERE COALESCE(b."startDateTime", s."createdAt") >= ${since} 
      AND COALESCE(b."startDateTime", s."createdAt") <= ${now}
    GROUP BY DATE_TRUNC('day', COALESCE(b."startDateTime", s."createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')
  `;

  // We still want to fill missing days with 0
  const dayMap: Record<string, { cash: number, online: number, game_revenue: number, snack_revenue: number, total: number }> = {};
  const interval = eachDayOfInterval({ start: since, end: now });
  for (const day of interval) {
    dayMap[formatInIST(day)] = { cash: 0, online: 0, game_revenue: 0, snack_revenue: 0, total: 0 };
  }
  for (const row of rawDaily) {
    const key = formatInIST(new Date(row.date));
    if (dayMap[key]) {
      dayMap[key] = {
        cash: Number(row.cash) || 0,
        online: Number(row.online) || 0,
        game_revenue: Number(row.game_revenue) || 0,
        snack_revenue: Number(row.snack_revenue) || 0,
        total: Number(row.total) || 0
      };
    }
  }
  const daily = Object.entries(dayMap).map(([date, data]) => ({
    date,
    revenue: data.total,
    gameRevenue: data.game_revenue,
    snacksRevenue: data.snack_revenue
  }));

  let totalNetRevenue = 0;
  let cashTotal = 0;
  let onlineTotal = 0;
  for (const d of Object.values(dayMap)) {
    totalNetRevenue += d.total;
    cashTotal += d.cash;
    onlineTotal += d.online;
  }

  // 2. Revenue By Game
  const rawGameRevenue: any[] = await prisma.$queryRaw`
    SELECT g.name as game, g.tag as tag, COALESCE(SUM(pa.amount), 0) as revenue
    FROM "games" g
    JOIN "bookings" b ON b."gameId" = g.id
    JOIN "payment_allocations" pa ON pa."bookingId" = b.id
    WHERE b."startDateTime" >= ${since} AND b."startDateTime" <= ${now}
    GROUP BY g.id, g.name, g.tag
    ORDER BY revenue DESC
  `;
  const revenueByGame = rawGameRevenue.map(r => ({
    game: r.game, tag: r.tag, revenue: Number(r.revenue)
  })).filter(g => g.revenue > 0);

  // 3. Top Spenders
  const rawSpenders: any[] = await prisma.$queryRaw`
    SELECT 
      COALESCE(u.name, b."guestName", 'Guest') as name,
      COALESCE(u.phone, b."guestPhone", 'Unknown') as phone,
      SUM(pa.amount) as spent
    FROM "payment_allocations" pa
    JOIN "bookings" b ON pa."bookingId" = b.id
    LEFT JOIN "app_users" u ON b."userId" = u.id
    WHERE b."startDateTime" >= ${since} AND b."startDateTime" <= ${now}
    GROUP BY COALESCE(u.name, b."guestName", 'Guest'), COALESCE(u.phone, b."guestPhone", 'Unknown')
    ORDER BY spent DESC
    LIMIT 5
  `;
  const topSpenders = rawSpenders.map(r => ({
    name: r.name, phone: r.phone, spent: Number(r.spent)
  })).filter(s => s.spent > 0);

  // 4. Sources
  const rawSources: any[] = await prisma.$queryRaw`
    SELECT b.source as source, COUNT(DISTINCT b.id) as count
    FROM "bookings" b
    JOIN "payment_allocations" pa ON pa."bookingId" = b.id
    WHERE b."startDateTime" >= ${since} AND b."startDateTime" <= ${now}
    GROUP BY b.source
    ORDER BY count DESC
  `;
  const sources = rawSources.map(r => ({
    source: r.source, count: Number(r.count)
  })).filter(s => s.count > 0);

  // 5. Peak Hours
  const rawPeakHours: any[] = await prisma.$queryRaw`
    SELECT 
      EXTRACT(HOUR FROM b."startDateTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as hour,
      COUNT(DISTINCT b.id) as count
    FROM "bookings" b
    JOIN "payment_allocations" pa ON pa."bookingId" = b.id
    WHERE b."startDateTime" >= ${since} AND b."startDateTime" <= ${now}
    GROUP BY EXTRACT(HOUR FROM b."startDateTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')
  `;
  const peakHoursMap: Record<string, number> = {};
  for (let i = 10; i <= 23; i++) peakHoursMap[i.toString().padStart(2, '0') + ":00"] = 0;
  for (const r of rawPeakHours) {
    const hr = Number(r.hour);
    const key = hr.toString().padStart(2, '0') + ":00";
    if (peakHoursMap[key] !== undefined) {
      peakHoursMap[key] = Number(r.count);
    }
  }
  const peakHours = Object.entries(peakHoursMap).map(([hour, count]) => ({ hour, count }));

  // 6. Top Promos
  const rawPromos: any[] = await prisma.$queryRaw`
    SELECT 
      c.code as code,
      COUNT(DISTINCT b.id) as uses,
      SUM(b."couponDiscount") as "discountGiven"
    FROM "bookings" b
    JOIN "coupons" c ON b."couponId" = c.id
    WHERE b."startDateTime" >= ${since} AND b."startDateTime" <= ${now}
    AND b."couponDiscount" > 0
    GROUP BY c.code
    ORDER BY "discountGiven" DESC
    LIMIT 5
  `;
  const topPromos = rawPromos.map(r => ({
    code: r.code, uses: Number(r.uses), discountGiven: Number(r.discountGiven)
  }));

  // 7. General Aggregates (AOV, Duration, Gross, Discounts)
  const rawBookingAgg: any[] = await prisma.$queryRaw`
    SELECT 
      COUNT(DISTINCT b.id) as count,
      SUM(b."durationMinutes") as duration,
      SUM(b."discountAmount" + COALESCE(b."couponDiscount", 0) + (b."finalAmount" - COALESCE(b."negotiatedAmount", b."finalAmount"))) as discounts,
      SUM(b."finalAmount" + b."discountAmount" + COALESCE(b."couponDiscount", 0)) as gross
    FROM "bookings" b
    JOIN "payment_allocations" pa ON pa."bookingId" = b.id
    WHERE b."startDateTime" >= ${since} AND b."startDateTime" <= ${now}
  `;
  
  const rawSnackAgg: any[] = await prisma.$queryRaw`
    SELECT SUM(s.amount) as gross
    FROM "snack_orders" s
    JOIN "payment_allocations" pa ON pa."snackOrderId" = s.id
    WHERE s."createdAt" >= ${since} AND s."createdAt" <= ${now}
  `;
  
  const totalPaidBookingsCount = Number(rawBookingAgg[0]?.count || 0);
  const totalDurationMinutes = Number(rawBookingAgg[0]?.duration || 0);
  const totalDiscounts = Number(rawBookingAgg[0]?.discounts || 0);
  const bookingGross = Number(rawBookingAgg[0]?.gross || 0);
  const snackGross = Number(rawSnackAgg[0]?.gross || 0);
  const grossRevenue = bookingGross + snackGross;

  const aov = totalPaidBookingsCount > 0 ? Math.round(totalNetRevenue / totalPaidBookingsCount) : 0;
  const avgDuration = totalPaidBookingsCount > 0 ? Math.round(totalDurationMinutes / totalPaidBookingsCount) : 0;

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
