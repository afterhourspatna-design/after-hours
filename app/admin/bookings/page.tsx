import type { Metadata } from "next";
import BookingTable from "@/components/bookings/BookingTable";

export const metadata: Metadata = { title: "Bookings" };

export default function AdminBookingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Bookings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">All bookings across all games and resources</p>
      </div>
      <BookingTable role="ADMIN" />
    </div>
  );
}
