"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Download, TrendingUp, Users, Trophy, Calendar } from "lucide-react";
import { formatCurrency, generateCSV } from "@/lib/utils";
import { CardGridSkeleton } from "@/components/ui/LoadingSkeleton";

interface RevenueData {
  daily: { date: string; revenue: number; gameRevenue: number; snacksRevenue: number }[];
  totalRevenue: number;
  revenueByGame: { game: string; tag: string; revenue: number }[];
  guestCount: number;
  registeredCount: number;
}

const COLORS = ["#7c3aed", "#2563eb", "#16a34a", "#0891b2", "#d97706", "#ea580c", "#db2777", "#6366f1"];

const PERIODS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-xl">
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      <p className="text-sm font-bold text-white mb-1">Total: {formatCurrency(payload[0].payload.revenue)}</p>
      <p className="text-xs text-zinc-400">Game: {formatCurrency(payload[0].payload.gameRevenue)}</p>
      <p className="text-xs text-amber-400">Snacks: {formatCurrency(payload[0].payload.snacksRevenue)}</p>
    </div>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/revenue?days=${period}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); });
  }, [period]);

  function exportData() {
    if (!data) return;
    generateCSV(data.daily.map(d => ({ Date: d.date, Revenue: d.revenue })), "revenue-report");
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="h-8 w-48 skeleton rounded-xl" />
      <CardGridSkeleton count={3} />
      <div className="glass-card h-64 skeleton" />
    </div>
  );

  if (!data) return <p className="text-zinc-500 text-sm">Failed to load reports</p>;

  const totalBookings = data.guestCount + data.registeredCount;
  const guestPct = totalBookings > 0 ? Math.round((data.guestCount / totalBookings) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-bold text-white">Reports</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Revenue and booking analytics</p></div>
        <div className="flex items-center gap-2">
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setPeriod(p.days)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${period === p.days ? "bg-violet-600 border-violet-600 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"}`}>
              {p.label}
            </button>
          ))}
          <button onClick={exportData} className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all" title="Export CSV">
            <Download className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: TrendingUp, label: "Total Revenue", value: formatCurrency(data.totalRevenue), iconColor: "text-violet-400" },
          { icon: Users, label: "Total Bookings", value: totalBookings, iconColor: "text-blue-400" },
          { icon: Trophy, label: "Top Game", value: data.revenueByGame[0]?.game ?? "N/A", iconColor: "text-amber-400" },
        ].map(card => (
          <div key={card.label} className="glass-card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <card.icon className={`w-5 h-5 ${card.iconColor}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{card.value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-violet-400" /> Daily Revenue
        </h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.daily} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
            <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }}
              tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={v => `Rs ${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(124,58,237,0.08)" }} />
            <Bar dataKey="gameRevenue" stackId="a" fill="#7c3aed" radius={[0, 0, 0, 0]} />
            <Bar dataKey="snacksRevenue" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by game */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Revenue by Game</h2>
          {data.revenueByGame.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.revenueByGame} dataKey="revenue" nameKey="game" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                  {data.revenueByGame.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px" }} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: "#a1a1aa", fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-zinc-600 py-8 text-center">No revenue data yet</p>}
        </div>

        {/* Guest vs registered */}
        <div className="glass-card p-5 space-y-5">
          <h2 className="text-sm font-semibold text-white">Guest vs Registered</h2>
          <div className="space-y-4">
            {[
              { label: "Registered Users", count: data.registeredCount, pct: 100 - guestPct, color: "bg-violet-500" },
              { label: "Guest Bookings", count: data.guestCount, pct: guestPct, color: "bg-zinc-500" },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-zinc-400">{item.label}</span>
                  <span className="text-zinc-300 font-medium">{item.count} ({item.pct}%)</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Revenue by game table */}
          <div className="space-y-2 pt-2 border-t border-zinc-800/60">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Game Revenue Breakdown</p>
            {data.revenueByGame.slice(0, 5).map((g, i) => (
              <div key={g.game} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-zinc-300">{g.game}</span>
                </div>
                <span className="text-xs font-medium text-white">{formatCurrency(g.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
