import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Helper function to serialize raw SQL query results
function serializeRows(rows: any[]) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const newObj: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      const val = row[key];
      if (typeof val === "bigint") {
        newObj[key] = Number(val);
      } else if (val && typeof val === "object" && "d" in val && "s" in val && "e" in val) {
        newObj[key] = Number(val);
      } else if (val instanceof Date) {
        newObj[key] = val.toISOString();
      } else {
        newObj[key] = val;
      }
    }
    return newObj;
  });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const [
      topSpendersRaw,
      mostHoursRaw,
      premiumCustomersRaw,
      disappearedCustomersRaw,
      inactiveRegularsRaw,
      oneTimeCountRaw,
      dailyTrendsRaw,
      weeklyTrendsRaw,
      monthlyTrendsRaw,
      decliningGamesRaw,
      peakHoursRaw,
      peakDaysRaw,
      repeatRateRaw,
      bookingSourcesRaw,
      customerLTVRaw,
      snacksAttachmentRaw,
      bestGamesRaw,
      discountAnalysisRaw,
      gameLoyalistsRaw,
      newVsReturningRaw,
      leadTimeRaw,
      resourceUtilizationRaw
    ]: any[] = await Promise.all([
      // 1. Top Customers by Revenue (RFM)
      prisma.$queryRawUnsafe(`
        SELECT au.id, au.name, au.phone, COUNT(b.id)::int AS total_bookings, 
               SUM(b."finalAmount") AS revenue, AVG(b."finalAmount") AS avg_ticket, 
               SUM(b."durationMinutes")/60.0 AS total_hours, MAX(b."startDateTime") AS last_visit
        FROM bookings b JOIN app_users au ON au.id = b."userId"
        WHERE b."bookingStatus"='COMPLETED'
        GROUP BY au.id, au.name, au.phone ORDER BY revenue DESC LIMIT 10;
      `),

      // 2. Most Hours Spent
      prisma.$queryRawUnsafe(`
        SELECT au.name, SUM(b."durationMinutes")/60.0 AS total_hours, COUNT(*)::int AS bookings
        FROM bookings b JOIN app_users au ON au.id=b."userId"
        WHERE b."bookingStatus"='COMPLETED'
        GROUP BY au.name ORDER BY total_hours DESC LIMIT 10;
      `),

      // 3. Premium Customers (Highest Avg Bill)
      prisma.$queryRawUnsafe(`
        SELECT au.name, AVG(b."finalAmount") AS avg_bill, COUNT(*)::int AS bookings
        FROM bookings b JOIN app_users au ON au.id=b."userId"
        WHERE b."bookingStatus"='COMPLETED'
        GROUP BY au.name HAVING COUNT(*)>=3 ORDER BY avg_bill DESC LIMIT 10;
      `),

      // 4. Disappeared Customers (30+ days inactive)
      prisma.$queryRawUnsafe(`
        SELECT au.name, au.phone, MAX(b."startDateTime") AS last_visit, COUNT(*)::int AS bookings
        FROM bookings b JOIN app_users au ON au.id=b."userId"
        WHERE b."bookingStatus"='COMPLETED'
        GROUP BY au.name, au.phone HAVING MAX(b."startDateTime") < NOW() - INTERVAL '30 days'
        ORDER BY last_visit ASC LIMIT 10;
      `),

      // 5. Inactive Regulars (Marketing Churn Target: 5+ old bookings, <=1 recent)
      prisma.$queryRawUnsafe(`
        WITH previous AS (
          SELECT "userId", COUNT(*)::int AS bookings FROM bookings WHERE "startDateTime" BETWEEN NOW()-INTERVAL '90 days' AND NOW()-INTERVAL '30 days' GROUP BY "userId"
        ),
        recent AS (
          SELECT "userId", COUNT(*)::int AS bookings FROM bookings WHERE "startDateTime" >= NOW()-INTERVAL '30 days' GROUP BY "userId"
        )
        SELECT au.name, au.phone, previous.bookings AS old_bookings, COALESCE(recent.bookings, 0) AS recent_bookings
        FROM previous JOIN app_users au ON au.id=previous."userId"
        LEFT JOIN recent ON previous."userId"=recent."userId"
        WHERE previous.bookings>=5 AND COALESCE(recent.bookings,0)<=1 LIMIT 10;
      `),

      // 6. One-time Customers Count
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS count FROM (
          SELECT "userId" FROM bookings WHERE "bookingStatus"='COMPLETED' AND "userId" IS NOT NULL GROUP BY "userId" HAVING COUNT(*)=1
        ) x;
      `),

      // 7a. Daily Trends
      prisma.$queryRawUnsafe(`
        SELECT DATE("startDateTime") AS day, COUNT(*)::int AS bookings, SUM("finalAmount") AS revenue
        FROM bookings WHERE "bookingStatus"='COMPLETED' GROUP BY DATE("startDateTime") ORDER BY day DESC LIMIT 30;
      `),

      // 7b. Weekly Trends
      prisma.$queryRawUnsafe(`
        SELECT date_trunc('week', "startDateTime") AS week, COUNT(*)::int AS bookings, SUM("finalAmount") AS revenue
        FROM bookings WHERE "bookingStatus"='COMPLETED' GROUP BY 1 ORDER BY week DESC LIMIT 12;
      `),

      // 7c. Monthly Trends
      prisma.$queryRawUnsafe(`
        SELECT date_trunc('month', "startDateTime") AS month, COUNT(*)::int AS bookings, SUM("finalAmount") AS revenue
        FROM bookings WHERE "bookingStatus"='COMPLETED' GROUP BY 1 ORDER BY month DESC LIMIT 12;
      `),

      // 8. Declining Games
      prisma.$queryRawUnsafe(`
        WITH monthly AS (
          SELECT "gameId", date_trunc('month', "startDateTime") AS month, COUNT(*)::int AS bookings
          FROM bookings WHERE "bookingStatus"='COMPLETED' GROUP BY "gameId", month
        )
        SELECT g.name, monthly.month, monthly.bookings,
               LAG(monthly.bookings) OVER(PARTITION BY monthly."gameId" ORDER BY monthly.month) AS previous_month,
               monthly.bookings - LAG(monthly.bookings) OVER(PARTITION BY monthly."gameId" ORDER BY monthly.month) AS change
        FROM monthly JOIN games g ON g.id=monthly."gameId" ORDER BY g.name, monthly.month DESC LIMIT 20;
      `),

      // 9a. Peak Hours
      prisma.$queryRawUnsafe(`
        SELECT EXTRACT(HOUR FROM "startDateTime")::int AS hour, COUNT(*)::int AS bookings
        FROM bookings WHERE "bookingStatus"='COMPLETED' GROUP BY hour ORDER BY hour;
      `),

      // 9b. Peak Days
      prisma.$queryRawUnsafe(`
        SELECT TRIM(TO_CHAR("startDateTime", 'Day')) AS day, COUNT(*)::int AS bookings
        FROM bookings WHERE "bookingStatus"='COMPLETED' GROUP BY day ORDER BY bookings DESC;
      `),

      // 10. Repeat Rate %
      prisma.$queryRawUnsafe(`
        SELECT ROUND((COUNT(*) FILTER(WHERE bookings>1)*100.0 / NULLIF(COUNT(*), 0))::numeric, 2) AS repeat_percentage
        FROM (SELECT "userId", COUNT(*) AS bookings FROM bookings WHERE "userId" IS NOT NULL GROUP BY "userId") x;
      `),

      // 11. Booking Sources
      prisma.$queryRawUnsafe(`
        SELECT source, COUNT(*)::int AS bookings, SUM("finalAmount") AS revenue, AVG("finalAmount") AS avg_booking
        FROM bookings WHERE "bookingStatus"='COMPLETED' GROUP BY source ORDER BY revenue DESC;
      `),

      // 12. Customer LTV
      prisma.$queryRawUnsafe(`
        SELECT au.name, au.phone, COUNT(b.id)::int AS bookings, SUM(b."finalAmount") AS lifetime_value,
               MAX(b."startDateTime") AS last_visit, MIN(b."startDateTime") AS first_visit
        FROM bookings b JOIN app_users au ON au.id=b."userId"
        WHERE b."bookingStatus"='COMPLETED' GROUP BY au.name, au.phone ORDER BY lifetime_value DESC LIMIT 10;
      `),

      // 13. Snacks Attachment Rate
      prisma.$queryRawUnsafe(`
        SELECT COUNT(DISTINCT b.id)::int AS total_bookings, COUNT(DISTINCT so.id)::int AS snack_orders,
               ROUND((COUNT(DISTINCT so.id)*100.0 / NULLIF(COUNT(DISTINCT b.id), 0))::numeric, 2) AS attachment_rate
        FROM bookings b LEFT JOIN snack_orders so ON so."userId"=b."userId";
      `),

      // 14. Best Games by Revenue
      prisma.$queryRawUnsafe(`
        SELECT g.name, COUNT(b.id)::int AS bookings, SUM(b."finalAmount") AS revenue, SUM(b."durationMinutes")/60.0 AS total_hours
        FROM bookings b JOIN games g ON g.id=b."gameId"
        WHERE b."bookingStatus"='COMPLETED' GROUP BY g.name ORDER BY revenue DESC;
      `),

      // 15. Discount Analysis
      prisma.$queryRawUnsafe(`
        SELECT ROUND("discountPct", 0)::int AS discount_pct, COUNT(*)::int AS count, SUM("finalAmount") AS revenue
        FROM bookings GROUP BY 1 ORDER BY 1;
      `),

      // 16. Single-Game Loyalists
      prisma.$queryRawUnsafe(`
        SELECT au.name, au.phone, g.name AS game_name, COUNT(*)::int AS bookings
        FROM bookings b JOIN app_users au ON au.id=b."userId" JOIN games g ON g.id=b."gameId"
        WHERE b."bookingStatus"='COMPLETED'
        GROUP BY au.name, au.phone, g.name HAVING COUNT(*)>=5 ORDER BY bookings DESC LIMIT 10;
      `),

      // 17. New vs Returning Customers
      prisma.$queryRawUnsafe(`
        WITH first_booking AS (
          SELECT "userId", MIN(DATE("startDateTime")) AS first_day FROM bookings WHERE "bookingStatus"='COMPLETED' AND "userId" IS NOT NULL GROUP BY "userId"
        )
        SELECT DATE(b."startDateTime") AS booking_day,
               COUNT(*) FILTER (WHERE DATE(b."startDateTime")=fb.first_day)::int AS new_customers,
               COUNT(*) FILTER (WHERE DATE(b."startDateTime")>fb.first_day)::int AS returning_bookings
        FROM bookings b JOIN first_booking fb ON b."userId"=fb."userId"
        WHERE b."bookingStatus"='COMPLETED' GROUP BY DATE(b."startDateTime") ORDER BY booking_day DESC LIMIT 14;
      `),

      // 18. Booking Lead Time (Hours)
      prisma.$queryRawUnsafe(`
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM ("startDateTime"-"createdAt"))/3600)::numeric, 1) AS avg_lead_hours FROM bookings;
      `),

      // 19. Resource Unit Utilization
      prisma.$queryRawUnsafe(`
        SELECT ru."unitName", g.name AS game_name, SUM(b."durationMinutes")/60.0 AS booked_hours
        FROM bookings b JOIN resource_units ru ON ru.id=b."resourceUnitId" JOIN games g ON g.id=ru."gameId"
        WHERE b."bookingStatus"='COMPLETED' GROUP BY ru."unitName", g.name ORDER BY booked_hours DESC;
      `)
    ]);

    return NextResponse.json({
      topSpenders: serializeRows(topSpendersRaw),
      mostHours: serializeRows(mostHoursRaw),
      premiumCustomers: serializeRows(premiumCustomersRaw),
      disappearedCustomers: serializeRows(disappearedCustomersRaw),
      inactiveRegulars: serializeRows(inactiveRegularsRaw),
      oneTimeCount: serializeRows(oneTimeCountRaw)[0]?.count || 0,
      dailyTrends: serializeRows(dailyTrendsRaw),
      weeklyTrends: serializeRows(weeklyTrendsRaw),
      monthlyTrends: serializeRows(monthlyTrendsRaw),
      decliningGames: serializeRows(decliningGamesRaw),
      peakHours: serializeRows(peakHoursRaw),
      peakDays: serializeRows(peakDaysRaw),
      repeatRate: serializeRows(repeatRateRaw)[0]?.repeat_percentage || 0,
      bookingSources: serializeRows(bookingSourcesRaw),
      customerLTV: serializeRows(customerLTVRaw),
      snacksAttachment: serializeRows(snacksAttachmentRaw)[0] || { total_bookings: 0, snack_orders: 0, attachment_rate: 0 },
      bestGames: serializeRows(bestGamesRaw),
      discountAnalysis: serializeRows(discountAnalysisRaw),
      gameLoyalists: serializeRows(gameLoyalistsRaw),
      newVsReturning: serializeRows(newVsReturningRaw),
      leadTimeHours: serializeRows(leadTimeRaw)[0]?.avg_lead_hours || 0,
      resourceUtilization: serializeRows(resourceUtilizationRaw),
    });
  } catch (error: any) {
    console.error("GET /api/analytics/projections error:", error);
    return NextResponse.json({ error: error?.message || "Failed to fetch analytics projections" }, { status: 500 });
  }
}
