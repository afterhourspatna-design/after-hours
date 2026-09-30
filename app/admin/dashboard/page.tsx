import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BookingStatus } from "@prisma/client";
import { formatCurrency, formatTimeRange, cn } from "@/lib/utils";
import {
  BookOpen, IndianRupee, TrendingUp, Zap, Gamepad2, Coffee, Filter, Clock, Swords, Phone, Plus,
} from "lucide-react";
import StatTile from "@/components/ui/StatTile";
import StatTable from "@/components/ui/StatTable";
import HoldAlert from "@/components/bookings/HoldAlert";
import LiveActivityList from "@/components/dashboard/LiveActivityList";
import { subDays } from "date-fns";

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
  const boundsMonth = getISTMonthBounds(now);

  // Rolling last-7-days window (including today) — shared by the "7 Days"
  // filter and the sidebar's Revenue chart, so both mean the same thing.
  const bounds7Days = {
    start: new Date(boundsToday.start.getTime() - (6 * 24 * 60 * 60 * 1000)),
    end: boundsToday.end,
  };
  const nextWeek = new Date(boundsToday.end.getTime() + (7 * 24 * 60 * 60 * 1000));

  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (period === "today") {
    startDate = boundsToday.start;
    endDate = boundsToday.end;
  } else if (period === "7days") {
    startDate = bounds7Days.start;
    endDate = bounds7Days.end;
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

  const [
    totalCount,
    periodCount,
    todayCount,
    sevenDaysCount,
    monthCount,
    activeNow,
    upcomingBookings,
    periodBookings,
    holds,
    recentBookings,
    last7DaysBookings,
    periodStandaloneSnacks,
    last7DaysStandaloneSnacks,
    periodPrepaidCredits,
    last7DaysPrepaidCredits,
    totalActiveUnits,
  ] = await Promise.all([
    prisma.booking.count({ where: { bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } } }),
    prisma.booking.count({ where: { ...whereRange, bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } } }),
    prisma.booking.count({ where: { startDateTime: { gte: boundsToday.start, lte: boundsToday.end }, bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } } }),
    prisma.booking.count({ where: { startDateTime: { gte: bounds7Days.start, lte: bounds7Days.end }, bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } } }),
    prisma.booking.count({ where: { startDateTime: { gte: boundsMonth.start, lte: boundsMonth.end }, bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } } }),
    prisma.booking.findMany({
      where: {
        bookingStatus: { notIn: [BookingStatus.CANCELLED, BookingStatus.COMPLETED, BookingStatus.EXPIRED] },
        startDateTime: { gte: boundsToday.start, lte: boundsToday.end },
      },
      include: {
        game: { select: { name: true, tag: true, totalUnits: true } },
        resourceUnit: { select: { unitName: true } },
        user: { select: { name: true, phone: true } },
      },
      orderBy: { startDateTime: "asc" },
    }),
    prisma.booking.findMany({
      take: 10,
      where: {
        startDateTime: { gt: boundsToday.end, lte: nextWeek },
        bookingStatus: { not: BookingStatus.CANCELLED },
      },
      include: {
        game: { select: { name: true, totalUnits: true } },
        resourceUnit: { select: { unitName: true } },
        user: { select: { name: true, phone: true } },
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
    prisma.resourceUnit.count({ where: { isActive: true } }),
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
    sevenDaysCount,
    monthCount,
    activeNow: activeNow.length,
    activeBookings: activeNow.map(b => ({
      id: b.id,
      guestName: b.guestName,
      guestPhone: b.guestPhone,
      startDateTime: b.startDateTime.toISOString(),
      endDateTime: b.endDateTime.toISOString(),
      bookingStatus: b.bookingStatus,
      paymentStatus: b.paymentStatus,
      finalAmount: Number(b.finalAmount),
      negotiatedAmount: b.negotiatedAmount !== null ? Number(b.negotiatedAmount) : null,
      usedCreditAmount: b.usedCreditAmount !== null ? Number(b.usedCreditAmount) : null,
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
    totalActiveUnits,
    upcomingBookings,
  };
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = (session.user as any).role === "ADMIN";
  const rawParams = await searchParams;
  const period = isAdmin ? (rawParams.period ?? "today") : "today";
  const from = isAdmin ? rawParams.from : undefined;
  const to = isAdmin ? rawParams.to : undefined;
  const data = await getDashboardData(period, from, to);
  const now = new Date();

  const currentlyPlayingCount = data.activeBookings.filter(b => {
    const start = new Date(b.startDateTime).getTime();
    const end = new Date(b.endDateTime).getTime();
    const nowTime = now.getTime();
    return b.bookingStatus === BookingStatus.CONFIRMED && start <= nowTime && end >= nowTime;
  }).length;

  // "Active right now" only means something when looking at Today — zero it
  // out for any other filter so it doesn't read as a live count of a period
  // that isn't actually "now".
  const displayedActiveCount = period === "today" ? currentlyPlayingCount : 0;

  const statsRow1 = [
    {
      label: "Total Bookings",
      value: data.periodCount.toLocaleString(),
      icon: BookOpen,
      iconColor: "text-zinc-400",
    },
    {
      label: "Active Sessions",
      value: `${displayedActiveCount} / ${data.totalActiveUnits}`,
      icon: Zap,
      iconColor: "text-emerald-400",
    },
    {
      label: "On Hold",
      value: data.holds.length,
      icon: Clock,
      iconColor: "text-amber-400",
    },
    {
      label: "Total Revenue",
      value: formatCurrency(data.periodRevenue),
      icon: IndianRupee,
      iconColor: "text-violet-400",
    },
  ];

  const statsRow2 = [
    {
      label: "Game Bookings",
      value: formatCurrency(data.periodGameRevenue),
      icon: Gamepad2,
      iconColor: "text-indigo-400",
    },
    {
      label: "Snack Sales",
      value: formatCurrency(data.periodSnacksRevenue),
      icon: Coffee,
      iconColor: "text-amber-400",
    },
    {
      label: "Prepaid Credits",
      value: formatCurrency(data.periodCreditRevenue),
      icon: Zap,
      iconColor: "text-blue-400",
    },
    {
      label: "Tournament Fees",
      value: "Coming Soon",
      icon: Swords,
      iconColor: "text-rose-400",
      muted: true,
    },
  ];

  const PERIOD_LABELS: Record<string, string> = {
    today: "Today",
    "7days": "7 Days",
    month: "Month",
    all: "All Time",
    custom: from && to ? `${from} → ${to}` : "Custom Range",
  };
  const currentPeriodLabel = PERIOD_LABELS[period] ?? "Today";

  const filterOptions = [
    { id: "today", label: "Today", count: data.todayCount },
    { id: "7days", label: "7 Days", count: data.sevenDaysCount },
    { id: "month", label: "Month", count: data.monthCount },
    { id: "all", label: "All time", count: data.total },
  ];

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">Workspace / Dashboard</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500 font-medium">
            Welcome back, {session.user.name?.split(' ')[0]} — here's what's happening today.
          </p>
        </div>

        <div className="flex items-center justify-between lg:justify-start gap-3 w-full lg:w-auto">
          {isAdmin && (
          <details className="relative">
            <summary
              className={cn(
                "list-none cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold rounded-xl transition-all select-none",
                period !== "today" ? "text-violet-300 border-violet-500/40" : "text-zinc-300"
              )}
            >
              <Filter className="w-4 h-4" />
              {period === "today" ? "Filter" : currentPeriodLabel}
            </summary>

            <div className="absolute left-0 lg:left-auto lg:right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-30 p-3.5 space-y-1">
              {filterOptions.map((opt) => (
                <a
                  key={opt.id}
                  href={`/admin/dashboard?period=${opt.id}`}
                  className={cn(
                    "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
                    period === opt.id
                      ? "bg-violet-600/20 text-violet-300"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  )}
                >
                  {opt.label}
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                    period === opt.id ? "bg-violet-500/20 text-violet-300" : "bg-zinc-800 text-zinc-600"
                  )}>
                    {opt.count}
                  </span>
                </a>
              ))}

              <div className="pt-2 mt-2 border-t border-zinc-800">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-3 pb-2">Date Range</p>
                <form action="/admin/dashboard" method="GET" className="px-3 space-y-2">
                  <input type="hidden" name="period" value="custom" />
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      name="from"
                      defaultValue={from || ""}
                      className="flex-1 min-w-0 bg-zinc-950/60 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50 [color-scheme:dark]"
                      required
                    />
                    <span className="text-zinc-600 text-[10px] font-bold">to</span>
                    <input
                      type="date"
                      name="to"
                      defaultValue={to || ""}
                      className="flex-1 min-w-0 bg-zinc-950/60 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50 [color-scheme:dark]"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all active:scale-95"
                  >
                    Apply
                  </button>
                </form>
              </div>
            </div>
          </details>
          )}

          <a
            href="/admin/bookings/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-violet-900/20 active:scale-95"
          >
            <Plus className="w-4 h-4" /> New booking
          </a>
        </div>
      </div>

      {/* Hold Alerts */}
      {data.holds.length > 0 && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-500">
          <HoldAlert holds={data.holds as any} />
        </div>
      )}

      {/* Stats — compact table on mobile/tablet, card grid from desktop up */}
      <div className="lg:hidden">
        <StatTable items={[...statsRow1, ...statsRow2]} />
      </div>
      <div className="hidden lg:grid grid-cols-4 gap-3">
        {[...statsRow1, ...statsRow2].map((s, idx) => (
          <div key={s.label} className="animate-in fade-in zoom-in-95 duration-500" style={{ animationDelay: `${idx * 60}ms` }}>
            <StatTile {...s} />
          </div>
        ))}
      </div>

      {/* Today's Schedule + Upcoming — side by side from 1400px (2/3 : 1/3), stacked below */}
      <div className="grid grid-cols-1 min-[1400px]:grid-cols-3 gap-8 items-stretch">
        <div className="min-[1400px]:col-span-2">
          <LiveActivityList
            initialBookings={data.activeBookings as any}
            todayStartISO={data.todayStartISO}
            todayEndISO={data.todayEndISO}
            title="Today's Schedule"
            emptyText="No bookings scheduled for today"
          />
        </div>

        <div className="glass-card overflow-hidden border-zinc-900/50 bg-zinc-950/30 flex flex-col">
          <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-zinc-900 flex-shrink-0">
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">Upcoming</h2>
            <p className="text-[9px] sm:text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Next 7 days</p>
          </div>
          <div className="p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 flex-1 overflow-y-auto max-h-[600px]">
            {data.upcomingBookings.length > 0 ? data.upcomingBookings.map(b => {
              const phone = b.user?.phone ?? b.guestPhone ?? null;
              const name = b.user?.name ?? b.guestName ?? "Guest";
              const initials = name.substring(0, 2).toUpperCase();
              const dateLabel = new Date(b.startDateTime).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
              return (
                <div key={b.id} className="flex items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl hover:bg-zinc-900/50 transition-colors group">
                  <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold border bg-violet-500/10 border-violet-500/20 text-violet-400 flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <p className="text-xs sm:text-sm font-bold text-white group-hover:text-violet-400 transition-colors truncate">{name}</p>
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            className="flex items-center gap-1 text-[11px] sm:text-xs text-zinc-500 hover:text-violet-400 font-mono transition-colors"
                            title="Call"
                          >
                            <Phone className="w-3 h-3" />
                            {phone}
                          </a>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-400 font-semibold truncate">
                        {(b.game?.totalUnits ?? 1) > 1 && b.resourceUnit ? b.resourceUnit.unitName : b.game?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] sm:text-xs font-bold text-zinc-300 whitespace-nowrap">{dateLabel}</p>
                    <p className="text-[11px] sm:text-xs text-zinc-500 font-mono whitespace-nowrap">{formatTimeRange(b.startDateTime, b.endDateTime)}</p>
                  </div>
                </div>
              );
            }) : (
              <p className="text-center py-8 text-zinc-600 text-sm italic">No upcoming bookings</p>
            )}
          </div>
        </div>
      </div>

      {/* Game Performance + Revenue 7d (admin only) — side by side from 1400px, stacked below */}
      <div className="grid grid-cols-1 min-[1400px]:grid-cols-2 gap-8 items-stretch">
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
            {currentPeriodLabel}
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

      {/* Revenue • 7 Days (admin only) */}
      <div className="glass-card border-zinc-900/50 bg-zinc-950/30 p-5 flex flex-col justify-center">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-white">Revenue • 7d</h3>
          </div>
          <p className="text-xs font-bold text-zinc-400">{formatCurrency(data.periodRevenue)}</p>
        </div>

        <div className="flex items-end justify-between h-32 gap-2 pt-6 mt-6">
          {data.last7DaysRevenue.map((d, i) => {
            const maxVal = Math.max(...data.last7DaysRevenue.map(item => item.amount), 100);
            const heightPct = maxVal > 0 ? (d.amount / maxVal) * 100 : 0;

            const creditsPct = d.amount > 0 ? (d.creditsAmount / d.amount) * 100 : 0;
            const snacksPct = d.amount > 0 ? (d.snacksAmount / d.amount) * 100 : 0;
            const gamePct = d.amount > 0 ? (d.gameAmount / d.amount) * 100 : 0;

            const formattedAmount = d.amount >= 1000
              ? `₹${(d.amount / 1000).toFixed(1)}k`
              : `₹${d.amount}`;

            return (
              <div key={d.date} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                <div className="absolute -top-5 text-[9px] font-bold text-zinc-400 whitespace-nowrap z-0">
                  {d.amount > 0 ? formattedAmount : ""}
                </div>
                <div className="absolute -top-16 bg-zinc-900 text-[10px] font-bold text-white px-2 py-1.5 rounded-lg border border-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 flex flex-col items-center gap-1 shadow-xl pointer-events-none">
                  <span>Total: ₹{d.amount.toLocaleString()}</span>
                  {d.gameAmount > 0 && <span className="text-violet-400 text-[9px]">Game: ₹{d.gameAmount.toLocaleString()}</span>}
                  {d.snacksAmount > 0 && <span className="text-amber-400 text-[9px]">Snacks: ₹{d.snacksAmount.toLocaleString()}</span>}
                  {d.creditsAmount > 0 && <span className="text-cyan-400 text-[9px]">Prepaid: ₹{d.creditsAmount.toLocaleString()}</span>}
                </div>
                <div className="w-full h-24 flex items-end relative z-10">
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-all duration-500 cursor-help flex flex-col justify-end overflow-hidden",
                      i === 6 ? "shadow-[0_0_15px_rgba(6,182,212,0.3)]" : ""
                    )}
                    style={{ height: `${heightPct}%` }}
                  >
                    <div
                      className={cn("w-full transition-all duration-500", i === 6 ? "bg-cyan-400" : "bg-cyan-500/80 group-hover:bg-cyan-400")}
                      style={{ height: `${creditsPct}%` }}
                    />
                    <div
                      className={cn("w-full transition-all duration-500", i === 6 ? "bg-amber-400" : "bg-amber-500/80 group-hover:bg-amber-400")}
                      style={{ height: `${snacksPct}%` }}
                    />
                    <div
                      className={cn("w-full transition-all duration-500", i === 6 ? "bg-violet-500" : "bg-violet-600/80 group-hover:bg-violet-500")}
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
      </div>
    </div>
  );
}
