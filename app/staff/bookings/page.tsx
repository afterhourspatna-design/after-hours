import BookingTable from "@/components/bookings/BookingTable";
export default function StaffBookingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Bookings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Today's and future bookings</p>
      </div>
      <BookingTable role="STAFF" />
    </div>
  );
}
