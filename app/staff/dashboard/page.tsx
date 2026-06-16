import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { formatCurrency, formatTimeRange, formatDate, cn } from "@/lib/utils";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import HoldAlert from "@/components/bookings/HoldAlert";
import StatCard from "@/components/ui/StatCard";
import { BookOpen, Clock, Zap, Plus, Calendar, Search, Users } from "lucide-react";
import { startOfDay, endOfDay, addDays } from "date-fns";

export default async function StaffDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const nextWeek = addDays(now, 7);

  const [todayBookings, upcomingBookings, activeNow, holds] = await Promise.all([
    prisma.booking.findMany({
      where: { startDateTime: { gte: todayStart, lte: todayEnd }, bookingStatus: { not: BookingStatus.CANCELLED } },
      include: { game: { select: { name: true } }, resourceUnit: { select: { unitName: true } }, user: { select: { name: true, phone: true } } },
      orderBy: { startDateTime: "asc" },
    }),
    prisma.booking.findMany({
      take: 10,
      where: { startDateTime: { gt: todayEnd, lte: nextWeek }, bookingStatus: { not: BookingStatus.CANCELLED } },
      include: { game: { select: { name: true } }, resourceUnit: { select: { unitName: true } }, user: { select: { name: true, phone: true } } },
      orderBy: { startDateTime: "asc" },
    }),
    prisma.booking.findMany({
      where: { bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.HOLD] }, startDateTime: { lte: now }, endDateTime: { gte: now } },
      include: { game: { select: { name: true, tag: true } }, resourceUnit: { select: { unitName: true } }, user: { select: { name: true } } },
      orderBy: { endDateTime: "asc" },
    }),
    prisma.booking.findMany({
      where: { bookingStatus: BookingStatus.HOLD, holdExpiresAt: { gt: now } },
      include: { game: { select: { name: true, tag: true } }, resourceUnit: { select: { unitName: true } }, user: { select: { name: true, phone: true } } },
      orderBy: { holdExpiresAt: "asc" },
    }),
  ]);

  const activeBookings = activeNow as any[];


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
        <a href="/staff/bookings/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-violet-900/20 active:scale-95">
          <Plus className="w-4 h-4" /> New booking
        </a>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Today's Bookings" value={todayBookings.length} icon={BookOpen} iconColor="text-violet-400" subtitle="Scheduled for today" trend={{ value: 10, label: "up" }} />
        <StatCard title="Active Sessions" value={activeBookings.length} icon={Zap} iconColor="text-emerald-400" subtitle="Playing right now" trend={{ value: 5, label: "up" }} />
        <StatCard title="Pending Holds" value={holds.length} icon={Clock} iconColor="text-amber-400" subtitle="Expiring soon" trend={{ value: 0, label: "neutral" }} />
      </div>

      {/* Hold alerts */}
      {holds.length > 0 && <HoldAlert holds={holds as any} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Today's Schedule */}
        <div className="lg:col-span-8">
          <div className="glass-card overflow-hidden border-zinc-900/50">
            <div className="px-6 py-5 border-b border-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-bold text-white tracking-tight">Today's Schedule</h2>
              </div>
              <a href="/staff/calendar" className="text-[10px] font-black uppercase tracking-widest text-violet-400 hover:text-violet-300">View Calendar</a>
            </div>
            {todayBookings.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-16 italic font-medium">No bookings scheduled for today</p>
            ) : (
              <div className="divide-y divide-zinc-900">
                {todayBookings.map(b => (
                  <div key={b.id} className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-900/40 transition-colors">
                    <div className="text-center flex-shrink-0 w-20">
                      <p className="text-xs font-bold text-violet-400">{formatTimeRange(b.startDateTime, b.endDateTime).split("–")[0]}</p>
                      <p className="text-[10px] font-bold text-zinc-600">to {formatTimeRange(b.startDateTime, b.endDateTime).split("–")[1]}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{b.user?.name ?? (b as any).guestName ?? "Guest"}</p>
                      <p className="text-[11px] text-zinc-500 font-medium">{b.game.name}{b.resourceUnit ? ` · ${b.resourceUnit.unitName}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookingStatusBadge status={b.bookingStatus as any} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Activity & Upcoming */}
        <div className="lg:col-span-4 space-y-6">
          {/* Live Activity Section */}
          <div className="glass-card border-zinc-900/50 bg-zinc-950/30">
            <div className="px-5 py-4 border-b border-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-bold text-white">Live activity</h3>
              </div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{activeBookings.length} active</span>
            </div>
            <div className="p-2 space-y-1">
              {activeBookings.length > 0 ? activeBookings.map((b, i) => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-900/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0",
                      i % 2 === 0 ? "bg-violet-500/10 border-violet-500/20 text-violet-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    )}>
                      {b.user?.name?.substring(0, 2).toUpperCase() || (b as any).guestName?.substring(0, 2).toUpperCase() || 'GU'}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-zinc-200 truncate max-w-[120px]">{b.user?.name || (b as any).guestName || 'Guest User'}</p>
                      <p className="text-[10px] text-zinc-500 font-medium truncate max-w-[120px]">
                        {b.game?.name} {b.resourceUnit ? `• ${b.resourceUnit.unitName}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 flex-shrink-0">
                    {new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }).format(new Date(b.endDateTime))}
                  </div>
                </div>
              )) : (
                <p className="text-center py-8 text-zinc-600 text-xs font-medium italic">No active sessions</p>
              )}
            </div>
          </div>

          {/* Upcoming */}
          <div className="glass-card overflow-hidden border-zinc-900/50 bg-zinc-950/30">
            <div className="px-5 py-4 border-b border-zinc-900">
              <h2 className="text-sm font-bold text-white tracking-tight">Upcoming</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Next 7 days</p>
            </div>
            <div className="p-2 space-y-1">
              {upcomingBookings.length > 0 ? upcomingBookings.map(b => (
                <div key={b.id} className="p-3 rounded-xl hover:bg-zinc-900/50 transition-colors group">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-bold text-zinc-500">{formatDate(b.startDateTime)}</p>
                    <BookingStatusBadge status={b.bookingStatus as any} />
                  </div>
                  <p className="text-sm font-bold text-white group-hover:text-violet-400 transition-colors">{b.user?.name ?? (b as any).guestName ?? "Guest"}</p>
                  <p className="text-[10px] text-zinc-600 font-medium">{b.game.name}</p>
                </div>
              )) : (
                <p className="text-center py-8 text-zinc-600 text-xs italic">No upcoming bookings</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
