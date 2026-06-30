"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Download, TrendingUp, Users, Trophy, Calendar, Clock, CreditCard, Flame } from "lucide-react";
import { formatCurrency, generateCSV } from "@/lib/utils";
import { CardGridSkeleton } from "@/components/ui/LoadingSkeleton";

interface RevenueData {
  daily: { date: string; revenue: number; gameRevenue: number; snacksRevenue: number }[];
  totalRevenue: number;
  revenueByGame: { game: string; tag: string; revenue: number }[];
  grossRevenue: number;
  totalDiscounts: number;
  negotiatedDown: number;
  pendingDues: number;
  netRevenue: number;
  cashTotal: number;
  onlineTotal: number;
  aov: number;
  avgDuration: number;
  peakHours: { hour: string; count: number }[];
  sources: { source: string; count: number }[];
  topSpenders: { name: string; phone: string; spent: number }[];
  topPromos: { code: string; uses: number; discountGiven: number }[];
}

const COLORS = ["#7c3aed", "#2563eb", "#16a34a", "#0891b2", "#d97706", "#ea580c", "#db2777", "#6366f1"];
const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"];

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
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-bold text-white mb-1 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: {entry.name.toLowerCase().includes('revenue') || entry.name.toLowerCase().includes('amount') ? formatCurrency(entry.value) : entry.value}
        </p>
      ))}
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
      <CardGridSkeleton count={4} />
      <div className="glass-card h-64 skeleton" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card h-64 skeleton" />
        <div className="glass-card h-64 skeleton" />
      </div>
    </div>
  );

  if (!data) return <p className="text-zinc-500 text-sm">Failed to load reports</p>;

  const totalBookings = data.sources.reduce((sum, s) => sum + s.count, 0);

  // Transform Payment Methods
  const paymentMethods = [
    { name: "Online", value: data.onlineTotal },
    { name: "Cash", value: data.cashTotal }
  ].filter(p => p.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Advanced Reports</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Comprehensive business & revenue insights</p>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setPeriod(p.days)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${period === p.days ? "bg-violet-600 border-violet-600 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"}`}>
              {p.label}
            </button>
          ))}
          <button onClick={exportData} className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all" title="Export CSV">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary cards row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: TrendingUp, label: "Net Revenue", value: formatCurrency(data.netRevenue), iconColor: "text-emerald-400" },
          { icon: Trophy, label: "Avg Order Value", value: formatCurrency(data.aov), iconColor: "text-violet-400" },
          { icon: Clock, label: "Avg Session", value: `${data.avgDuration} min`, iconColor: "text-blue-400" },
          { icon: Users, label: "Total Bookings", value: totalBookings, iconColor: "text-amber-400" },
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

      {/* Daily Revenue & Financial Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-400" /> Daily Revenue
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.daily} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `Rs ${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(124,58,237,0.08)" }} />
              <Bar name="Game Revenue" dataKey="gameRevenue" stackId="a" fill="#7c3aed" radius={[0, 0, 0, 0]} />
              <Bar name="Snacks Revenue" dataKey="snacksRevenue" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" /> Financial Summary
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400">Gross Revenue</span>
                <span className="text-sm text-white">{formatCurrency(data.grossRevenue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400">Total Discounts</span>
                <span className="text-sm text-red-400">-{formatCurrency(data.totalDiscounts)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400">Negotiated Down</span>
                <span className="text-sm text-amber-500">-{formatCurrency(data.negotiatedDown)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400">Pending Dues</span>
                <span className="text-sm text-orange-400">-{formatCurrency(data.pendingDues)}</span>
              </div>
              <div className="h-px bg-zinc-800 w-full" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-zinc-300">Net Revenue</span>
                <span className="text-sm font-bold text-emerald-400">{formatCurrency(data.netRevenue)}</span>
              </div>
            </div>
          </div>
          
          {paymentMethods.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Payment Split</h3>
              <div className="flex gap-2">
                {paymentMethods.map((pm, i) => {
                  const pct = Math.round((pm.value / (data.cashTotal + data.onlineTotal)) * 100);
                  return (
                    <div key={pm.name} className="flex-1 rounded-lg p-2.5 bg-zinc-800/50 border border-zinc-800 text-center">
                      <p className="text-xs text-zinc-400 mb-1">{pm.name}</p>
                      <p className="text-sm font-bold text-white">{pct}%</p>
                      <p className="text-[10px] text-zinc-500 mt-1">{formatCurrency(pm.value)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pie Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Revenue by Game */}
        <div className="glass-card p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-white mb-4">Revenue by Game</h2>
          {data.revenueByGame.length > 0 ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="h-[160px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.revenueByGame} dataKey="revenue" nameKey="game" cx="50%" cy="50%" outerRadius={75} innerRadius={45}>
                      {data.revenueByGame.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex-1 space-y-2">
                {data.revenueByGame.map((g, i) => (
                  <div key={g.game} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-zinc-300 truncate max-w-[120px]">{g.game}</span>
                    </div>
                    <span className="text-xs font-medium text-white">{formatCurrency(g.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-zinc-600 py-8 text-center">No revenue data yet</p>}
        </div>

        {/* Source Breakdown */}
        <div className="glass-card p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-white mb-4">Acquisition Source</h2>
          {data.sources.length > 0 ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="h-[160px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.sources} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={75} innerRadius={45}>
                      {data.sources.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex-1 space-y-2">
                {data.sources.map((s, i) => (
                  <div key={s.source} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-zinc-300 capitalize truncate max-w-[120px]">{s.source.toLowerCase().replace('_', ' ')}</span>
                    </div>
                    <span className="text-xs font-bold text-white">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-zinc-600 py-8 text-center">No data</p>}
        </div>

      </div>

      {/* Peak Hours Heatmap Row */}
      <div className="grid grid-cols-1 gap-6">
        <div className="glass-card p-5 flex flex-col h-[300px]">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" /> Peak Hours Heatmap
          </h2>
          <div className="flex-1 min-h-0 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.peakHours} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="hour" tick={{ fill: "#71717a", fontSize: 10 }} tickFormatter={v => v.split(":")[0]} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(249,115,22,0.08)" }} />
                <Bar name="Bookings" dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Spenders */}
        <div className="glass-card p-0 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-zinc-800/60">
            <h2 className="text-sm font-semibold text-white">Top Spenders (Customers)</h2>
          </div>
          <div className="p-2 flex-1">
            {data.topSpenders.length > 0 ? (
              <div className="space-y-1">
                {data.topSpenders.map((user, i) => (
                  <div key={i} className="flex items-center justify-between p-3 hover:bg-zinc-800/30 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-xs">
                        #{i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{user.name}</p>
                        <p className="text-xs text-zinc-500">{user.phone}</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-emerald-400">{formatCurrency(user.spent)}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-zinc-600 py-8 text-center">No data</p>}
          </div>
        </div>

        {/* Top Promos */}
        <div className="glass-card p-0 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-zinc-800/60">
            <h2 className="text-sm font-semibold text-white">Top Promo Codes</h2>
          </div>
          <div className="p-2 flex-1">
            {data.topPromos.length > 0 ? (
              <div className="space-y-1">
                {data.topPromos.map((promo, i) => (
                  <div key={i} className="flex items-center justify-between p-3 hover:bg-zinc-800/30 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
                        <Flame className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white tracking-wide">{promo.code}</p>
                        <p className="text-xs text-zinc-500">{promo.uses} uses</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-400 mb-0.5">Discount Given</p>
                      <p className="text-sm font-bold text-red-400">{formatCurrency(promo.discountGiven)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-zinc-600 py-8 text-center">No promos used</p>}
          </div>
        </div>

      </div>

    </div>
  );
}
