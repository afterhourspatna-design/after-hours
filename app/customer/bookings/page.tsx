import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatTimeRange, formatDuration, formatCurrency } from "@/lib/utils";
import { BookOpen, Plus, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

export default async function CustomerBookingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const bookings = await prisma.booking.findMany({
    where: { userId },
    include: {
      game: { select: { name: true, tag: true } },
      resourceUnit: { select: { unitName: true } },
    },
    orderBy: { startDateTime: "desc" },
  });

  const pending   = bookings.filter(b => b.bookingStatus === "PENDING");
  const active    = bookings.filter(b => ["HOLD", "CONFIRMED"].includes(b.bookingStatus));
  const past      = bookings.filter(b => ["COMPLETED", "CANCELLED", "EXPIRED"].includes(b.bookingStatus));

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">My Bookings</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Welcome back, {session.user.name}</p>
        </div>
        <a
          href="/customer/bookings/new"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-violet-900/30"
        >
          <Plus className="w-4 h-4" /> Book Now
        </a>
      </div>

      {bookings.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon={BookOpen}
            title="No bookings yet"
            description="Book a gaming session and it'll appear here"
            action={
              <a href="/customer/bookings/new" className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-500 transition-all">
                <Plus className="w-4 h-4" /> Book Now
              </a>
            }
          />
        </div>
      ) : (
        <>
          {/* ── Pending (Awaiting Confirmation) ── */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
                  Awaiting Confirmation ({pending.length})
                </h2>
              </div>

              {/* Info notice */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                <p>
                  These bookings are <strong>pending payment verification</strong> by our staff.
                  Please bring your UPI payment screenshot when you visit. We'll confirm your slot shortly.
                </p>
              </div>

              <div className="space-y-3">
                {pending.map(b => (
                  <div
                    key={b.id}
                    className="glass-card p-4 border-amber-500/20 bg-amber-500/5 flex items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white">{b.game.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold uppercase tracking-wide">
                          Pending Review
                        </span>
                      </div>
                      {b.resourceUnit && (
                        <p className="text-xs text-zinc-500 mt-0.5">{b.resourceUnit.unitName}</p>
                      )}
                      <p className="text-xs text-zinc-400 mt-1 font-medium">{formatDate(b.startDateTime)}</p>
                      <p className="text-xs text-zinc-500">
                        {formatTimeRange(b.startDateTime, b.endDateTime)} · {formatDuration(b.durationMinutes)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <p className="text-sm font-bold text-white">{formatCurrency(Number(b.finalAmount))}</p>
                      <p className="text-[10px] text-zinc-600 font-mono">
                        #{b.id.slice(-6).toUpperCase()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Confirmed / Upcoming ── */}
          {active.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                  Confirmed & Upcoming
                </h2>
              </div>
              <div className="space-y-3">
                {active.map(b => (
                  <div key={b.id} className="glass-card p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{b.game.name}</p>
                      {b.resourceUnit && (
                        <p className="text-xs text-zinc-500">{b.resourceUnit.unitName}</p>
                      )}
                      <p className="text-xs text-zinc-400 mt-1">{formatDate(b.startDateTime)}</p>
                      <p className="text-xs text-zinc-500">
                        {formatTimeRange(b.startDateTime, b.endDateTime)} · {formatDuration(b.durationMinutes)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-2">
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

          {/* ── Past Bookings ── */}
          {past.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Past Bookings</h2>
              <div className="glass-card overflow-hidden divide-y divide-zinc-800/60">
                {past.map(b => (
                  <div key={b.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 font-medium">{b.game.name}</p>
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
