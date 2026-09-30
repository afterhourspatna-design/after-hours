import BookingTable from "@/components/bookings/BookingTable";
export default function StaffBookingsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">Workspace / Bookings</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Bookings</h1>
        <p className="text-xs sm:text-sm text-zinc-500 font-medium">Today's and future bookings</p>
      </div>
      <BookingTable role="STAFF" />
    </div>
  );
}
