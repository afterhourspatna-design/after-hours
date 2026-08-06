"use client";

import { useState, useEffect } from "react";
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from "recharts";
import { 
  LineChart as LineChartIcon, Play, Database, Download, RefreshCw, Users, Trophy, 
  Clock, Zap, ArrowUpRight, ArrowDownRight, AlertTriangle, MessageSquare, Flame, 
  Sparkles, CheckCircle2, Copy, Search, HelpCircle, ChevronRight, PieChart as PieChartIcon
} from "lucide-react";
import { formatCurrency, generateCSV } from "@/lib/utils";
import { CardGridSkeleton } from "@/components/ui/LoadingSkeleton";
import { toast } from "sonner";

// Preset SQL Query Library matching all 16 user analytics specifications
const PRESET_QUERIES = [
  {
    id: "rfm_top_spenders",
    title: "1. Most Valuable Customers (Top Spenders)",
    category: "Customer Analytics",
    sql: `SELECT
    au.id,
    au.name,
    au.phone,
    COUNT(b.id)::int AS total_bookings,
    SUM(b."finalAmount") AS revenue,
    AVG(b."finalAmount") AS avg_ticket,
    SUM(b."durationMinutes")/60.0 AS total_hours,
    MAX(b."startDateTime") AS last_visit
FROM bookings b
JOIN app_users au ON au.id = b."userId"
WHERE b."bookingStatus"='COMPLETED'
GROUP BY au.id, au.name, au.phone
ORDER BY revenue DESC;`
  },
  {
    id: "top_hours",
    title: "2. Customers Who Spent Most Hours",
    category: "Customer Analytics",
    sql: `SELECT
    au.name,
    SUM(b."durationMinutes")/60.0 AS total_hours,
    COUNT(*)::int AS bookings
FROM bookings b
JOIN app_users au ON au.id=b."userId"
WHERE b."bookingStatus"='COMPLETED'
GROUP BY au.name
ORDER BY total_hours DESC;`
  },
  {
    id: "premium_bill",
    title: "3. Premium Customers (Highest Avg Bill)",
    category: "Customer Analytics",
    sql: `SELECT
    au.name,
    AVG(b."finalAmount") AS avg_bill,
    COUNT(*)::int AS bookings
FROM bookings b
JOIN app_users au ON au.id=b."userId"
WHERE b."bookingStatus"='COMPLETED'
GROUP BY au.name
HAVING COUNT(*)>=3
ORDER BY avg_bill DESC;`
  },
  {
    id: "disappeared_customers",
    title: "4. Disappeared Customers (30+ Days Inactive)",
    category: "Retention",
    sql: `SELECT
    au.name,
    au.phone,
    MAX(b."startDateTime") AS last_visit,
    COUNT(*)::int AS bookings
FROM bookings b
JOIN app_users au ON au.id=b."userId"
WHERE b."bookingStatus"='COMPLETED'
GROUP BY au.name, au.phone
HAVING MAX(b."startDateTime") < NOW() - INTERVAL '30 days'
ORDER BY last_visit;`
  },
  {
    id: "inactive_regulars",
    title: "5. Inactive Regulars (Marketing Churn Target)",
    category: "Retention",
    sql: `WITH previous AS (
  SELECT
    "userId",
    COUNT(*)::int AS bookings
  FROM bookings
  WHERE "startDateTime" BETWEEN NOW()-INTERVAL '90 days' AND NOW()-INTERVAL '30 days'
  GROUP BY "userId"
),
recent AS (
  SELECT
    "userId",
    COUNT(*)::int AS bookings
  FROM bookings
  WHERE "startDateTime">=NOW()-INTERVAL '30 days'
  GROUP BY "userId"
)
SELECT
  au.name,
  au.phone,
  previous.bookings AS old_bookings,
  COALESCE(recent.bookings, 0) AS recent_bookings
FROM previous
JOIN app_users au ON au.id=previous."userId"
LEFT JOIN recent ON previous."userId"=recent."userId"
WHERE previous.bookings>=5
AND COALESCE(recent.bookings, 0)<=1;`
  },
  {
    id: "one_time_customers",
    title: "6. One-Time Customers",
    category: "Retention",
    sql: `SELECT
    au.name,
    au.phone,
    COUNT(*)::int AS bookings
FROM bookings b
JOIN app_users au ON au.id=b."userId"
GROUP BY au.name, au.phone
HAVING COUNT(*)=1;`
  },
  {
    id: "daily_trends",
    title: "7. Daily Booking Trends",
    category: "Trends",
    sql: `SELECT
    DATE("startDateTime") AS day,
    COUNT(*)::int AS total_bookings,
    SUM("finalAmount") AS revenue
FROM bookings
WHERE "bookingStatus"='COMPLETED'
GROUP BY DATE("startDateTime")
ORDER BY day DESC;`
  },
  {
    id: "weekly_trends",
    title: "8. Weekly Booking Trends",
    category: "Trends",
    sql: `SELECT
    date_trunc('week', "startDateTime") AS week,
    COUNT(*)::int AS total_bookings,
    SUM("finalAmount") AS revenue
FROM bookings
WHERE "bookingStatus"='COMPLETED'
GROUP BY 1
ORDER BY week DESC;`
  },
  {
    id: "monthly_trends",
    title: "9. Monthly Booking Trends",
    category: "Trends",
    sql: `SELECT
    date_trunc('month', "startDateTime") AS month,
    COUNT(*)::int AS total_bookings,
    SUM("finalAmount") AS revenue
FROM bookings
WHERE "bookingStatus"='COMPLETED'
GROUP BY 1
ORDER BY month DESC;`
  },
  {
    id: "declining_games",
    title: "10. Declining Games (MoM Comparison)",
    category: "Game Analytics",
    sql: `WITH monthly AS (
  SELECT
    "gameId",
    date_trunc('month', "startDateTime") AS month,
    COUNT(*)::int AS bookings
  FROM bookings
  WHERE "bookingStatus"='COMPLETED'
  GROUP BY "gameId", month
)
SELECT
  g.name,
  monthly.month,
  monthly.bookings,
  LAG(monthly.bookings) OVER(PARTITION BY monthly."gameId" ORDER BY monthly.month) AS previous_month,
  monthly.bookings - LAG(monthly.bookings) OVER(PARTITION BY monthly."gameId" ORDER BY monthly.month) AS change
FROM monthly
JOIN games g ON g.id=monthly."gameId"
ORDER BY g.name, monthly.month DESC;`
  },
  {
    id: "peak_hours",
    title: "11. Peak Hours Distribution",
    category: "Patterns",
    sql: `SELECT
    EXTRACT(HOUR FROM "startDateTime")::int AS hour_of_day,
    COUNT(*)::int AS total_bookings
FROM bookings
WHERE "bookingStatus"='COMPLETED'
GROUP BY hour_of_day
ORDER BY hour_of_day;`
  },
  {
    id: "peak_days",
    title: "12. Peak Days Distribution",
    category: "Patterns",
    sql: `SELECT
    TRIM(TO_CHAR("startDateTime", 'Day')) AS day_of_week,
    COUNT(*)::int AS total_bookings
FROM bookings
WHERE "bookingStatus"='COMPLETED'
GROUP BY day_of_week
ORDER BY total_bookings DESC;`
  },
  {
    id: "repeat_rate",
    title: "13. Customer Repeat Rate Percentage",
    category: "Retention",
    sql: `SELECT
  ROUND((COUNT(*) FILTER(WHERE bookings>1)*100.0/COUNT(*))::numeric, 2) AS repeat_percentage
FROM (
  SELECT
    "userId",
    COUNT(*) AS bookings
  FROM bookings
  WHERE "userId" IS NOT NULL
  GROUP BY "userId"
) x;`
  },
  {
    id: "booking_sources",
    title: "14. Booking Source Performance (Instagram vs Walk-in)",
    category: "Marketing",
    sql: `SELECT
    source,
    COUNT(*)::int AS bookings,
    SUM("finalAmount") AS revenue,
    AVG("finalAmount") AS avg_booking
FROM bookings
WHERE "bookingStatus"='COMPLETED'
GROUP BY source
ORDER BY revenue DESC;`
  },
  {
    id: "ltv",
    title: "15. Customer Lifetime Value (LTV)",
    category: "Customer Analytics",
    sql: `SELECT
    au.name,
    au.phone,
    COUNT(*)::int AS bookings,
    SUM("finalAmount") AS lifetime_value,
    MAX("startDateTime") AS last_visit,
    MIN("startDateTime") AS first_visit
FROM bookings b
JOIN app_users au ON au.id=b."userId"
WHERE b."bookingStatus"='COMPLETED'
GROUP BY au.name, au.phone
ORDER BY lifetime_value DESC;`
  },
  {
    id: "snacks_attachment",
    title: "16. Snacks Attachment Rate",
    category: "Revenue",
    sql: `SELECT
    COUNT(DISTINCT b.id)::int AS total_bookings,
    COUNT(DISTINCT so.id)::int AS snack_orders,
    ROUND((COUNT(DISTINCT so.id)*100.0 / NULLIF(COUNT(DISTINCT b.id), 0))::numeric, 2) AS attachment_rate_pct
FROM bookings b
LEFT JOIN snack_orders so ON so."userId"=b."userId";`
  },
  {
    id: "best_games",
    title: "17. Best Games by Revenue & Hours",
    category: "Game Analytics",
    sql: `SELECT
    g.name,
    COUNT(*)::int AS bookings,
    SUM(b."finalAmount") AS revenue,
    SUM(b."durationMinutes")/60.0 AS total_hours
FROM bookings b
JOIN games g ON g.id=b."gameId"
WHERE b."bookingStatus"='COMPLETED'
GROUP BY g.name
ORDER BY revenue DESC;`
  },
  {
    id: "single_game_loyalists",
    title: "18. Single-Game Loyalists (5+ Plays)",
    category: "Targeting",
    sql: `SELECT
    au.name,
    au.phone,
    g.name AS favorite_game,
    COUNT(*)::int AS bookings
FROM bookings b
JOIN app_users au ON au.id=b."userId"
JOIN games g ON g.id=b."gameId"
WHERE b."bookingStatus"='COMPLETED'
GROUP BY au.name, au.phone, g.name
HAVING COUNT(*)>=5
ORDER BY bookings DESC;`
  },
  {
    id: "resource_utilization",
    title: "19. Equipment & Resource Unit Utilization",
    category: "Assets",
    sql: `SELECT
    ru."unitName",
    g.name AS game_name,
    SUM(b."durationMinutes")/60.0 AS booked_hours
FROM bookings b
JOIN resource_units ru ON ru.id=b."resourceUnitId"
JOIN games g ON g.id=ru."gameId"
WHERE b."bookingStatus"='COMPLETED'
GROUP BY ru."unitName", g.name
ORDER BY booked_hours DESC;`
  }
];

