"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import GameFilterDropdown from "@/components/bookings/GameFilterDropdown";
const CalendarClient = dynamic(() => import("@/components/bookings/CalendarView"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
    </div>
  ),
});

export default function StaffCalendarPage() {
  const [selectedGameTag, setSelectedGameTag] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">Workspace / Calendar</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Calendar</h1>
        </div>
        <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
          <GameFilterDropdown value={selectedGameTag} onChange={setSelectedGameTag} />
          <a href="/staff/bookings/new" className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-xl transition-all">
            + New Booking</a>
        </div>
      </div>
      <div className="glass-card p-4 overflow-hidden">
        <CalendarClient role="STAFF" initialView="timeGridDay" selectedGameTag={selectedGameTag} />
      </div>
    </div>
  );
}
