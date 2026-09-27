import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { formatTimeRange } from "@/lib/utils";
import HoldAlert from "@/components/bookings/HoldAlert";
import StatTile from "@/components/ui/StatTile";
import StatTable from "@/components/ui/StatTable";
import LiveActivityList from "@/components/dashboard/LiveActivityList";
import { BookOpen, Clock, Zap, Plus, Search, Users, Phone } from "lucide-react";

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

export default async function StaffDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const now = new Date();

  const bounds = getISTStartAndEnd(now);
  const todayStart = bounds.start;
  const todayEnd = bounds.end;
  const nextWeek = new Date(todayEnd.getTime() + (7 * 24 * 60 * 60 * 1000));

  const [todayBookings, upcomingBookings, holds, totalActiveUnits] = await Promise.all([
    prisma.booking.findMany({
      where: { startDateTime: { gte: todayStart, lte: todayEnd }, bookingStatus: { not: BookingStatus.CANCELLED } },
      include: { game: { select: { name: true, tag: true, totalUnits: true } }, resourceUnit: { select: { unitName: true } }, user: { select: { name: true, phone: true } } },
      orderBy: { startDateTime: "asc" },
    }),
    prisma.booking.findMany({
      take: 10,
      where: { startDateTime: { gt: todayEnd, lte: nextWeek }, bookingStatus: { not: BookingStatus.CANCELLED } },
      include: { game: { select: { name: true, totalUnits: true } }, resourceUnit: { select: { unitName: true } }, user: { select: { name: true, phone: true } } },
      orderBy: { startDateTime: "asc" },
    }),
    prisma.booking.findMany({
      where: { bookingStatus: BookingStatus.HOLD, holdExpiresAt: { gt: now } },
      include: { game: { select: { name: true, tag: true } }, resourceUnit: { select: { unitName: true } }, user: { select: { name: true, phone: true } } },
      orderBy: { holdExpiresAt: "asc" },
    }),
    prisma.resourceUnit.count({ where: { isActive: true } }),
  ]);

  const currentlyPlayingCount = todayBookings.filter(b => {
    const start = new Date(b.startDateTime).getTime();
    const end = new Date(b.endDateTime).getTime();
    const nowTime = now.getTime();
    return b.bookingStatus === BookingStatus.CONFIRMED && start <= nowTime && end >= nowTime;
  }).length;

  const plainTodayBookings = todayBookings.map(b => ({
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
  }));

  const plainHolds = holds.map(h => ({
    id: h.id,
    guestName: h.guestName,
    guestPhone: h.guestPhone,
    holdExpiresAt: h.holdExpiresAt ? h.holdExpiresAt.toISOString() : null,
    finalAmount: Number(h.finalAmount),
    game: h.game,
    resourceUnit: h.resourceUnit,
    user: h.user,
  }));

  const staffStats = [
    { label: "Total Bookings", value: todayBookings.length, icon: BookOpen, iconColor: "text-zinc-400" },
    { label: "Active Sessions", value: `${currentlyPlayingCount} / ${totalActiveUnits}`, icon: Zap, iconColor: "text-emerald-400" },
    { label: "On Hold", value: plainHolds.length, icon: Clock, iconColor: "text-amber-400" },
  ];


  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Search bar simulation */}
      <div className="flex items-center justify-between bg-zinc-950/50 -mx-8 -mt-8 px-8 py-4 border-b border-zinc-900 mb-8">
        <div className="relative group max-w-md w-full">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
           <input type="text" placeholder="Search bookings..." className="w-full bg-zinc-900/50 border-none rounded-xl pl-10 pr-4 py-2 text-sm outline-none" />
        </div>
        <div className="flex items-center gap-3">
           <Users className="w-4 h-4 text-zinc-600" />
           <div className="w-8 h-8 rounded-full bg-violet-900/50 border border-violet-500/50 flex items-center justify-center text-[10px] font-bold text-violet-200">
              {session.user.name?.substring(0, 2).toUpperCase()}
           </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">Workspace / Staff</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Staff Dashboard</h1>
          <p className="text-sm text-zinc-500 font-medium">Welcome, {session.user.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/staff/bookings/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-violet-900/20 active:scale-95">
            <Plus className="w-4 h-4" /> New booking
          </a>
        </div>
      </div>

      {/* Stat Cards — compact table on mobile/tablet, cards from desktop up */}
      <div className="lg:hidden">
        <StatTable items={staffStats} />
      </div>
      <div className="hidden lg:grid grid-cols-3 gap-3">
        {staffStats.map((s) => <StatTile key={s.label} {...s} />)}
      </div>

      {/* Hold alerts */}
      {plainHolds.length > 0 && <HoldAlert holds={plainHolds as any} />}

      {/* Today's Schedule + Upcoming — side by side from 1400px (2/3 : 1/3), stacked below */}
      <div className="grid grid-cols-1 min-[1400px]:grid-cols-3 gap-8 items-stretch">
        <div className="min-[1400px]:col-span-2">
          <LiveActivityList
            initialBookings={plainTodayBookings as any}
            todayStartISO={todayStart.toISOString()}
            todayEndISO={todayEnd.toISOString()}
            role="STAFF"
            title="Today's Schedule"
            emptyText="No bookings scheduled for today"
          />
        </div>

        <div className="glass-card overflow-hidden border-zinc-900/50 bg-zinc-950/30 flex flex-col">
          <div className="px-5 py-4 border-b border-zinc-900 flex-shrink-0">
            <h2 className="text-sm font-bold text-white tracking-tight">Upcoming</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Next 7 days</p>
          </div>
          <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[600px]">
            {upcomingBookings.length > 0 ? upcomingBookings.map(b => {
              const phone = b.user?.phone ?? (b as any).guestPhone ?? null;
              const name = b.user?.name ?? (b as any).guestName ?? "Guest";
              const initials = name.substring(0, 2).toUpperCase();
              const dateLabel = new Date(b.startDateTime).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
              return (
                <div key={b.id} className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-zinc-900/50 transition-colors group">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold border bg-violet-500/10 border-violet-500/20 text-violet-400 flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white group-hover:text-violet-400 transition-colors truncate">{name}</p>
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-violet-400 font-mono transition-colors"
                            title="Call"
                          >
                            <Phone className="w-3 h-3" />
                            {phone}
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 font-semibold truncate">
                        {(b.game.totalUnits ?? 1) > 1 && b.resourceUnit ? b.resourceUnit.unitName : b.game.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-zinc-300 whitespace-nowrap">{dateLabel}</p>
                    <p className="text-xs text-zinc-500 font-mono whitespace-nowrap">{formatTimeRange(b.startDateTime, b.endDateTime)}</p>
                  </div>
                </div>
              );
            }) : (
              <p className="text-center py-8 text-zinc-600 text-sm italic">No upcoming bookings</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
