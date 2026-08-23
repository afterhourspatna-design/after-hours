import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import BookingWizard from "@/components/customer/BookingWizard";

export default async function CustomerNewBookingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-0 py-4">
      <div className="flex items-center gap-3 mb-6">
        <a
          href="/customer/bookings"
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </a>
        <div>
          <h1 className="text-xl font-bold text-white">New Booking</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Book your gaming session</p>
        </div>
      </div>
      <BookingWizard />
    </div>
  );
}