const TABLE_SCHEMAS = [
  { table: "bookings", cols: ["id", "userId", "gameId", "resourceUnitId", "startDateTime", "endDateTime", "durationMinutes", "finalAmount", "bookingStatus", "paymentStatus", "source"] },
  { table: "app_users", cols: ["id", "name", "phone", "email", "role", "createdAt"] },
  { table: "games", cols: ["id", "name", "tag", "basePrice", "minTimeMinutes", "maxTimeMinutes"] },
  { table: "resource_units", cols: ["id", "gameId", "unitName", "isActive"] },
  { table: "snack_orders", cols: ["id", "userId", "amount", "paymentStatus", "createdAt"] },
  { table: "payments", cols: ["id", "paymentMethod", "negotiatedAmount", "cashAmount", "onlineAmount", "userId"] },
  { table: "prepaid_transactions", cols: ["id", "userId", "moneyGiven", "amount", "description", "createdAt"] },
];

const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#84cc16"];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<"projections" | "sql">("projections");
  
  // Projections Data State
  const [projectionsData, setProjectionsData] = useState<any>(null);
  const [loadingProjections, setLoadingProjections] = useState(true);
  const [trendRange, setTrendRange] = useState<"daily" | "weekly" | "monthly">("daily");

  // SQL Studio State
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_QUERIES[0].id);
  const [sqlQuery, setSqlQuery] = useState<string>(PRESET_QUERIES[0].sql);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<{
    columns: string[];
    rows: any[];
    rowCount: number;
    executionTimeMs: number;
  } | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjections();
  }, []);

  const fetchProjections = async () => {
    setLoadingProjections(true);
    try {
      const res = await fetch("/api/analytics/projections");
      if (res.ok) {
        const data = await res.json();
        setProjectionsData(data);
      } else {
        toast.error("Failed to load analytics projections");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading analytics");
    } finally {
      setLoadingProjections(false);
    }
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const found = PRESET_QUERIES.find(q => q.id === presetId);
    if (found) {
      setSqlQuery(found.sql);
      setQueryError(null);
    }
  };

  const executeSqlQuery = async () => {
    if (!sqlQuery.trim()) return;
    setQueryLoading(true);
    setQueryError(null);
    try {
      const res = await fetch("/api/analytics/query-runner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sqlQuery }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setQueryResult({
          columns: data.columns || [],
          rows: data.rows || [],
          rowCount: data.rowCount || 0,
          executionTimeMs: data.executionTimeMs || 0,
        });
        toast.success(`Executed in ${data.executionTimeMs} ms (${data.rowCount} rows)`);
      } else {
        setQueryError(data.error || "Execution failed");
        toast.error("SQL Execution Error");
      }
    } catch (err: any) {
      setQueryError(err?.message || "Connection error");
      toast.error("Failed to execute SQL query");
    } finally {
      setQueryLoading(false);
    }
  };

  const exportQueryResultCSV = () => {
    if (!queryResult || queryResult.rows.length === 0) return;
    generateCSV(queryResult.rows, "sql-query-results");
  };

  const sendWhatsAppOffer = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const msg = encodeURIComponent(`Hi ${name}! We miss seeing you at After Hours. Enjoy 20% off your next session this week on us! Reply to book.`);
    window.open(`https://wa.me/91${cleanPhone}?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <LineChartIcon className="w-6 h-6 text-violet-400" />
            Analytics Projections & Query Studio
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Deep customer retention insights, game performance analytics & live PostgreSQL query runner
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          <button
            onClick={() => setActiveTab("projections")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "projections"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-900/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <PieChartIcon className="w-3.5 h-3.5" /> Projections Dashboard
          </button>
          <button
            onClick={() => setActiveTab("sql")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "sql"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-900/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Database className="w-3.5 h-3.5" /> Live SQL Runner
          </button>
        </div>
      </div>

      {/* TAB 1: PROJECTIONS DASHBOARD */}
      {activeTab === "projections" && (
        <div className="space-y-6">
          {loadingProjections ? (
            <CardGridSkeleton count={4} />
          ) : !projectionsData ? (
            <div className="p-8 text-center glass-card">
              <p className="text-zinc-400 text-sm">Failed to load projections data</p>
              <button onClick={fetchProjections} className="mt-3 px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl">
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Executive KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Repeat Customer Rate</p>
                  <p className="text-2xl font-extrabold text-violet-400">{projectionsData.repeatRate}%</p>
                  <p className="text-[10px] text-zinc-500">Customers with &gt; 1 booking</p>
                </div>
                <div className="glass-card p-4 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Snacks Attachment Rate</p>
                  <p className="text-2xl font-extrabold text-emerald-400">{projectionsData.snacksAttachment?.attachment_rate}%</p>
                  <p className="text-[10px] text-zinc-500">{projectionsData.snacksAttachment?.snack_orders} orders from {projectionsData.snacksAttachment?.total_bookings} bookings</p>
                </div>
                <div className="glass-card p-4 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Avg Booking Lead Time</p>
                  <p className="text-2xl font-extrabold text-cyan-400">{projectionsData.leadTimeHours} hrs</p>
                  <p className="text-[10px] text-zinc-500">Hours booked in advance</p>
                </div>
                <div className="glass-card p-4 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">One-Time Customers</p>
                  <p className="text-2xl font-extrabold text-amber-400">{projectionsData.oneTimeCount}</p>
                  <p className="text-[10px] text-zinc-500">Opportunity for retention</p>
                </div>
              </div>

              {/* Churn Risk & Retention Outreach Trigger */}
              {projectionsData.inactiveRegulars?.length > 0 && (
                <div className="glass-card p-5 border-amber-500/20 bg-amber-500/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      <div>
                        <h3 className="text-sm font-bold text-white">Marketing Outreach Target (High Value Inactive Regulars)</h3>
                        <p className="text-xs text-zinc-400">Regulars (5+ past visits) who played &lt;=1 time in the last 30 days</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                      {projectionsData.inactiveRegulars.length} Churn Risk
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {projectionsData.inactiveRegulars.map((user: any, idx: number) => (
                      <div key={idx} className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-white">{user.name}</p>
                          <p className="text-[10px] text-zinc-500">{user.phone} • {user.old_bookings} past bookings</p>
                        </div>
                        <button
                          onClick={() => sendWhatsAppOffer(user.phone, user.name)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 transition-all"
                        >
                          <MessageSquare className="w-3 h-3" /> WhatsApp
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Booking Trends Chart */}
              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">Booking & Revenue Trends</h3>
                    <p className="text-xs text-zinc-500">Historical performance over time</p>
                  </div>
                  <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold">
                    {(["daily", "weekly", "monthly"] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setTrendRange(r)}
                        className={`px-3 py-1 rounded-md capitalize transition-all ${
                          trendRange === r ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={
                        trendRange === "daily"
                          ? projectionsData.dailyTrends
                          : trendRange === "weekly"
                          ? projectionsData.weeklyTrends
                          : projectionsData.monthlyTrends
                      }
                    >
                      <XAxis dataKey={trendRange === "daily" ? "day" : trendRange === "weekly" ? "week" : "month"} stroke="#71717a" fontSize={11} />
                      <YAxis stroke="#71717a" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "12px" }} />
                      <Bar dataKey="revenue" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Revenue (₹)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Grid Section 1: Customer RFM & LTV */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Spenders (RFM) */}
                <div className="glass-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-violet-400" /> Top Customers by Revenue (RFM)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-300">
                      <thead className="text-[10px] text-zinc-500 uppercase border-b border-zinc-800">
                        <tr>
                          <th className="py-2">Customer</th>
                          <th className="py-2 text-right">Bookings</th>
                          <th className="py-2 text-right">Hours</th>
                          <th className="py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {projectionsData.topSpenders?.map((u: any, i: number) => (
                          <tr key={i} className="hover:bg-zinc-900/40">
                            <td className="py-2.5 font-medium text-white">{u.name}</td>
                            <td className="py-2.5 text-right text-zinc-400">{u.total_bookings}</td>
                            <td className="py-2.5 text-right text-zinc-400">{Number(u.total_hours).toFixed(1)}h</td>
                            <td className="py-2.5 text-right font-bold text-emerald-400">{formatCurrency(u.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Customer Lifetime Value (LTV) */}
                <div className="glass-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400" /> Customer Lifetime Value (LTV)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-300">
                      <thead className="text-[10px] text-zinc-500 uppercase border-b border-zinc-800">
                        <tr>
                          <th className="py-2">Customer</th>
                          <th className="py-2 text-right">Bookings</th>
                          <th className="py-2 text-right">Lifetime Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {projectionsData.customerLTV?.map((u: any, i: number) => (
                          <tr key={i} className="hover:bg-zinc-900/40">
                            <td className="py-2.5 font-medium text-white">{u.name}</td>
                            <td className="py-2.5 text-right text-zinc-400">{u.bookings}</td>
                            <td className="py-2.5 text-right font-bold text-violet-400">{formatCurrency(u.lifetime_value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Grid Section 2: Game Performance & Asset Utilization */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Best Games by Revenue */}
                <div className="glass-card p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-emerald-400" /> Best Games by Revenue & Hours
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-300">
                      <thead className="text-[10px] text-zinc-500 uppercase border-b border-zinc-800">
                        <tr>
                          <th className="py-2">Game</th>
                          <th className="py-2 text-right">Bookings</th>
                          <th className="py-2 text-right">Hours Played</th>
                          <th className="py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {projectionsData.bestGames?.map((g: any, i: number) => (
                          <tr key={i} className="hover:bg-zinc-900/40">
                            <td className="py-2.5 font-medium text-white">{g.name}</td>
                            <td className="py-2.5 text-right text-zinc-400">{g.bookings}</td>
                            <td className="py-2.5 text-right text-zinc-400">{Number(g.total_hours).toFixed(1)}h</td>
                            <td className="py-2.5 text-right font-bold text-emerald-400">{formatCurrency(g.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Resource Unit Utilization */}
                <div className="glass-card p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-cyan-400" /> Equipment & Resource Unit Utilization
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-300">
                      <thead className="text-[10px] text-zinc-500 uppercase border-b border-zinc-800">
                        <tr>
                          <th className="py-2">Unit</th>
                          <th className="py-2">Game</th>
                          <th className="py-2 text-right">Booked Hours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {projectionsData.resourceUtilization?.map((ru: any, i: number) => (
                          <tr key={i} className="hover:bg-zinc-900/40">
                            <td className="py-2.5 font-bold text-white">{ru.unitName}</td>
                            <td className="py-2.5 text-zinc-400">{ru.game_name}</td>
                            <td className="py-2.5 text-right font-bold text-cyan-400">{Number(ru.booked_hours).toFixed(1)} hrs</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Peak Hours & Booking Sources */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Peak Hours Distribution */}
                <div className="glass-card p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-violet-400" /> Peak Hours (Hour of Day)
                  </h3>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectionsData.peakHours}>
                        <XAxis dataKey="hour" stroke="#71717a" fontSize={10} tickFormatter={(h) => `${h}:00`} />
                        <YAxis stroke="#71717a" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px" }} />
                        <Bar dataKey="bookings" fill="#a78bfa" radius={[4, 4, 0, 0]} name="Bookings" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Booking Source Performance */}
                <div className="glass-card p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" /> Booking Source Attribution
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-300">
                      <thead className="text-[10px] text-zinc-500 uppercase border-b border-zinc-800">
                        <tr>
                          <th className="py-2">Source</th>
                          <th className="py-2 text-right">Bookings</th>
                          <th className="py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {projectionsData.bookingSources?.map((s: any, i: number) => (
                          <tr key={i} className="hover:bg-zinc-900/40">
                            <td className="py-2.5 font-bold uppercase text-white">{s.source}</td>
                            <td className="py-2.5 text-right text-zinc-400">{s.bookings}</td>
                            <td className="py-2.5 text-right font-bold text-emerald-400">{formatCurrency(s.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: LIVE SQL RUNNER */}
      {activeTab === "sql" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Controls & Preset Selector */}
            <div className="lg:col-span-3 space-y-4">
              {/* Preset Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-white">Preset SQL Library:</span>
                </div>
                <select
                  value={selectedPresetId}
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  className="bg-zinc-950 text-white text-xs border border-zinc-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500 max-w-full sm:max-w-md"
                >
                  {PRESET_QUERIES.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      [{preset.category}] {preset.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* SQL Code Input */}
              <div className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 tracking-wider uppercase">SQL Query Editor</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSqlQuery("")}
                      className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      onClick={executeSqlQuery}
                      disabled={queryLoading}
                      className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-violet-900/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {queryLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      Execute SQL
                    </button>
                  </div>
                </div>

                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      executeSqlQuery();
                    }
                  }}
                  rows={9}
                  className="w-full bg-zinc-950 text-emerald-400 font-mono text-xs p-4 rounded-xl border border-zinc-800 focus:outline-none focus:border-violet-500 leading-relaxed custom-scroll"
                  placeholder="Enter PostgreSQL query..."
                />
                <p className="text-[10px] text-zinc-500">Shortcut: Press <kbd className="px-1 bg-zinc-800 rounded">Cmd</kbd> + <kbd className="px-1 bg-zinc-800 rounded">Enter</kbd> to run query</p>
              </div>

              {/* Query Status & Execution Info */}
              {queryError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Execution Failure</p>
                    <p className="font-mono text-[11px] break-all">{queryError}</p>
                  </div>
                </div>
              )}

              {queryResult && (
                <div className="glass-card p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Query Successful
                      </span>
                      <span className="text-xs text-zinc-400 font-mono">
                        {queryResult.rowCount} {queryResult.rowCount === 1 ? "row" : "rows"} ({queryResult.executionTimeMs} ms)
                      </span>
                    </div>

                    <button
                      onClick={exportQueryResultCSV}
                      disabled={queryResult.rows.length === 0}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" /> Export CSV
                    </button>
                  </div>

                  {/* Results Data Table */}
                  {queryResult.rows.length === 0 ? (
                    <p className="text-xs text-zinc-500 p-4 text-center">Query returned 0 rows</p>
                  ) : (
                    <div className="overflow-x-auto max-h-96 custom-scroll">
                      <table className="w-full text-left text-xs text-zinc-300 divide-y divide-zinc-800">
                        <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] font-bold sticky top-0">
                          <tr>
                            {queryResult.columns.map((col) => (
                              <th key={col} className="p-2.5 whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40">
                          {queryResult.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-zinc-900/50 font-mono text-[11px]">
                              {queryResult.columns.map((col) => (
                                <td key={col} className="p-2.5 whitespace-nowrap text-zinc-300">
                                  {row[col] === null || row[col] === undefined
                                    ? <span className="text-zinc-600 italic">null</span>
                                    : typeof row[col] === "object"
                                    ? JSON.stringify(row[col])
                                    : String(row[col])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Schema Reference Drawer */}
            <div className="space-y-4">
              <div className="glass-card p-4 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-violet-400" /> Database Schema Helper
                </h3>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  PostgreSQL relational tables available for custom reporting & JOIN queries:
                </p>

                <div className="space-y-3 pt-2 text-xs">
                  {TABLE_SCHEMAS.map((item) => (
                    <div key={item.table} className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800/80 space-y-1">
                      <p className="font-bold text-violet-300 font-mono">{item.table}</p>
                      <div className="flex flex-wrap gap-1">
                        {item.cols.map((col) => (
                          <span key={col} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 font-mono">
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
