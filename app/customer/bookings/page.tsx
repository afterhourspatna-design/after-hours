import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatTimeRange, formatDuration, formatCurrency } from "@/lib/utils";
import { BookOpen, Plus } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

export default async function CustomerBookingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const bookings = await prisma.booking.findMany({
    where: { userId },
    include: { game: { select: { name: true } }, resourceUnit: { select: { unitName: true } } },
    orderBy: { startDateTime: "desc" },
  });

  const active = bookings.filter(b => ["HOLD", "PENDING", "CONFIRMED"].includes(b.bookingStatus));
  const past = bookings.filter(b => ["COMPLETED", "CANCELLED", "EXPIRED"].includes(b.bookingStatus));

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">My Bookings</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Welcome, {session.user.name}</p>
        </div>
        <a href="/customer/bookings/new"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all">
          <Plus className="w-4 h-4" /> Book Now
        </a>
      </div>

      {bookings.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={BookOpen} title="No bookings yet" description="Book a gaming session to get started"
            action={<a href="/customer/bookings/new" className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl hover:bg-violet-500 transition-all"><Plus className="w-4 h-4" /> Book Now</a>} />
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Active & Upcoming</h2>
              <div className="space-y-3">
                {active.map(b => (
                  <div key={b.id} className="glass-card p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{b.game.name}</p>
                      {b.resourceUnit && <p className="text-xs text-zinc-500">{b.resourceUnit.unitName}</p>}
                      <p className="text-xs text-zinc-500 mt-1">{formatDate(b.startDateTime)}</p>
                      <p className="text-xs text-zinc-600">{formatTimeRange(b.startDateTime, b.endDateTime)} · {formatDuration(b.durationMinutes)}</p>
                    </div>
                    <div className="text-right space-y-2 flex-shrink-0">
                      <p className="text-sm font-bold text-white">{formatCurrency(Number(b.finalAmount))}</p>
                      <div className="flex flex-col gap-1 items-end">
                        <BookingStatusBadge status={b.bookingStatus as any} />
                        <PaymentStatusBadge status={b.paymentStatus as any} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Past Bookings</h2>
              <div className="glass-card overflow-hidden divide-y divide-zinc-800/60">
                {past.map(b => (
                  <div key={b.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200">{b.game.name}</p>
                      <p className="text-xs text-zinc-600">{formatDate(b.startDateTime)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-zinc-400">{formatCurrency(Number(b.finalAmount))}</span>
                      <BookingStatusBadge status={b.bookingStatus as any} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
