import type { Metadata } from "next";
import BookingTable from "@/components/bookings/BookingTable";

export const metadata: Metadata = { title: "Bookings" };

export default function AdminBookingsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">Workspace / Bookings</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Bookings</h1>
        <p className="text-xs sm:text-sm text-zinc-500 font-medium">All bookings across all games and resources — shows today and past by default, use the date filter for upcoming ones.</p>
      </div>
      <BookingTable role="ADMIN" />
    </div>
  );
}
