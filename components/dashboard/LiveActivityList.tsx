"use client";

import { useEffect, useState } from "react";
import { Zap, Loader2, Check, Phone } from "lucide-react";
import { cn, formatTimeRange } from "@/lib/utils";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface Game {
  name: string;
  tag: string;
  totalUnits?: number;
}

interface ResourceUnit {
  unitName: string;
}

interface User {
  name: string;
  phone?: string | null;
}

interface Booking {
  id: string;
  guestName: string | null;
  guestPhone?: string | null;
  startDateTime: string;
  endDateTime: string;
  bookingStatus: string;
  game: Game | null;
  resourceUnit: ResourceUnit | null;
  user: User | null;
}

interface LiveActivityListProps {
  initialBookings: Booking[];
  todayStartISO: string;
  todayEndISO: string;
  role?: "ADMIN" | "STAFF";
  title?: string;
  emptyText?: string;
}

export default function LiveActivityList({
  initialBookings,
  todayStartISO,
  todayEndISO,
  role = "ADMIN",
  title = "Live activity",
  emptyText = "No active sessions",
}: LiveActivityListProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bookingToConfirm, setBookingToConfirm] = useState<Booking | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function handleConfirmCheckout() {
    if (!bookingToConfirm) return;
    setConfirmLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingToConfirm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingStatus: "COMPLETED" }),
      });
      if (res.ok) {
        setBookings((prev) => prev.filter((item) => item.id !== bookingToConfirm.id));
        setConfirmOpen(false);
      } else {
        alert("Failed to complete session");
      }
    } catch (err) {
      console.error(err);
      alert("Error completing session");
    } finally {
      setConfirmLoading(false);
    }
  }

  // Tick every 10 seconds to update remaining times
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Poll server every 30 seconds for any new/updated bookings
  useEffect(() => {
    async function refreshBookings() {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          calendar: "1",
          from: todayStartISO,
          to: todayEndISO,
        });
        const res = await fetch(`/api/bookings?${params}`);
        if (res.ok) {
          const data = await res.json();
          setBookings(data);
        }
      } catch (err) {
        console.error("Failed to refresh active bookings:", err);
      } finally {
        setLoading(false);
      }
    }

    const interval = setInterval(refreshBookings, 30000);
    return () => clearInterval(interval);
  }, [todayStartISO, todayEndISO]);

  const activeItems = bookings
    .filter((b) => b.bookingStatus !== "CANCELLED" && b.bookingStatus !== "COMPLETED" && b.bookingStatus !== "EXPIRED")
    .map((b) => {
      const start = new Date(b.startDateTime).getTime();
      const end = new Date(b.endDateTime).getTime();
      const nowTime = currentTime.getTime();

      const diffMins = Math.round((end - nowTime) / 60000);
      const startDiffMins = Math.round((start - nowTime) / 60000);

      let type: "overtime" | "ending-soon" | "active" | "upcoming" = "active";
      if (b.bookingStatus === "HOLD" || b.bookingStatus === "PENDING") {
        type = "upcoming";
      } else if (startDiffMins > 0) {
        type = "upcoming";
      } else if (diffMins <= 0) {
        type = "overtime";
      } else if (diffMins <= 5) {
        type = "ending-soon";
      }

      return { b, diffMins, startDiffMins, type };
    })
    .sort((a, b) => new Date(a.b.startDateTime).getTime() - new Date(b.b.startDateTime).getTime());

  const currentlyPlayingCount = activeItems.filter(
    (item) => item.type === "active" || item.type === "ending-soon" || item.type === "overtime"
  ).length;

  const overtimeItems = activeItems.filter((item) => item.type === "overtime");

  async function handleClearAllOvertime() {
    if (overtimeItems.length === 0) return;
    if (!confirm(`Mark all ${overtimeItems.length} overtime session(s) as completed?`)) return;

    setLoading(true);
    try {
      const promises = overtimeItems.map(({ b }) =>
        fetch(`/api/bookings/${b.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingStatus: "COMPLETED" }),
        })
      );
      await Promise.all(promises);
      const completedIds = overtimeItems.map(({ b }) => b.id);
      setBookings((prev) => prev.filter((item) => !completedIds.includes(item.id)));
    } catch (err) {
      console.error(err);
      alert("Error completing overtime sessions");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card border-zinc-900/50 bg-zinc-950/30">
      <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-zinc-900 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Zap className={cn("w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0", currentlyPlayingCount > 0 ? "text-orange-400 animate-pulse" : "text-zinc-500")} />
          <h3 className="text-sm sm:text-base font-bold text-white truncate">{title}</h3>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {overtimeItems.length > 0 && (
            <button
              onClick={handleClearAllOvertime}
              disabled={loading}
              className="text-[10px] sm:text-xs font-bold text-red-400 hover:text-white px-2 sm:px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50 whitespace-nowrap"
            >
              Clear Overtime ({overtimeItems.length})
            </button>
          )}
          {loading && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
          <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap">
            {currentlyPlayingCount} active
          </span>
        </div>
      </div>
      <div className="p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 max-h-[600px] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-zinc-800">
        {activeItems.length > 0 ? (
          activeItems.map(({ b, diffMins, startDiffMins, type }) => {
            const name = b.user?.name ?? b.guestName ?? "Guest";
            const initials = name.substring(0, 2).toUpperCase();
            const phone = b.user?.phone ?? b.guestPhone ?? null;

            let badgeText = "";
            let badgeStyle = "";
            let cardStyle = "";

            if (type === "upcoming") {
              if (b.bookingStatus === "HOLD") {
                badgeText = "HOLD";
                badgeStyle = "bg-amber-500/10 border-amber-500/20 text-amber-400";
              } else if (b.bookingStatus === "PENDING") {
                badgeText = "PENDING";
                badgeStyle = "bg-amber-500/10 border-amber-500/20 text-amber-400";
              } else {
                badgeText = `In ${startDiffMins}m`;
                badgeStyle = "bg-zinc-800/60 border-zinc-700/40 text-zinc-400";
              }
              cardStyle = "opacity-60 hover:opacity-100 transition-opacity";
            } else if (type === "active") {
              badgeText = `${diffMins}m left`;
              badgeStyle = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
            } else if (type === "ending-soon") {
              badgeText = `${diffMins}m left`;
              badgeStyle = "bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse";
              cardStyle = "border-l-2 border-l-rose-500 bg-rose-500/5";
            } else if (type === "overtime") {
              const overtimeMins = Math.abs(diffMins);
              badgeText = overtimeMins === 0 ? "OVERTIME" : `OVERTIME +${overtimeMins}m`;
              badgeStyle = "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse border";
              cardStyle = "border-l-2 border-l-red-500 bg-red-500/5 shadow-lg shadow-red-950/10";
            }

            return (
              <div
                key={b.id}
                className={cn(
                  "flex items-center justify-between p-2.5 sm:p-4 rounded-xl hover:bg-zinc-900/50 hover:bg-zinc-900/80 transition-colors group border border-transparent",
                  cardStyle
                )}
              >
                <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      "w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold border flex-shrink-0",
                      type === "overtime"
                        ? "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse"
                        : type === "ending-soon"
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                        : "bg-orange-500/10 border-orange-500/20 text-orange-400"
                    )}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1 pr-2 space-y-0.5 sm:space-y-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <p className="text-sm sm:text-base font-bold text-zinc-100 truncate">{name}</p>
                      {phone && (
                        <a
                          href={`tel:${phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-[11px] sm:text-xs text-zinc-500 hover:text-orange-400 font-mono transition-colors"
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
                    <p className="text-[11px] sm:text-xs text-zinc-500 font-mono">
                      {formatTimeRange(b.startDateTime, b.endDateTime)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
                  {type !== "upcoming" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBookingToConfirm(b);
                        setConfirmOpen(true);
                      }}
                      className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1.5 sm:p-2 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30 hover:text-white flex-shrink-0"
                      title="Mark Session Completed"
                    >
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                  <div className={cn("text-[10px] sm:text-xs font-mono font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border flex-shrink-0 whitespace-nowrap", badgeStyle)}>
                    {badgeText}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-center py-8 text-zinc-600 text-sm font-medium italic">{emptyText}</p>
        )}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Complete Session"
        description={`Are you sure you want to mark ${bookingToConfirm?.user?.name ?? bookingToConfirm?.guestName ?? "Guest"}'s session as completed?`}
        confirmLabel="Complete"
        onConfirm={handleConfirmCheckout}
        onCancel={() => setConfirmOpen(false)}
        loading={confirmLoading}
      />
    </div>
  );
}
