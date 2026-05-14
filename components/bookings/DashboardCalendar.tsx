"use client";

import dynamic from "next/dynamic";

const CalendarView = dynamic(() => import("@/components/bookings/CalendarView"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        <p className="text-xs text-zinc-500">Loading calendar…</p>
      </div>
    </div>
  ),
});

export default function DashboardCalendar() {
  return (
    <div className="p-4">
      <CalendarView initialView="timeGridDay" />
    </div>
  );
}
