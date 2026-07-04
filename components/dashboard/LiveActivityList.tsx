"use client";

import { useEffect, useState } from "react";
import { Zap, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface Game {
  name: string;
  tag: string;
}

interface ResourceUnit {
  unitName: string;
}

interface User {
  name: string;
}

interface Booking {
  id: string;
  guestName: string | null;
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
}

export default function LiveActivityList({
  initialBookings,
  todayStartISO,
  todayEndISO,
  role = "ADMIN",
}: LiveActivityListProps) {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

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
    .filter((b) => b.bookingStatus === "CONFIRMED" || b.bookingStatus === "HOLD")
    .map((b) => {
      const start = new Date(b.startDateTime).getTime();
      const end = new Date(b.endDateTime).getTime();
      const nowTime = currentTime.getTime();

      const diffMins = Math.round((end - nowTime) / 60000);
      const startDiffMins = Math.round((start - nowTime) / 60000);

      let type: "overtime" | "ending-soon" | "active" | "upcoming" = "active";
      if (b.bookingStatus === "HOLD") {
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
    .sort((a, b) => {
      const typeOrder = { overtime: 0, "ending-soon": 1, active: 2, upcoming: 3 };
      if (typeOrder[a.type] !== typeOrder[b.type]) {
        return typeOrder[a.type] - typeOrder[b.type];
      }

      if (a.type === "overtime") {
        // Longer overtime (more negative minutes) first
        return a.diffMins - b.diffMins;
      }

      // Otherwise, soonest time first
      return a.diffMins - b.diffMins;
    });

  const currentlyPlayingCount = activeItems.filter(
    (item) => item.type === "active" || item.type === "ending-soon" || item.type === "overtime"
  ).length;

  return (
    <div className="glass-card border-zinc-900/50 bg-zinc-950/30">
      <div className="px-5 py-4 border-b border-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className={cn("w-4 h-4", currentlyPlayingCount > 0 ? "text-violet-400 animate-pulse" : "text-zinc-500")} />
          <h3 className="text-sm font-bold text-white">Live activity</h3>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />}
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            {currentlyPlayingCount} active
          </span>
        </div>
      </div>
      <div className="p-2 space-y-1 max-h-[480px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
        {activeItems.length > 0 ? (
          activeItems.map(({ b, diffMins, startDiffMins, type }) => {
            const name = b.user?.name ?? b.guestName ?? "Guest";
            const initials = name.substring(0, 2).toUpperCase();

            let badgeText = "";
            let badgeStyle = "";
            let cardStyle = "";

            if (type === "upcoming") {
              if (b.bookingStatus === "HOLD") {
                badgeText = "HOLD";
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
              badgeStyle = "bg-orange-500/20 border-orange-500/40 text-orange-400 animate-pulse";
              cardStyle = "border-l-2 border-l-orange-500 bg-orange-500/5";
            } else if (type === "overtime") {
              badgeText = `OVERTIME +${Math.abs(diffMins)}m`;
              badgeStyle = "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse border";
              cardStyle = "border-l-2 border-l-red-500 bg-red-500/5 shadow-lg shadow-red-950/10";
            }

            return (
              <div
                key={b.id}
                onClick={() => {
                  const basePath = role === "ADMIN" ? "admin" : "staff";
                  router.push(`/${basePath}/bookings/${b.id}/edit`);
                }}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl hover:bg-zinc-900/50 hover:bg-zinc-900/80 transition-colors group border border-transparent cursor-pointer",
                  cardStyle
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0",
                      type === "overtime"
                        ? "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse"
                        : type === "ending-soon"
                        ? "bg-orange-500/10 border-orange-500/20 text-orange-400"
                        : "bg-violet-500/10 border-violet-500/20 text-violet-400"
                    )}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-zinc-200 truncate max-w-[120px]">{name}</p>
                    <p className="text-[10px] text-zinc-500 font-medium truncate max-w-[120px]">
                      {b.game?.name} {b.resourceUnit ? `• ${b.resourceUnit.unitName}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {type !== "upcoming" && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Mark ${name}'s session as completed?`)) return;
                        try {
                          const res = await fetch(`/api/bookings/${b.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ bookingStatus: "COMPLETED" }),
                          });
                          if (res.ok) {
                            setBookings((prev) => prev.filter((item) => item.id !== b.id));
                          } else {
                            alert("Failed to complete session");
                          }
                        } catch (err) {
                          console.error(err);
                          alert("Error completing session");
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30 hover:text-white flex-shrink-0"
                      title="Mark Session Completed"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className={cn("text-[10px] font-mono font-bold px-2.5 py-1 rounded border flex-shrink-0", badgeStyle)}>
                    {badgeText}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-center py-8 text-zinc-600 text-xs font-medium italic">No active sessions</p>
        )}
      </div>
    </div>
  );
}
