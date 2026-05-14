"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface HoldBooking {
  id: string;
  guestName: string | null;
  guestPhone: string | null;
  holdExpiresAt: string;
  finalAmount: number;
  game: { name: string; tag: string };
  resourceUnit: { unitName: string } | null;
  user: { name: string; phone: string } | null;
}

interface HoldAlertProps {
  holds: HoldBooking[];
}

export default function HoldAlert({ holds: initialHolds }: HoldAlertProps) {
  const [holds, setHolds] = useState(initialHolds);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Countdown refresh every 30s
  useEffect(() => {
    const id = setInterval(() => setHolds((h) => [...h]), 30000);
    return () => clearInterval(id);
  }, []);

  async function handleAction(bookingId: string, status: "CONFIRMED" | "CANCELLED") {
    setLoadingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingStatus: status }),
      });
      if (!res.ok) throw new Error();
      setHolds((h) => h.filter((b) => b.id !== bookingId));
      toast.success(status === "CONFIRMED" ? "Booking confirmed!" : "Booking cancelled");
    } catch {
      toast.error("Failed to update booking");
    } finally {
      setLoadingId(null);
    }
  }

  if (holds.length === 0) return null;

  return (
    <div className="glass-card border-amber-500/20 bg-amber-500/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-500/20 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-amber-300">
          {holds.length} booking{holds.length > 1 ? "s" : ""} on hold — confirm or cancel
        </span>
      </div>
      <div className="divide-y divide-zinc-800/40">
        {holds.map((hold) => {
          const name = hold.user?.name ?? hold.guestName ?? "Walk-in Guest";
          const phone = hold.user?.phone ?? hold.guestPhone ?? "";
          const expiresAt = new Date(hold.holdExpiresAt);
          const isExpiring = expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
          const isLoading = loadingId === hold.id;

          return (
            <div key={hold.id} className="flex items-center gap-4 px-4 py-3 flex-wrap">
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">{name}</span>
                  {phone && <span className="text-xs text-zinc-500">{phone}</span>}
                  <span className="badge bg-zinc-800 text-zinc-400 border-zinc-700">
                    {hold.game.name}
                  </span>
                  {hold.resourceUnit && (
                    <span className="text-xs text-zinc-600">{hold.resourceUnit.unitName}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-zinc-500">{formatCurrency(hold.finalAmount)}</span>
                  <span className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    isExpiring ? "text-red-400" : "text-amber-400"
                  )}>
                    <Clock className="w-3 h-3" />
                    Expires {formatDistanceToNow(expiresAt, { addSuffix: true })}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleAction(hold.id, "CONFIRMED")}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                             bg-emerald-600/20 text-emerald-400 border border-emerald-600/30
                             hover:bg-emerald-600/30 transition-all disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                  Confirm
                </button>
                <button
                  onClick={() => handleAction(hold.id, "CANCELLED")}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                             bg-red-600/20 text-red-400 border border-red-600/30
                             hover:bg-red-600/30 transition-all disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                  Cancel
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
