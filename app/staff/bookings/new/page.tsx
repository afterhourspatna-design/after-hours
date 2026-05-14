import BookingForm from "@/components/bookings/BookingForm";
import { ArrowLeft } from "lucide-react";

export default async function StaffNewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <a href="/staff/bookings"
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </a>
        <div>
          <h1 className="text-xl font-bold text-white">New Booking</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Booking placed on 15-min hold</p>
        </div>
      </div>
      <BookingForm
        mode="create"
        role="STAFF"
        prefillDate={params.start ? decodeURIComponent(params.start) : undefined}
      />
    </div>
  );
}
