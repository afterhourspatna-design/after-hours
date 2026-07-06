"use client";

// Dynamic import to avoid SSR issues with FullCalendar
import dynamic from "next/dynamic";

const CalendarClient = dynamic(
  () => import("@/components/bookings/CalendarView"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[700px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-xs text-zinc-500">Loading calendar…</p>
        </div>
      </div>
    ),
  }
);

export default function AdminCalendarPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Calendar</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Click a time slot to create a booking · Click an event to edit
          </p>
        </div>
        <a
          href="/admin/bookings/new"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all"
        >
          + New Booking
        </a>
      </div>

      <div className="glass-card overflow-hidden p-4">
        <CalendarClient role="ADMIN" initialView="timeGridDay" />
      </div>
    </div>
  );
}
