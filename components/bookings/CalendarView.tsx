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
  game: { name: string; tag: string };
  resourceUnit: { unitName: string } | null;
  user: { name: string; phone: string } | null;
}

interface CalendarViewProps {
  role?: "ADMIN" | "STAFF";
  initialView?: "timeGridDay" | "timeGridWeek";
  newBookingPath?: string;
}

export default function CalendarView({
  role = "ADMIN",
  initialView = "timeGridWeek",
  newBookingPath = "/admin/bookings/new",
}: CalendarViewProps) {
  const router = useRouter();
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
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

  const events = bookings.map((b) => {
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
              <p className="text-[10px] opacity-70">{statusLabel}</p>
            </div>
          );
        }}
        eventMouseEnter={(info) => {
          const { booking } = info.event.extendedProps;
          const name = booking.user?.name ?? booking.guestName ?? "Guest";
          info.el.title = `${name}\n${booking.game.name}\n${info.event.extendedProps.statusLabel}`;
        }}
      />
    </div>
  );
}
