import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BookingStatus } from "@prisma/client";
import { formatCurrency, cn } from "@/lib/utils";
import {
  BookOpen, Users, IndianRupee, TrendingUp, Zap, Clock, AlertTriangle,
  Download, Plus, Search, Filter, SlidersHorizontal, Gamepad2, Coffee
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import HoldAlert from "@/components/bookings/HoldAlert";
import LiveActivityList from "@/components/dashboard/LiveActivityList";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays,
} from "date-fns";

function getISTStartAndEnd(date: Date) {
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

  const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
  const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
  return { start, end };
}

function getISTWeekBounds(date: Date) {
  const istTime = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
  const dayOfWeek = istTime.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const mondayVal = new Date(istTime);
  mondayVal.setUTCDate(istTime.getUTCDate() - daysToMonday);

  const sundayVal = new Date(mondayVal);
  sundayVal.setUTCDate(mondayVal.getUTCDate() + 6);

  const start = new Date(Date.UTC(mondayVal.getUTCFullYear(), mondayVal.getUTCMonth(), mondayVal.getUTCDate(), 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
  const end = new Date(Date.UTC(sundayVal.getUTCFullYear(), sundayVal.getUTCMonth(), sundayVal.getUTCDate(), 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
  return { start, end };
}

function getISTMonthBounds(date: Date) {
  const istTime = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
  const year = istTime.getUTCFullYear();
  const month = istTime.getUTCMonth();

  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
  
  const nextMonthFirst = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  const lastDay = new Date(nextMonthFirst.getTime() - 1);
  const end = new Date(lastDay.getTime() - (5.5 * 60 * 60 * 1000));

  return { start, end };
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

function parseISTDateString(dateStr: string, isEnd: boolean) {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (isEnd) {
    return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
  } else {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
  }
}

async function getDashboardData(period: string = "today", from?: string, to?: string) {
  const now = new Date();
  const boundsToday = getISTStartAndEnd(now);
  const boundsWeek = getISTWeekBounds(now);
  const boundsMonth = getISTMonthBounds(now);

  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (period === "today") {
    startDate = boundsToday.start;
    endDate = boundsToday.end;
  } else if (period === "week") {
    startDate = boundsWeek.start;
    endDate = boundsWeek.end;
  } else if (period === "month") {
    startDate = boundsMonth.start;
    endDate = boundsMonth.end;
  } else if (period === "all") {
    startDate = undefined;
    endDate = undefined;
  } else if (period === "custom" && from && to) {
    try {
      startDate = parseISTDateString(from, false);
      endDate = parseISTDateString(to, true);
    } catch (e) {
      startDate = boundsToday.start;
      endDate = boundsToday.end;
    }
  }

  const whereRange = startDate && endDate ? { startDateTime: { gte: startDate, lte: endDate } } : {};
  const paymentWhereRange = startDate && endDate ? { createdAt: { gte: startDate, lte: endDate } } : {};

  // Get bounds for last 7 days (including today)
  const bounds7Days = {
    start: new Date(boundsToday.start.getTime() - (6 * 24 * 60 * 60 * 1000)),
    end: boundsToday.end,
  };

  const [
    totalCount,
    periodCount,
    todayCount,
    weekCount,
    monthCount,
    activeNow,
    periodBookings,
    holds,
    recentBookings,
    last7DaysBookings,
    periodStandaloneSnacks,
    last7DaysStandaloneSnacks,
    periodPrepaidCredits,
    last7DaysPrepaidCredits,
  ] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.count({ where: whereRange }),
    prisma.booking.count({ where: { startDateTime: { gte: boundsToday.start, lte: boundsToday.end } } }),
    prisma.booking.count({ where: { startDateTime: { gte: boundsWeek.start, lte: boundsWeek.end } } }),
    prisma.booking.count({ where: { startDateTime: { gte: boundsMonth.start, lte: boundsMonth.end } } }),
    prisma.booking.findMany({
      where: {
        bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.HOLD] },
        startDateTime: { gte: boundsToday.start, lte: boundsToday.end },
      },
      include: {
        game: { select: { name: true, tag: true } },
        resourceUnit: { select: { unitName: true } },
        user: { select: { name: true } },
      },
      orderBy: { startDateTime: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        ...whereRange,
        bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      },
      select: { 
        finalAmount: true, 
        negotiatedAmount: true, 
        paymentStatus: true,
        game: { select: { name: true } },
      },
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
    prisma.booking.findMany({
      where: {
        startDateTime: { gte: bounds7Days.start, lte: bounds7Days.end },
        bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      },
      select: { startDateTime: true, finalAmount: true, negotiatedAmount: true, paymentStatus: true },
    }),
    prisma.snackOrder.findMany({
      where: {
        ...paymentWhereRange,
        paymentStatus: "PAID"
      },
      select: { amount: true }
    }),
    prisma.snackOrder.findMany({
      where: {
        createdAt: { gte: bounds7Days.start, lte: bounds7Days.end },
        paymentStatus: "PAID"
      },
      select: { createdAt: true, amount: true }
    }),
    prisma.prepaidTransaction.findMany({
      where: { ...paymentWhereRange, moneyGiven: { gt: 0 } },
      select: { createdAt: true, moneyGiven: true }
    }),
    prisma.prepaidTransaction.findMany({
      where: {
        createdAt: { gte: bounds7Days.start, lte: bounds7Days.end },
        moneyGiven: { gt: 0 }
      },
      select: { createdAt: true, moneyGiven: true }
    }),
  ]);

  let periodGameRevenue = 0;
  let periodSnacksRevenue = 0;
  const gameMap: Record<string, { count: number; revenue: number }> = {};

  for (const b of periodBookings) {
    const isPaid = b.paymentStatus === "PAID";
    const baseRev = isPaid 
      ? Number(b.negotiatedAmount ?? b.finalAmount) 
      : 0;
    
    periodGameRevenue += baseRev;

    const gameName = b.game?.name || "Other";
    if (!gameMap[gameName]) {
      gameMap[gameName] = { count: 0, revenue: 0 };
    }
    gameMap[gameName].count += 1;
    gameMap[gameName].revenue += baseRev;
  }
  
  for (const s of periodStandaloneSnacks) {
    periodSnacksRevenue += Number(s.amount);
  }
  
  let periodCreditRevenue = 0;
  for (const t of periodPrepaidCredits) {
    periodCreditRevenue += Number(t.moneyGiven);
  }
  
  const periodRevenue = periodGameRevenue + periodSnacksRevenue + periodCreditRevenue;

  const gameUtilization = Object.entries(gameMap)
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      revenue: stats.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const dailyMap: Record<string, { game: number; snacks: number; credits: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const day = subDays(now, i);
    dailyMap[formatInIST(day)] = { game: 0, snacks: 0, credits: 0 };
  }

  for (const b of last7DaysBookings) {
    const key = formatInIST(b.startDateTime);
    if (key in dailyMap) {
      const isPaid = b.paymentStatus === "PAID";
      const baseRev = isPaid 
        ? Number(b.negotiatedAmount ?? b.finalAmount) 
        : 0;
      dailyMap[key].game += baseRev;
    }
  }

  for (const s of last7DaysStandaloneSnacks) {
    const dateStr = formatInIST(s.createdAt);
    if (dailyMap[dateStr]) dailyMap[dateStr].snacks += Number(s.amount);
  }

  for (const t of last7DaysPrepaidCredits) {
    const dateStr = formatInIST(t.createdAt);
    if (dailyMap[dateStr]) {
      dailyMap[dateStr].credits += Number(t.moneyGiven);
    }
  }

  const last7DaysRevenue = Object.entries(dailyMap).map(([date, data]) => {
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "narrow" });
    return {
      date,
      dayName,
      gameAmount: data.game,
      snacksAmount: data.snacks,
      creditsAmount: data.credits,
      amount: data.game + data.snacks + data.credits,
    };
  });

  return {
    total: totalCount,
    periodCount,
    todayCount,
    weekCount,
    monthCount,
    activeNow: activeNow.length,
    activeBookings: activeNow.map(b => ({
      id: b.id,
      guestName: b.guestName,
      startDateTime: b.startDateTime.toISOString(),
      endDateTime: b.endDateTime.toISOString(),
      bookingStatus: b.bookingStatus,
      game: b.game,
      resourceUnit: b.resourceUnit,
      user: b.user,
    })),
    todayStartISO: boundsToday.start.toISOString(),
    todayEndISO: boundsToday.end.toISOString(),
    periodRevenue,
    periodGameRevenue,
    periodSnacksRevenue,
    periodCreditRevenue,
    gameUtilization,
    holds: holds.map(h => ({
      id: h.id,
      guestName: h.guestName,
      guestPhone: h.guestPhone,
      holdExpiresAt: h.holdExpiresAt ? h.holdExpiresAt.toISOString() : null,
      finalAmount: Number(h.finalAmount),
      game: h.game,
      resourceUnit: h.resourceUnit,
      user: h.user,
    })),
    recentBookings,
    last7DaysRevenue,
  };
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { period = "today", from, to } = await searchParams;
  const data = await getDashboardData(period, from, to);
  const now = new Date();
  const currentlyPlayingCount = data.activeBookings.filter(b => {
    const start = new Date(b.startDateTime).getTime();
    const end = new Date(b.endDateTime).getTime();
    const nowTime = now.getTime();
    return b.bookingStatus === BookingStatus.CONFIRMED && start <= nowTime && end >= nowTime;
  }).length;

  const stats = [
    {
      title: "Total Bookings",
      value: data.periodCount.toLocaleString(),
      icon: BookOpen,
      iconColor: "text-zinc-400",
      subtitle: "Bookings in period",
    },
    {
      title: "Active Sessions",
      value: `${currentlyPlayingCount} / 8 units`,
      icon: Zap,
      iconColor: "text-emerald-400",
      subtitle: "Current parlor load",
    },
    {
      title: "Game Bookings",
      value: formatCurrency(data.periodGameRevenue),
      icon: Gamepad2,
      iconColor: "text-indigo-400",
      subtitle: "From console play",
    },
    {
      title: "Snack Sales",
      value: formatCurrency(data.periodSnacksRevenue),
      icon: Coffee,
      iconColor: "text-amber-400",
      subtitle: "From snack sales",
    },
    {
      title: "Prepaid Credits",
      value: formatCurrency(data.periodCreditRevenue),
      icon: Zap,
      iconColor: "text-blue-400",
      subtitle: "From wallet top-ups",
    },
    {
      title: "Total Revenue",
      value: formatCurrency(data.periodRevenue),
      icon: IndianRupee,
      iconColor: "text-violet-400",
      subtitle: "Combined total",
    },
  ];

  const periods = [
    { id: "today", label: "Today", count: data.todayCount },
    { id: "week", label: "Week", count: data.weekCount },
    { id: "month", label: "Month", count: data.monthCount },
    { id: "all", label: "All time", count: data.total },
  ];

  if (period === "custom" && from && to) {
    periods.push({
      id: "custom",
      label: `Custom Range (${from} to ${to})`,
      count: data.periodCount,
    });
  }

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
              href={p.id === "custom" ? `/admin/dashboard?period=custom&from=${from}&to=${to}` : `/admin/dashboard?period=${p.id}`}
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

        <form action="/admin/dashboard" method="GET" className="flex items-center gap-2">
          <input type="hidden" name="period" value="custom" />
          <div className="flex items-center gap-1.5 bg-zinc-900/40 p-1.5 rounded-2xl border border-zinc-900">
            <div className="flex items-center gap-1.5 px-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">From</span>
              <input 
                type="date" 
                name="from" 
                defaultValue={from || ""}
                className="bg-transparent border-none text-xs text-zinc-300 focus:outline-none focus:ring-0 cursor-pointer [color-scheme:dark]"
                required
              />
            </div>
            <div className="w-[1px] h-4 bg-zinc-800" />
            <div className="flex items-center gap-1.5 px-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">To</span>
              <input 
                type="date" 
                name="to"
                defaultValue={to || ""}
                className="bg-transparent border-none text-xs text-zinc-300 focus:outline-none focus:ring-0 cursor-pointer [color-scheme:dark]"
                required
              />
            </div>
            <button 
              type="submit"
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95"
            >
              Apply
            </button>
          </div>
        </form>
      </div>

      {/* Hold Alerts */}
      {data.holds.length > 0 && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-500">
          <HoldAlert holds={data.holds as any} />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {stats.map((s, idx) => (
          <div key={s.title} className="animate-in fade-in zoom-in-95 duration-500 h-full" style={{ animationDelay: `${idx * 100}ms` }}>
            <StatCard {...s} className="h-full flex flex-col justify-between" />
          </div>
        ))}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Game Performance */}
        <div className="lg:col-span-8 space-y-8">
          <div className="glass-card overflow-hidden border-zinc-900/50 shadow-2xl">
            <div className="px-6 py-5 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <Gamepad2 className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Game Performance</h2>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Booking count and revenue per game</p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-violet-400 bg-violet-500/10 px-2.5 py-1 rounded border border-violet-500/20 uppercase tracking-wider">
                {period}
              </span>
            </div>
            
            <div className="p-6 space-y-6">
              {data.gameUtilization.length > 0 ? (
                data.gameUtilization.map((game, idx) => {
                  const maxRevenue = Math.max(...data.gameUtilization.map(g => g.revenue), 1);
                  const sharePct = maxRevenue > 0 ? (game.revenue / maxRevenue) * 100 : 0;
                  
                  return (
                    <div key={game.name} className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-zinc-200">{game.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-zinc-400 font-medium">
                          <span>{game.count} {game.count === 1 ? 'booking' : 'bookings'}</span>
                          <span className="font-bold font-mono text-white">{formatCurrency(game.revenue)}</span>
                        </div>
                      </div>
                      
                      <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800/40 relative">
                        <div 
                          className="bg-gradient-to-r from-violet-600 to-indigo-500 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${sharePct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-zinc-600 text-xs font-medium italic">
                  No bookings registered in this period
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Activity & Side Info */}
        <div className="lg:col-span-4 space-y-6">
          {/* Revenue 7d Chart Section (Simulated from screenshot) */}
          <div className="glass-card border-zinc-900/50 bg-zinc-950/30 p-5 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-zinc-400" />
                <h3 className="text-sm font-bold text-white">Revenue • 7d</h3>
              </div>
              <p className="text-xs font-bold text-zinc-400">{formatCurrency(data.periodRevenue)}</p>
            </div>

            <div className="flex items-end justify-between h-32 gap-2 pt-6">
              {data.last7DaysRevenue.map((d, i) => {
                const maxVal = Math.max(...data.last7DaysRevenue.map(item => item.amount), 100);
                const heightPct = maxVal > 0 ? (d.amount / maxVal) * 100 : 0;
                
                const gamePct = d.amount > 0 ? (d.gameAmount / d.amount) * 100 : 0;
                const snacksPct = d.amount > 0 ? (d.snacksAmount / d.amount) * 100 : 0;

                const formattedAmount = d.amount >= 1000 
                  ? `₹${(d.amount / 1000).toFixed(1)}k` 
                  : `₹${d.amount}`;
                
                return (
                  <div key={d.date} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                    <div className="absolute -top-5 text-[9px] font-bold text-zinc-400 whitespace-nowrap z-0">
                      {d.amount > 0 ? formattedAmount : ""}
                    </div>
                    <div className="absolute -top-14 bg-zinc-900 text-[10px] font-bold text-white px-2 py-1.5 rounded-lg border border-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 flex flex-col items-center gap-1 shadow-xl pointer-events-none">
                      <span>Total: ₹{d.amount.toLocaleString()}</span>
                      {d.gameAmount > 0 && <span className="text-zinc-400 text-[9px]">Game: ₹{d.gameAmount.toLocaleString()}</span>}
                      {d.snacksAmount > 0 && <span className="text-amber-400 text-[9px]">Snacks: ₹{d.snacksAmount.toLocaleString()}</span>}
                    </div>
                    <div className="w-full h-24 flex items-end relative z-10">
                      <div
                        className={cn(
                          "w-full rounded-t-md transition-all duration-500 cursor-help flex flex-col justify-end overflow-hidden",
                          i === 6 ? "shadow-[0_0_15px_rgba(139,92,246,0.3)]" : ""
                        )}
                        style={{ height: `${heightPct}%` }}
                      >
                        <div 
                          className={cn("w-full transition-all duration-500", i === 6 ? "bg-amber-400" : "bg-amber-500/80 group-hover:bg-amber-400")} 
                          style={{ height: `${snacksPct}%` }} 
                        />
                        <div 
                          className={cn("w-full transition-all duration-500", i === 6 ? "bg-violet-500" : "bg-zinc-800 group-hover:bg-zinc-700")} 
                          style={{ height: `${gamePct}%` }} 
                        />
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-zinc-600 uppercase mt-2">{d.dayName}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Activity Section */}
          <LiveActivityList
            initialBookings={data.activeBookings as any}
            todayStartISO={data.todayStartISO}
            todayEndISO={data.todayEndISO}
          />
        </div>
      </div>
    </div>
  );
}
