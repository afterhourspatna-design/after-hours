"use client";

import { useState } from "react";
// Dynamic import to avoid SSR issues with FullCalendar
import dynamic from "next/dynamic";
import GameFilterDropdown from "@/components/bookings/GameFilterDropdown";

const CalendarClient = dynamic(
  () => import("@/components/bookings/CalendarView"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[700px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          <p className="text-xs text-zinc-500">Loading calendar…</p>
        </div>
      </div>
    ),
  }
);

export default function AdminCalendarPage() {
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
          <a
            href="/admin/bookings/new"
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-xl transition-all"
          >
            + New Booking
          </a>
        </div>
      </div>

      <div className="glass-card overflow-hidden p-4">
        <CalendarClient role="ADMIN" initialView="timeGridDay" selectedGameTag={selectedGameTag} />
      </div>
    </div>
  );
}
