"use client";
import { useEffect, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useRouter } from "next/navigation";
import { GAME_COLOR_MAP, BOOKING_STATUS_CONFIG } from "@/lib/utils";
import { format } from "date-fns";

interface CalendarBooking {
  id: string;
  startDateTime: string;
  endDateTime: string;
  bookingStatus: string;
  guestName: string | null;
  game: { name: string; tag: string; id: string };
  resourceUnit: { unitName: string } | null;
  user: { name: string; phone: string } | null;
}

interface Game {
  id: string;
  name: string;
  tag: string;
  isActive: boolean;
}

interface CalendarViewProps {
  role?: "ADMIN" | "STAFF";
  initialView?: "timeGridDay" | "timeGridWeek";
  newBookingPath?: string;
}

export default function CalendarView({
  role = "ADMIN",
  initialView = "timeGridDay",
  newBookingPath = "/admin/bookings/new",
}: CalendarViewProps) {
  const router = useRouter();
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameTag, setSelectedGameTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async (start: Date, end: Date) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        calendar: "1",
        from: start.toISOString(),
        to: end.toISOString(),
      });
      const res = await fetch(`/api/bookings?${params}`);
      if (res.ok) setBookings(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    const end = new Date(now);
    end.setDate(end.getDate() + 30);
    fetchBookings(start, end);
  }, [fetchBookings]);

  useEffect(() => {
    async function fetchGames() {
      try {
        const res = await fetch("/api/games");
        if (res.ok) {
          const data = await res.json();
          setGames(data.filter((g: any) => g.isActive));
        }
      } catch (err) {
        console.error("Failed to fetch games for calendar filter:", err);
      }
    }
    fetchGames();
  }, []);

  const filteredBookings = selectedGameTag
    ? bookings.filter((b) => b.game.tag === selectedGameTag)
    : bookings;

  const events = filteredBookings.map((b) => {
    const name = b.user?.name ?? b.guestName ?? "Guest";
    const unitName = b.resourceUnit?.unitName ?? "";
    const statusConfig = BOOKING_STATUS_CONFIG[b.bookingStatus as keyof typeof BOOKING_STATUS_CONFIG];
    const baseColor = GAME_COLOR_MAP[b.game.tag] ?? "#7c3aed";

    // Dim cancelled/expired
    const opacity = ["CANCELLED", "EXPIRED"].includes(b.bookingStatus) ? "60" : "";

    return {
      id: b.id,
      title: `${name} · ${b.game.name}`,
      start: b.startDateTime,
      end: b.endDateTime,
      backgroundColor: baseColor + opacity,
      borderColor: "transparent",
      textColor: "#ffffff",
      extendedProps: { booking: b, unitName, statusLabel: statusConfig?.label },
    };
  });

  function handleEventClick({ event }: any) {
    if (role === "ADMIN") {
      router.push(`/admin/bookings/${event.id}/edit`);
    } else if (role === "STAFF") {
      router.push(`/staff/bookings/${event.id}/edit`);
    }
  }

  function handleDateSelect({ startStr }: any) {
    const dt = encodeURIComponent(startStr);
    router.push(`${newBookingPath}?start=${dt}`);
  }

  function handleDatesSet({ start, end }: any) {
    fetchBookings(start, end);
  }

  return (
    <div className="relative space-y-4">
      {/* Game Filters */}
      <div className="flex flex-wrap gap-2 items-center bg-zinc-950/20 p-3 rounded-2xl border border-zinc-800/40">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2">Filter:</span>
        <button
          onClick={() => setSelectedGameTag(null)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            selectedGameTag === null
              ? "bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-500/20"
              : "bg-zinc-900/60 border-zinc-800/60 text-zinc-400 hover:border-zinc-700 hover:text-white"
          }`}
        >
          All Games
        </button>
        {games.map((g) => {
          const isSelected = selectedGameTag === g.tag;
          const gameColor = GAME_COLOR_MAP[g.tag] ?? "#7c3aed";
          return (
            <button
              key={g.id}
              onClick={() => setSelectedGameTag(g.tag)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-2 ${
                isSelected
                  ? "text-white"
                  : "bg-zinc-900/60 border-zinc-800/60 text-zinc-400 hover:border-zinc-700 hover:text-white"
              }`}
              style={
                isSelected
                  ? {
                      backgroundColor: gameColor,
                      borderColor: gameColor,
                      boxShadow: `0 10px 15px -3px ${gameColor}33`,
                    }
                  : {}
              }
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: gameColor }}
              />
              {g.name}
            </button>
          );
        })}
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute top-4 right-4 z-10">
            <div className="w-4 h-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        )}
        <FullCalendar
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView={initialView}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridDay,timeGridWeek",
          }}
          slotDuration="00:15:00"
          snapDuration="00:15:00"
          slotMinTime="10:00:00"
          slotMaxTime="24:00:00"
          allDaySlot={false}
          events={events}
          selectable={true}
          selectMirror={true}
          eventClick={handleEventClick}
          select={handleDateSelect}
          datesSet={handleDatesSet}
          height="auto"
          expandRows={true}
          nowIndicator={true}
          businessHours={{ daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: "10:00", endTime: "24:00" }}
          eventContent={(arg) => {
            const { booking, unitName, statusLabel } = arg.event.extendedProps;
            return (
              <div className="px-1.5 py-0.5 overflow-hidden h-full">
                <p className="text-[11px] font-semibold leading-tight truncate">
                  {arg.event.title}
                </p>
                {unitName && (
                  <p className="text-[10px] opacity-80 truncate">{unitName}</p>
                )}
                <p className="text-[10px] opacity-70 truncate">{statusLabel}</p>
                {booking.usedCreditAmount && Number(booking.usedCreditAmount) > 0 && (
                  <p className="text-[8px] uppercase tracking-wider font-bold text-violet-200 mt-0.5 truncate bg-violet-500/30 px-1 py-0.5 rounded w-max">
                    Paid via Credits
                  </p>
                )}
              </div>
            );
          }}
          eventMouseEnter={(info) => {
            const { booking } = info.event.extendedProps;
            const name = booking.user?.name ?? booking.guestName ?? "Guest";
            const start = info.event.start ? format(info.event.start, "h:mm a") : "";
            const end = info.event.end ? format(info.event.end, "h:mm a") : "";
            const timeRange = start && end ? `${start} - ${end}` : start;
            info.el.title = `${name}\n${booking.game.name}\n${timeRange}\n${info.event.extendedProps.statusLabel}`;
          }}
        />
      </div>
    </div>
  );
}
