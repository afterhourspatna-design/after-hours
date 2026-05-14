import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BookingStatus } from "@prisma/client";
import { formatCurrency, cn } from "@/lib/utils";
import {
  BookOpen, Users, DollarSign, TrendingUp, Zap, Clock, AlertTriangle,
  Download, Plus, Search, Filter, SlidersHorizontal,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import HoldAlert from "@/components/bookings/HoldAlert";
import DashboardCalendar from "@/components/bookings/DashboardCalendar";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
} from "date-fns";

async function getDashboardData(period: string = "today") {
  const now = new Date();
  let startDate: Date | undefined;
  let endDate: Date = endOfDay(now);

  if (period === "today") {
    startDate = startOfDay(now);
  } else if (period === "week") {
    startDate = startOfWeek(now, { weekStartsOn: 1 });
    endDate = endOfWeek(now, { weekStartsOn: 1 });
  } else if (period === "month") {
    startDate = startOfMonth(now);
    endDate = endOfMonth(now);
  } else if (period === "all") {
    startDate = undefined;
  }

  const whereRange = startDate ? { startDateTime: { gte: startDate, lte: endDate } } : {};

  const [totalCount, periodCount, activeNow, periodRev, holds, recentBookings] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.count({ where: whereRange }),
    prisma.booking.count({
      where: {
        bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.HOLD] },
        startDateTime: { lte: now }, endDateTime: { gte: now },
      },
    }),
    prisma.booking.aggregate({
      where: {
        ...whereRange,
        bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      },
      _sum: { finalAmount: true },
    }),
    prisma.booking.findMany({
      where: { bookingStatus: BookingStatus.HOLD, holdExpiresAt: { gt: now } },
      include: {
        game: { select: { name: true, tag: true } },
        resourceUnit: { select: { unitName: true } },
        user: { select: { name: true, phone: true } },
      },
      orderBy: { holdExpiresAt: "asc" },
    }),
    prisma.booking.findMany({
      take: 5,
      where: { bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.PENDING] } },
      include: {
        game: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    total: totalCount,
    periodCount,
    activeNow,
    periodRevenue: Number(periodRev._sum.finalAmount ?? 0),
    holds,
    recentBookings,
  };
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const period = searchParams.period || "today";
  const data = await getDashboardData(period);

  const stats = [
    {
      title: "Total Bookings",
      value: data.periodCount.toLocaleString(),
      icon: BookOpen,
      iconColor: "text-zinc-400",
      subtitle: "vs last period",
      trend: { value: 12.4, label: "up" } as any,
    },
    {
      title: "Active Sessions",
      value: `${data.activeNow} / 8 units`,
      icon: Zap,
      iconColor: "text-emerald-400",
      subtitle: "vs last hour",
      trend: { value: 2, label: "up" } as any,
    },
    {
      title: "Pending Holds",
      value: data.holds.length,
      icon: Clock,
      iconColor: "text-amber-400",
      subtitle: "vs last period",
      trend: { value: 1, label: "down" } as any,
    },
    {
      title: "Revenue",
      value: formatCurrency(data.periodRevenue),
      icon: DollarSign,
      iconColor: "text-violet-400",
      subtitle: "vs last period",
      trend: { value: 8.7, label: "up" } as any,
    },
  ];

  const periods = [
    { id: "today", label: "Today", count: data.periodCount },
    { id: "week",  label: "Week",  count: 31 },
    { id: "month", label: "Month", count: 142 },
    { id: "all",   label: "All time", count: data.total },
  ];

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Top Search & Actions Bar (Simulated from screenshot) */}
      <div className="flex items-center justify-between bg-zinc-950/50 -mx-8 -mt-8 px-8 py-4 border-b border-zinc-900 mb-8">
        <div className="relative group max-w-md w-full">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
           <input 
             type="text" 
             placeholder="Search bookings, customers, games..."
             className="w-full bg-zinc-900/50 border-none rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-300 focus:ring-1 focus:ring-violet-500/50 transition-all outline-none"
           />
           <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="text-[10px] font-bold text-zinc-700 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700/50">RK</span>
           </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center relative">
              <div className="w-2 h-2 bg-violet-500 rounded-full absolute -top-0.5 -right-0.5 border-2 border-black" />
              <Users className="w-4 h-4 text-zinc-500" />
           </div>
           <div className="w-8 h-8 rounded-full bg-violet-900/50 border border-violet-500/50 flex items-center justify-center text-[10px] font-bold text-violet-200">
              IA
           </div>
        </div>
      </div>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">Workspace / Dashboard</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500 font-medium">
            Welcome back, {session.user.name?.split(' ')[0]} — here's what's happening today.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
           <button className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-bold rounded-xl transition-all">
              <Download className="w-4 h-4" />
              Export
           </button>
           <a
             href="/admin/bookings/new"
             className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-violet-900/20 active:scale-95"
           >
             <Plus className="w-4 h-4" />
             New booking
           </a>
        </div>
      </div>

      {/* Primary Filters Bar */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
         <div className="flex items-center gap-2 bg-zinc-900/40 p-1.5 rounded-2xl border border-zinc-900">
            {periods.map((p) => (
              <a
                key={p.id}
                href={`/admin/dashboard?period=${p.id}`}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200",
                  period === p.id 
                    ? "bg-zinc-900 text-white shadow-md border border-zinc-800" 
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
                )}
              >
                {p.label}
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                  period === p.id ? "bg-violet-500/20 text-violet-400" : "bg-zinc-800 text-zinc-600"
                )}>
                  {p.count}
                </span>
              </a>
            ))}
         </div>
         
         <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-zinc-500 hover:text-zinc-300 text-xs font-bold transition-all">
               <Filter className="w-4 h-4" />
               Filter
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-zinc-500 hover:text-zinc-300 text-xs font-bold transition-all">
               <SlidersHorizontal className="w-4 h-4" />
               Customize
            </button>
         </div>
      </div>

      {/* Hold Alerts */}
      {data.holds.length > 0 && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-500">
          <HoldAlert holds={data.holds as any} />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, idx) => (
          <div key={s.title} className="animate-in fade-in zoom-in-95 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
            <StatCard {...s} />
          </div>
        ))}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Calendar View */}
        <div className="lg:col-span-8 space-y-6">
          <div className="glass-card overflow-hidden border-zinc-900/50 shadow-2xl">
            <div className="px-6 py-5 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/20">
              <div className="flex items-center gap-3">
                 <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <BookOpen className="w-4 h-4 text-violet-400" />
                 </div>
                 <div>
                    <h2 className="text-sm font-bold text-white tracking-tight">Booking schedule</h2>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Thursday, May 14</p>
                 </div>
              </div>
              <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/60">
                 <button className="px-3 py-1.5 text-[10px] font-black uppercase tracking-tighter bg-zinc-800 text-white rounded-lg">Day</button>
                 <button className="px-3 py-1.5 text-[10px] font-black uppercase tracking-tighter text-zinc-500 hover:text-zinc-300 rounded-lg">Week</button>
              </div>
            </div>
            <div className="p-2">
               <DashboardCalendar />
            </div>
          </div>
        </div>

        {/* Activity & Side Info */}
        <div className="lg:col-span-4 space-y-6">
           {/* Live Activity Section */}
           <div className="glass-card border-zinc-900/50 bg-zinc-950/30">
              <div className="px-5 py-4 border-b border-zinc-900 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-violet-400" />
                    <h3 className="text-sm font-bold text-white">Live activity</h3>
                 </div>
                 <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{data.activeNow} active</span>
              </div>
              <div className="p-2 space-y-1">
                 {data.recentBookings.length > 0 ? data.recentBookings.map((b, i) => (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-900/50 transition-colors group">
                       <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border",
                            i % 2 === 0 ? "bg-violet-500/10 border-violet-500/20 text-violet-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          )}>
                             {b.user?.name?.substring(0, 2).toUpperCase() || 'GU'}
                          </div>
                          <div>
                             <p className="text-[13px] font-bold text-zinc-200">{b.user?.name || 'Guest User'}</p>
                             <p className="text-[10px] text-zinc-500 font-medium">{b.game?.name} • {b.bookingStatus}</p>
                          </div>
                       </div>
                       <div className="text-[11px] font-mono text-zinc-500 group-hover:text-zinc-300">
                          {Math.floor(Math.random() * 50)}:{Math.floor(Math.random() * 60).toString().padStart(2, '0')}
                       </div>
                    </div>
                 )) : (
                    <p className="text-center py-8 text-zinc-600 text-xs font-medium italic">No recent activity</p>
                 )}
              </div>
           </div>

           {/* Revenue 7d Chart Section (Simulated from screenshot) */}
           <div className="glass-card border-zinc-900/50 bg-zinc-950/30 p-5 space-y-6">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-zinc-400" />
                    <h3 className="text-sm font-bold text-white">Revenue • 7d</h3>
                 </div>
                 <p className="text-xs font-bold text-zinc-400">{formatCurrency(data.periodRevenue)}</p>
              </div>
              
              <div className="flex items-end justify-between h-32 gap-2 pt-4">
                 {[40, 60, 45, 30, 100, 50, 40].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                       <div 
                         className={cn(
                           "w-full rounded-t-md transition-all duration-500 cursor-help relative",
                           i === 4 ? "bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.3)]" : "bg-zinc-800 hover:bg-zinc-700"
                         )} 
                         style={{ height: `${h}%` }}
                       >
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 text-[10px] font-bold text-white px-2 py-1 rounded border border-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                             Rs {h * 100}
                          </div>
                       </div>
                       <span className="text-[10px] font-black text-zinc-600 uppercase">{"MTWTFSS"[i]}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
