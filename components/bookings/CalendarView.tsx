"use client";
import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useRouter } from "next/navigation";
import { GAME_COLOR_MAP, BOOKING_STATUS_CONFIG, cn } from "@/lib/utils";
import { format } from "date-fns";
import { X, Clock, Gamepad2, IndianRupee, CreditCard, Edit3, Phone } from "lucide-react";

interface CalendarBooking {
  id: string;
  startDateTime: string;
  endDateTime: string;
  bookingStatus: string;
  paymentStatus: string;
  guestName: string | null;
  guestPhone: string | null;
  durationMinutes: number;
  finalAmount: number;
  accessoriesCount?: number;
  usedCreditAmount?: number | null;
  notes?: string | null;
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
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);
  const [activeEventEl, setActiveEventEl] = useState<HTMLElement | null>(null);

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

  function closePopover() {
    if (activeEventEl) {
      activeEventEl.style.overflow = "";
      activeEventEl.style.zIndex = "";
    }
    setSelectedBooking(null);
    setActiveEventEl(null);
  }

  function handleEventClick(info: any) {
    if (activeEventEl) {
      activeEventEl.style.overflow = "";
      activeEventEl.style.zIndex = "";
    }

    const b = info.event.extendedProps.booking;
    setSelectedBooking(b);

    if (info.el) {
      info.el.style.overflow = "visible";
      info.el.style.zIndex = "9999";
      setActiveEventEl(info.el);
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

      {/* Booking Details Popover (Portal into clicked event element) */}
      {selectedBooking && activeEventEl && (
        (() => {
          const rect = activeEventEl.getBoundingClientRect();
          const popoverWidth = 290;
          const minLeftBoundary = 260; // Distance to clear left navigation sidebar

          let positionClass = "";

          // Horizontal positioning check
          if (rect.right + popoverWidth + 16 <= window.innerWidth) {
            // Room on right: place popover to the right of card
            positionClass += " left-full ml-2";
          } else if (rect.left - popoverWidth >= minLeftBoundary) {
            // Room on left without hitting left sidebar: place popover to the left of card
            positionClass += " right-full mr-2";
          } else {
            // Tight bounds: overlay safely aligned inside calendar grid
            positionClass += " right-0";
          }

          // Vertical positioning check
          if (rect.bottom + 280 > window.innerHeight && rect.top > 280) {
            positionClass += " bottom-0";
          } else {
            positionClass += " top-0";
          }

          return createPortal(
            <>
              {/* Invisible Backdrop for click-outside dismissal */}
              <div 
                className="fixed inset-0 z-[9998] bg-transparent cursor-default pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  closePopover();
                }}
              />
              
              <div 
                className={cn(
                  "absolute z-[9999] bg-zinc-950/95 border border-zinc-800 rounded-2xl p-3.5 w-[290px] shadow-2xl space-y-3 text-white backdrop-blur-md cursor-auto pointer-events-auto animate-in fade-in zoom-in-95 duration-150",
                  positionClass
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-zinc-900 pb-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-white tracking-tight leading-none">
                        {selectedBooking.user?.name ?? selectedBooking.guestName ?? "Guest"}
                      </h3>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                        selectedBooking.bookingStatus === "CONFIRMED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        selectedBooking.bookingStatus === "HOLD" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        selectedBooking.bookingStatus === "COMPLETED" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                        "bg-zinc-800 text-zinc-400 border border-zinc-700"
                      )}>
                        {selectedBooking.bookingStatus}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-zinc-500" />
                      +91 {selectedBooking.user?.phone ?? selectedBooking.guestPhone ?? "N/A"}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closePopover();
                    }}
                    className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-900 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-zinc-900/60 p-2 rounded-xl border border-zinc-800/80 space-y-0.5">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                      <Gamepad2 className="w-3 h-3 text-violet-400" /> Game / Unit
                    </p>
                    <p className="font-bold text-zinc-200 text-[11px] truncate">{selectedBooking.game.name}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{selectedBooking.resourceUnit?.unitName ?? "Unassigned"}</p>
                  </div>

                  <div className="bg-zinc-900/60 p-2 rounded-xl border border-zinc-800/80 space-y-0.5">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" /> Time Slot
                    </p>
                    <p className="font-bold text-zinc-200 text-[11px]">{selectedBooking.durationMinutes} Mins</p>
                    <p className="text-[10px] text-zinc-400 truncate">
                      {format(new Date(selectedBooking.startDateTime), "h:mm a")} - {format(new Date(selectedBooking.endDateTime), "h:mm a")}
                    </p>
                  </div>
                </div>

                {/* Notes if any */}
                {selectedBooking.notes && (
                  <div className="bg-zinc-900/50 p-2 rounded-xl border border-zinc-900 text-[10px]">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">Notes</p>
                    <p className="text-zinc-300 italic truncate">"{selectedBooking.notes}"</p>
                  </div>
                )}

                {/* Action Footer */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-900">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closePopover();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] font-bold transition-all"
                  >
                    Close
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closePopover();
                      const editPath = role === "ADMIN" 
                        ? `/admin/bookings/${selectedBooking.id}/edit` 
                        : `/staff/bookings/${selectedBooking.id}/edit`;
                      router.push(editPath);
                    }}
                    className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-bold transition-all flex items-center gap-1 shadow-lg shadow-violet-900/20 active:scale-95"
                  >
                    <Edit3 className="w-3 h-3" />
                    Edit Booking
                  </button>
                </div>
              </div>
            </>,
            activeEventEl
          );
        })()
      )}
    </div>
  );
}
