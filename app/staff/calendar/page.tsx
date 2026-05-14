"use client";

import dynamic from "next/dynamic";
const CalendarClient = dynamic(() => import("@/components/bookings/CalendarView"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  ),
});

export default function StaffCalendarPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Calendar</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Click a slot to create a booking</p>
        </div>
        <a href="/staff/bookings/new" className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all">
          + New Booking</a>
      </div>
      <div className="glass-card p-4 overflow-hidden">
        <CalendarClient role="STAFF" initialView="timeGridDay" newBookingPath="/staff/bookings/new" />
      </div>
    </div>
  );
}
