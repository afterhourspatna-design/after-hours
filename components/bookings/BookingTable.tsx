"use client";

import { Suspense } from "react";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Search, Download, Edit2, XCircle, Trash2, RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  cn, formatCurrency, formatDate, formatTimeRange, formatDuration,
  BOOKING_STATUS_CONFIG, generateCSV, SOURCE_LABELS,
} from "@/lib/utils";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface Booking {
  id: string;
  guestName: string | null;
  guestPhone: string | null;
  startDateTime: string;
  endDateTime: string;
  durationMinutes: number;
  bookingStatus: string;
  paymentStatus: string;
  finalAmount: number;
  source: string;
  notes: string | null;
  holdExpiresAt: string | null;
  game: { name: string; tag: string };
  resourceUnit: { unitName: string } | null;
  user: { name: string; phone: string } | null;
}

interface BookingTableProps {
  role?: "ADMIN" | "STAFF";
}

const STATUS_FILTERS = ["ALL", "HOLD", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "EXPIRED"];

function BookingTableInner({ role = "ADMIN" }: BookingTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "ALL");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const LIMIT = 20;

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search ? { q: search } : {}),
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      });
      const res = await fetch(`/api/bookings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  async function handleStatusChange(id: string, status: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingStatus: status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Booking ${status.toLowerCase()}`);
      fetchBookings();
    } catch {
      toast.error("Failed to update booking");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/bookings/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Booking deleted");
      setDeleteId(null);
      fetchBookings();
    } catch {
      toast.error("Failed to delete booking");
    } finally {
      setDeleting(false);
    }
  }

  function exportCSV() {
    const rows = bookings.map((b) => ({
      ID: b.id,
      Customer: b.user?.name ?? b.guestName ?? "Guest",
      Phone: b.user?.phone ?? b.guestPhone ?? "",
      Game: b.game.name,
      Unit: b.resourceUnit?.unitName ?? "",
      Date: formatDate(b.startDateTime),
      Duration: formatDuration(b.durationMinutes),
      Status: b.bookingStatus,
      Payment: b.paymentStatus,
      Amount: b.finalAmount,
      Source: SOURCE_LABELS[b.source as keyof typeof SOURCE_LABELS] ?? b.source,
      Notes: b.notes ?? "",
    }));
    generateCSV(rows, "bookings");
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search customer, phone, notes…"
            className="input-field pl-9"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
                statusFilter === s
                  ? "bg-violet-600 border-violet-600 text-white"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
              )}
            >
              {s === "ALL" ? "All" : BOOKING_STATUS_CONFIG[s as keyof typeof BOOKING_STATUS_CONFIG]?.label ?? s}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button onClick={fetchBookings}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
            title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={exportCSV}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
            title="Export CSV">
            <Download className="w-4 h-4" />
          </button>
          <a href={role === "ADMIN" ? "/admin/bookings/new" : "/staff/bookings/new"}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-xl transition-all shadow-lg shadow-violet-900/20">
            <Plus className="w-3.5 h-3.5" /> New
          </a>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : bookings.length === 0 ? (
          <EmptyState
            title="No bookings found"
            description={search ? "Try a different search term" : "Create your first booking to get started"}
            action={
              <a href={role === "ADMIN" ? "/admin/bookings/new" : "/staff/bookings/new"}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl hover:bg-violet-500 transition-all">
                <Plus className="w-4 h-4" /> New Booking
              </a>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Game / Unit</th>
                  <th>Date & Time</th>
                  <th>Duration</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Source</th>
                  <th className="text-right min-w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const customerName = b.user?.name ?? b.guestName ?? "Guest";
                  const customerPhone = b.user?.phone ?? b.guestPhone ?? "";
                  const isHold = b.bookingStatus === "HOLD";
                  const isLoading = actionLoading === b.id;

                  return (
                    <tr key={b.id} className={cn(isHold && "bg-amber-500/5")}>
                      <td>
                        <div>
                          <p className="font-medium text-white text-sm">{customerName}</p>
                          {customerPhone && <p className="text-xs text-zinc-600">{customerPhone}</p>}
                          {!b.user && b.guestName && (
                            <span className="text-[10px] text-zinc-600">Guest</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <p className="text-sm text-zinc-200">{b.game.name}</p>
                        {b.resourceUnit && <p className="text-xs text-zinc-600">{b.resourceUnit.unitName}</p>}
                      </td>
                      <td className="whitespace-nowrap">
                        <p className="text-sm text-zinc-200">{formatDate(b.startDateTime)}</p>
                        <p className="text-xs text-zinc-600">{formatTimeRange(b.startDateTime, b.endDateTime)}</p>
                      </td>
                      <td className="text-sm text-zinc-400 whitespace-nowrap">
                        {formatDuration(b.durationMinutes)}
                      </td>
                      <td className="text-sm font-medium text-white whitespace-nowrap">
                        {formatCurrency(b.finalAmount)}
                      </td>
                      <td><BookingStatusBadge status={b.bookingStatus as any} /></td>
                      <td><PaymentStatusBadge status={b.paymentStatus as any} /></td>
                      <td className="text-xs text-zinc-500">{SOURCE_LABELS[b.source as keyof typeof SOURCE_LABELS] ?? b.source}</td>
                      <td>
                        <div className="flex items-center gap-1 justify-end flex-wrap">
                          {isHold && (
                            <button
                              onClick={() => handleStatusChange(b.id, "CONFIRMED")}
                              disabled={isLoading}
                              className="px-2 py-1 text-[10px] uppercase font-bold rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-600/20 transition-all"
                            >
                              Confirm
                            </button>
                          )}
                          {(role === "ADMIN" || role === "STAFF") && (
                            <button
                              onClick={() => router.push(role === "ADMIN" ? `/admin/bookings/${b.id}/edit` : `/staff/bookings/${b.id}/edit`)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {["HOLD", "PENDING", "CONFIRMED"].includes(b.bookingStatus) && (
                            <button
                              onClick={() => handleStatusChange(b.id, "CANCELLED")}
                              disabled={isLoading}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                              title="Cancel"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {role === "ADMIN" && (
                            <button
                              onClick={() => setDeleteId(b.id)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/60">
            <p className="text-xs text-zinc-500">
              {total} total · page {page} of {totalPages}
            </p>
            <div className="flex gap-1.5">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 hover:bg-zinc-800 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 hover:bg-zinc-800 transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Booking"
        description="This action cannot be undone. The booking will be permanently removed."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
        destructive
      />
    </div>
  );
}

export default function BookingTable(props: BookingTableProps) {
  return (
    <Suspense fallback={<TableSkeleton rows={8} />}>
      <BookingTableInner {...props} />
    </Suspense>
  );
}
