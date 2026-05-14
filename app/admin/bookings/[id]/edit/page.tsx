import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BookingForm from "@/components/bookings/BookingForm";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Edit Booking" };

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      game: true,
      resourceUnit: true,
      user: { select: { id: true, name: true, phone: true } },
    },
  });

  if (!booking) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <a href="/admin/bookings"
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </a>
        <div>
          <h1 className="text-xl font-bold text-white">Edit Booking</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {booking.user?.name ?? booking.guestName ?? "Guest"} · {booking.game.name}
          </p>
        </div>
      </div>
      <BookingForm mode="edit" role="ADMIN" initialData={booking} />
    </div>
  );
}
