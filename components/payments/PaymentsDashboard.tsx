"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Search, Download, RefreshCw, ChevronLeft, ChevronRight, CreditCard, X, Info, Coins, CheckCircle
} from "lucide-react";
import {
  cn, formatCurrency, formatDate, formatTimeRange, formatDuration,
} from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";

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
  negotiatedAmount: number | null;
  paymentMethod: string | null;
  cashAmount: number | null;
  onlineAmount: number | null;
  source: string;
  game: { name: string; tag: string };
  resourceUnit: { unitName: string } | null;
  user: { name: string; phone: string } | null;
  updatedAt: string | null;
  paymentId: string | null;
  snacksAmount: number | null;
}

interface PaymentGroup {
  paymentId: string;
  updatedAt: string;
  paymentMethod: string;
  totalActual: number;
  totalNegotiated: number;
  totalCash: number;
  totalOnline: number;
  totalSnacks: number;
  customerNames: string;
  bookings: Booking[];
}

interface PaymentsDashboardProps {
  role: "ADMIN" | "STAFF";
}

export default function PaymentsDashboard({ role }: PaymentsDashboardProps) {
  const [activeTab, setActiveTab] = useState<"UNPAID" | "PAID">("UNPAID");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paymentHistory, setPaymentHistory] = useState<PaymentGroup[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Payment Form States
  const [negotiatedInput, setNegotiatedInput] = useState("");
  const [snacksInput, setSnacksInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "ONLINE" | "MIXED">("ONLINE");
  const [cashInput, setCashInput] = useState("");
  const [onlineInput, setOnlineInput] = useState("");
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<PaymentGroup | null>(null);
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [payOnlySnacks, setPayOnlySnacks] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate]);

  useEffect(() => {
    setStartDate("");
    setEndDate("");
  }, [activeTab]);


  const LIMIT = 15;



  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "UNPAID") {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(LIMIT),
          includeSnacks: "1",
          ...(search ? { q: search } : {}),
          paymentStatus: "UNPAID",
        });
        const res = await fetch(`/api/bookings?${params}`);
        if (res.ok) {
          const data = await res.json();
          const list: Booking[] = (data.bookings ?? []).filter((b: Booking) => !["CANCELLED", "EXPIRED"].includes(b.bookingStatus));
          setBookings(list);
          setTotal(data.total ?? 0);
        }
      } else {
        // PAID tab -> Fetch from /api/payments
        const params = new URLSearchParams({
          page: String(page),
          limit: String(LIMIT),
          ...(search ? { q: search } : {}),
          ...(startDate ? { from: `${startDate}T00:00:00.000Z` } : {}),
          ...(endDate ? { to: `${endDate}T23:59:59.999Z` } : {}),
        });
        const res = await fetch(`/api/payments?${params}`);
        if (res.ok) {
          const data = await res.json();
          const mappedGroups: PaymentGroup[] = (data.payments ?? []).map((p: any) => {
            const snackBookings = (p.snackOrders ?? []).map((snack: any) => ({
              id: `SNACK_${snack.id}`,
              guestName: snack.guestName,
              guestPhone: snack.guestPhone,
              startDateTime: p.createdAt,
              endDateTime: p.createdAt,
              durationMinutes: 0,
              bookingStatus: "COMPLETED",
              paymentStatus: "PAID",
              finalAmount: snack.amount,
              negotiatedAmount: snack.amount,
              paymentMethod: p.paymentMethod,
              cashAmount: 0,
              onlineAmount: 0,
              source: "WALK_IN",
              game: { name: "Snacks", tag: "SNACK" },
              resourceUnit: null,
              user: snack.user,
              updatedAt: p.createdAt,
              paymentId: p.id,
              snacksAmount: snack.amount,
            }));

            const allBookings = [...p.bookings, ...snackBookings];
            const totalActual = allBookings.reduce((sum, b) => sum + Number(b.finalAmount), 0);
            const totalSnacks = (p.snackOrders ?? []).reduce((sum: number, s: any) => sum + Number(s.amount), 0);

            return {
              paymentId: p.id,
              updatedAt: p.createdAt,
              paymentMethod: p.paymentMethod,
              totalActual,
              totalNegotiated: Number(p.negotiatedAmount),
              totalCash: Number(p.cashAmount),
              totalOnline: Number(p.onlineAmount),
              totalSnacks,
              customerNames: p.customerNames,
              bookings: allBookings,
            };
          });
          setPaymentHistory(mappedGroups);
          setTotal(data.total ?? 0);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  }, [page, search, activeTab, startDate, endDate]);

  useEffect(() => {
    fetchBookings();
    setSelectedIds(new Set());
  }, [fetchBookings]);

  // Handle select all checkbox
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const ids = new Set(bookings.map((b) => b.id));
      setSelectedIds(ids);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Math totals for checkout
  const selectedBookings = bookings.filter((b) => selectedIds.has(b.id));
  const totalActualAmount = selectedBookings.reduce((sum, b) => sum + Number(b.finalAmount), 0);
  const totalActualGamesAmount = selectedBookings
    .filter((b) => !b.id.startsWith("SNACK_"))
    .reduce((sum, b) => sum + Number(b.finalAmount), 0);
  const totalActualSnacksAmount = selectedBookings
    .filter((b) => b.id.startsWith("SNACK_"))
    .reduce((sum, b) => sum + Number(b.finalAmount), 0);

  // Open modal and pre-fill values
  const handleOpenPayModal = () => {
    if (selectedIds.size === 0) return;
    setNegotiatedInput(String(totalActualGamesAmount));
    setSnacksInput(totalActualSnacksAmount > 0 ? String(totalActualSnacksAmount) : "");
    setPaymentMethod("ONLINE");
    setCashInput("");
    setOnlineInput("");
    setPayOnlySnacks(false);
    setEditPaymentId(null);
    setShowPayModal(true);
  };

  const handleOpenEditModal = (p: PaymentGroup) => {
    setEditPaymentId(p.paymentId);
    const bookingIds = p.bookings.map((b) => b.id);
    setSelectedIds(new Set(bookingIds));
    setNegotiatedInput(String(p.totalNegotiated));
    setSnacksInput(String(p.totalSnacks));
    setPaymentMethod(p.paymentMethod as "CASH" | "ONLINE" | "MIXED");
    setCashInput(p.totalCash ? String(p.totalCash) : "");
    setOnlineInput(p.totalOnline ? String(p.totalOnline) : "");
    setPayOnlySnacks(p.totalNegotiated === 0 && p.totalSnacks > 0);
    setShowPayModal(true);
  };


  const handleClosePayModal = () => {
    setShowPayModal(false);
    setEditPaymentId(null);
    setPayOnlySnacks(false);
    setSelectedIds(new Set());
  };


  // Real-time values
  const totalNegotiatedVal = payOnlySnacks ? 0 : (Number(negotiatedInput) || 0);
  const snacksVal = Number(snacksInput) || 0;
  const cashVal = Number(cashInput) || 0;
  const onlineVal = Number(onlineInput) || 0;
  const totalWithSnacks = totalNegotiatedVal + snacksVal;

  // Real-time validations
  const isSplitInvalid = paymentMethod === "MIXED" && Math.abs(cashVal + onlineVal - totalWithSnacks) > 0.01;
  const isNegotiatedInvalid = totalNegotiatedVal < 0;
  const isSnacksInvalid = editPaymentId ? snacksVal < 0 : snacksVal < totalActualSnacksAmount;
  const isSubmitDisabled = isNegotiatedInvalid || isSnacksInvalid || isSplitInvalid || submittingPayment;

  // Auto-fill simple Cash/Online values when Negotiated or Snacks changes
  useEffect(() => {
    const totalVal = totalNegotiatedVal + snacksVal;
    if (paymentMethod === "CASH") {
      setCashInput(String(totalVal));
      setOnlineInput("");
    } else if (paymentMethod === "ONLINE") {
      setOnlineInput(String(totalVal));
      setCashInput("");
    }
  }, [totalNegotiatedVal, snacksVal, paymentMethod]);

  const handleConfirmPayment = async () => {
    if (isSubmitDisabled) return;
    setSubmittingPayment(true);

    try {
      const payload = editPaymentId
        ? {
            paymentId: editPaymentId,
            negotiatedAmount: totalNegotiatedVal,
            snacksAmount: snacksVal,
            paymentMethod,
            cashAmount: paymentMethod === "MIXED" ? cashVal : paymentMethod === "CASH" ? totalWithSnacks : 0,
            onlineAmount: paymentMethod === "MIXED" ? onlineVal : paymentMethod === "ONLINE" ? totalWithSnacks : 0,
          }
        : {
            bookingIds: Array.from(selectedIds),
            negotiatedAmount: totalNegotiatedVal,
            snacksAmount: snacksVal,
            paymentMethod,
            cashAmount: paymentMethod === "MIXED" ? cashVal : paymentMethod === "CASH" ? totalWithSnacks : 0,
            onlineAmount: paymentMethod === "MIXED" ? onlineVal : paymentMethod === "ONLINE" ? totalWithSnacks : 0,
          };

      const method = editPaymentId ? "PUT" : "POST";
      const res = await fetch("/api/bookings/batch-pay", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Failed to process payment");

      toast.success(editPaymentId ? "Successfully updated payment!" : `Successfully processed payment for ${result.count} bookings!`);
      handleClosePayModal();
      fetchBookings();
    } catch (err: any) {
      toast.error(err.message || "Payment process failed");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Payment Management</h1>
          <p className="text-sm text-zinc-500">Track unpaid balances, settle tabs, and review payment history.</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("UNPAID")}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-all",
              activeTab === "UNPAID"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-900/20"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            Active / Unpaid
          </button>
          <button
            onClick={() => setActiveTab("PAID")}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-all",
              activeTab === "PAID"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-900/20"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            History / Paid
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center">

          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search customer, phone, notes…"
              className="input-field pl-9"
            />
          </div>
          <button
            onClick={fetchBookings}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all self-stretch flex items-center justify-center"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Date Filter Row for History tab */}
        {activeTab === "PAID" && (
          <div className="flex flex-wrap items-center gap-3 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/60 animate-fade-in">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Filter Date Range:</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field text-xs w-36 py-1.5 animate-fade-in"
              />
              <span className="text-xs text-zinc-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field text-xs w-36 py-1.5 animate-fade-in"
                min={startDate || undefined}
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg border border-zinc-700 transition-all active:scale-95"
              >
                Clear Range
              </button>
            )}
          </div>
        )}
      </div>

      {/* Payments Table */}
      <div className="glass-card overflow-hidden relative">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : (activeTab === "UNPAID" ? bookings.length === 0 : paymentHistory.length === 0) ? (
          <EmptyState
            title={activeTab === "UNPAID" ? "All settled up!" : "No payments history yet"}
            description={
              activeTab === "UNPAID"
                ? "All active bookings have been fully paid."
                : "Once you settle bookings, they will show up in this history list."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            {activeTab === "UNPAID" ? (
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        checked={bookings.length > 0 && selectedIds.size === bookings.length}
                        onChange={handleSelectAll}
                        className="rounded border-zinc-700 text-violet-600 focus:ring-violet-500 bg-zinc-900 h-4 w-4"
                      />
                    </th>
                    <th>Customer</th>
                    <th>Game / Unit</th>
                    <th>Date & Time</th>
                    <th>Duration</th>
                    <th>Actual Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const customerName = b.user?.name ?? b.guestName ?? "Guest";
                    const customerPhone = b.user?.phone ?? b.guestPhone ?? "";
                    const isChecked = selectedIds.has(b.id);

                    return (
                      <tr
                        key={b.id}
                        onClick={() => handleSelectRow(b.id)}
                        className={cn(
                          "cursor-pointer select-none",
                          isChecked && "bg-violet-900/10"
                        )}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleSelectRow(b.id)}
                            className="rounded border-zinc-700 text-violet-600 focus:ring-violet-500 bg-zinc-900 h-4 w-4"
                          />
                        </td>
                        <td>
                          <div>
                            <p className="font-medium text-white text-sm">{customerName}</p>
                            {customerPhone && <p className="text-xs text-zinc-600">{customerPhone}</p>}
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
                          {formatCurrency(Number(b.finalAmount))}
                        </td>
                        <td>
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase border",
                            b.paymentStatus === "PARTIAL" 
                              ? "bg-amber-600/10 text-amber-400 border-amber-600/20"
                              : "bg-red-600/10 text-red-400 border-red-600/20"
                          )}>
                            {b.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Customer(s)</th>
                    <th>Bookings Count</th>
                    <th>Actual Total</th>
                    <th>Settled Total</th>
                    <th>Method</th>
                    <th>Settle Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((p) => (
                    <tr
                      key={p.paymentId}
                      onClick={() => setSelectedPaymentDetail(p)}
                      className="cursor-pointer hover:bg-zinc-800/30 transition-colors"
                    >
                      <td>
                        <p className="font-bold text-violet-400 font-mono" title={p.paymentId}>
                          {p.paymentId.startsWith("LEGACY-") 
                            ? "#LEGACY" 
                            : `#${p.paymentId.substring(0, 8).toUpperCase()}`}
                        </p>
                      </td>
                      <td>
                        <p className="font-medium text-white text-sm">{p.customerNames}</p>
                      </td>
                      <td>
                        <p className="text-sm text-zinc-300">
                          {p.bookings.length} {p.bookings.length === 1 ? "booking" : "bookings"}
                        </p>
                      </td>
                      <td className="text-sm text-zinc-400 whitespace-nowrap">
                        {formatCurrency(p.totalActual)}
                      </td>
                      <td className="text-xs text-zinc-300 whitespace-nowrap">
                        <p className="text-sm font-semibold text-emerald-400">{formatCurrency(p.totalNegotiated + p.totalSnacks)}</p>
                        {p.totalSnacks > 0 && (
                          <p className="text-[10px] text-zinc-500">Games: {formatCurrency(p.totalNegotiated)} | Snacks: {formatCurrency(p.totalSnacks)}</p>
                        )}
                      </td>
                      <td>
                        <div className="text-xs">
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700 uppercase">
                            {p.paymentMethod}
                          </span>
                          {p.paymentMethod === "MIXED" && (
                            <p className="text-[10px] text-zinc-500 mt-1 whitespace-nowrap">
                              C: {formatCurrency(p.totalCash)} | O: {formatCurrency(p.totalOnline)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="text-xs text-zinc-500 whitespace-nowrap">
                        {formatDate(p.updatedAt)}
                      </td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setSelectedPaymentDetail(p)}
                            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg transition-colors"
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/60">
            <p className="text-xs text-zinc-500">
              {total} total · page {page} of {totalPages}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 hover:bg-zinc-800 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 hover:bg-zinc-800 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating checkout banner for unpaid selection */}
      {activeTab === "UNPAID" && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 max-w-2xl w-full px-4 z-40 animate-slide-in-right">
          <div className="bg-zinc-900 border border-violet-500/30 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-4 backdrop-blur-md bg-opacity-95">
            <div>
              <p className="text-xs text-zinc-400">Selected Bookings</p>
              <p className="text-sm font-bold text-white">
                {selectedIds.size} {selectedIds.size === 1 ? "booking" : "bookings"}
              </p>
            </div>

            <div className="text-right sm:text-left">
              <p className="text-xs text-zinc-400">Total Actual Amount</p>
              <p className="text-base font-extrabold text-violet-400">
                {formatCurrency(totalActualAmount)}
              </p>
            </div>

            <button
              onClick={handleOpenPayModal}
              className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold shadow-lg shadow-violet-900/30 hover:shadow-violet-800/40 transition-all text-sm"
            >
              <CreditCard className="w-4 h-4" />
              Settle Pay ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Pay Modal (bg page dim) */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop dim */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => !submittingPayment && handleClosePayModal()}
          />

          {/* Modal Container */}
          <div className="relative glass-card bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl z-10 p-6 space-y-5 animate-scale-in max-h-[90vh] custom-scroll overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-violet-400" />
                <h3 className="text-lg font-bold text-white">{editPaymentId ? "Edit Payment History" : "Settle Batch Payment"}</h3>
              </div>
              <button
                onClick={() => handleClosePayModal()}
                disabled={submittingPayment}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of bookings being paid */}
            <div className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-800/40 space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Bookings List</p>
              <div className="divide-y divide-zinc-800/40 max-h-32 overflow-y-auto custom-scroll pr-1">
                {selectedBookings.map((b) => (
                  <div key={b.id} className="py-2 flex justify-between text-xs">
                    <div>
                      <p className="font-semibold text-zinc-300">
                        {b.user?.name ?? b.guestName ?? "Guest"} ({b.game.name})
                      </p>
                      <p className="text-zinc-600">{formatDate(b.startDateTime)}</p>
                    </div>
                    <p className="font-bold text-zinc-300">{formatCurrency(Number(b.finalAmount))}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pay only for snacks option */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="payOnlySnacks"
                checked={payOnlySnacks}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setPayOnlySnacks(checked);
                  if (checked) {
                    setNegotiatedInput("0");
                  } else {
                    setNegotiatedInput(String(totalActualAmount));
                  }
                }}
                disabled={submittingPayment}
                className="rounded border-zinc-700 text-violet-600 focus:ring-violet-500 bg-zinc-900 h-4 w-4"
              />
              <label htmlFor="payOnlySnacks" className="text-xs font-semibold text-zinc-300 cursor-pointer">
                Pay only for snacks (Settle snacks amount, leave game payment pending)
              </label>
            </div>

            {/* Price section */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-1">Total Actual Amount</label>
                <div className="bg-zinc-800/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-400 truncate">
                  {formatCurrency(totalActualAmount)}
                </div>
              </div>

              <div>
                <label className="text-xs text-violet-400 font-bold block mb-1">Negotiated Amount</label>
                <input
                  type="number"
                  value={payOnlySnacks ? "0" : negotiatedInput}
                  onChange={(e) => setNegotiatedInput(e.target.value)}
                  disabled={submittingPayment || payOnlySnacks}
                  placeholder="Games amount"
                  className="input-field text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-violet-400 font-bold block mb-1">Snacks Amount</label>
                <input
                  type="number"
                  value={snacksInput}
                  onChange={(e) => setSnacksInput(e.target.value)}
                  disabled={submittingPayment}
                  placeholder="Snacks amount"
                  className="input-field text-xs"
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 font-medium block">Way of Payment</label>
              <div className="grid grid-cols-3 gap-2">
                {(["ONLINE", "CASH", "MIXED"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    disabled={submittingPayment}
                    className={cn(
                      "py-3 rounded-xl border text-xs font-semibold uppercase transition-all flex flex-col items-center justify-center gap-1.5",
                      paymentMethod === method
                        ? "bg-violet-600/10 border-violet-500 text-violet-400 shadow-md shadow-violet-950/20"
                        : "bg-zinc-800/30 border-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                    )}
                  >
                    <span>{method === "MIXED" ? "Cash + Online" : method.toLowerCase()}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mixed payment split input options */}
            {paymentMethod === "MIXED" && (
              <div className="grid grid-cols-2 gap-4 bg-zinc-950/20 p-4 border border-zinc-800/60 rounded-xl animate-fade-in">
                <div>
                  <label className="text-xs text-zinc-500 font-medium block mb-1">Cash Amount</label>
                  <input
                    type="number"
                    value={cashInput}
                    onChange={(e) => setCashInput(e.target.value)}
                    disabled={submittingPayment}
                    placeholder="Cash amount"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 font-medium block mb-1">Online Amount</label>
                  <input
                    type="number"
                    value={onlineInput}
                    onChange={(e) => setOnlineInput(e.target.value)}
                    disabled={submittingPayment}
                    placeholder="Online amount"
                    className="input-field"
                  />
                </div>

                {/* Validation check message */}
                <div className="col-span-2 flex items-start gap-2 text-[11px] text-amber-500 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Note: Combined sum of Cash (₹{cashVal}) + Online (₹{onlineVal}) must exactly equal the Overall Settled Amount (₹{totalWithSnacks}).
                  </p>
                </div>
              </div>
            )}

            {/* Summary details */}
            <div className="flex flex-col gap-1.5 bg-zinc-950/20 p-3 border border-zinc-800/60 rounded-xl">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Games Settled Total:</span>
                <span className="font-semibold text-white">{formatCurrency(totalNegotiatedVal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Snacks Total:</span>
                <span className="font-semibold text-white">{formatCurrency(snacksVal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-zinc-300 border-t border-zinc-800/40 pt-1.5 mt-0.5">
                <span>Overall Total to Pay:</span>
                <span className="text-sm text-emerald-400 font-extrabold">{formatCurrency(totalWithSnacks)}</span>
              </div>
            </div>

            {/* Warning alert if sum is wrong */}
            {isSplitInvalid && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  Mathematical error: Cash + Online (₹{(cashVal + onlineVal).toFixed(2)}) does not match overall total (₹{totalWithSnacks.toFixed(2)}).
                </p>
              </div>
            )}

            {/* Warning alert if snacksVal is less than pre-existing unpaid snacks */}
            {!editPaymentId && snacksVal < totalActualSnacksAmount && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  Validation error: Snacks amount cannot be less than pre-existing unpaid snacks (₹{totalActualSnacksAmount}). Adjust/delete snacks in the Snacks tab first.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 border-t border-zinc-800/60 pt-4">
              <button
                type="button"
                onClick={() => handleClosePayModal()}
                disabled={submittingPayment}
                className="flex-1 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-semibold rounded-xl hover:text-white hover:bg-zinc-700 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={isSubmitDisabled}
                className={cn(
                  "flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2",
                  isSubmitDisabled
                    ? "opacity-50 cursor-not-allowed"
                    : "shadow-violet-900/30 hover:shadow-violet-800/40"
                )}
              >
                {submittingPayment ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saddling...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {selectedPaymentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedPaymentDetail(null)}
          />

          {(() => {
            const actualGamesList = selectedPaymentDetail.bookings.filter(b => !b.id.startsWith("SNACK_") && b.game?.tag !== "SNACK");
            const actualSnacksList = selectedPaymentDetail.bookings.filter(b => b.id.startsWith("SNACK_") || b.game?.tag === "SNACK");
            const totalActualGamesPrice = actualGamesList.reduce((sum, b) => sum + Number(b.finalAmount), 0);

            return (
              <div className="relative glass-card bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl z-10 p-6 space-y-5 animate-scale-in max-h-[90vh] custom-scroll overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-violet-400" />
                    <h3 className="text-lg font-bold text-white font-mono">
                      Payment Details: {selectedPaymentDetail.paymentId.startsWith("LEGACY-") ? "#LEGACY" : selectedPaymentDetail.paymentId}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedPaymentDetail(null)}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Payment Info Metadata Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-zinc-950/40 p-4 border border-zinc-900 rounded-xl">
                  <div>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Settled Date</p>
                    <p className="text-sm font-semibold text-white mt-1">
                      {formatDate(selectedPaymentDetail.updatedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Payment Method</p>
                    <span className="inline-block px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold text-xs uppercase tracking-tight border border-zinc-700 mt-1">
                      {selectedPaymentDetail.paymentMethod}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Actual Games</p>
                    <p className="text-xs font-bold text-zinc-400 mt-1">
                      {formatCurrency(totalActualGamesPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">Games Settled</p>
                    <p className="text-xs font-bold text-zinc-200 mt-1">
                      {formatCurrency(selectedPaymentDetail.totalNegotiated)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">Snacks Paid</p>
                    <p className="text-xs font-bold text-zinc-200 mt-1">
                      {formatCurrency(selectedPaymentDetail.totalSnacks)}
                    </p>
                  </div>
                </div>

                {/* Overall settled total */}
                <div className="flex items-center justify-between text-xs bg-emerald-500/5 p-3 border border-emerald-500/10 rounded-xl">
                  <p className="text-emerald-400 font-bold">Overall Transaction Settled Total (Games + Snacks):</p>
                  <p className="text-sm font-extrabold text-emerald-400">
                    {formatCurrency(selectedPaymentDetail.totalNegotiated + selectedPaymentDetail.totalSnacks)}
                  </p>
                </div>

                {/* Split breakdown for MIXED payments */}
                {selectedPaymentDetail.paymentMethod === "MIXED" && (
                  <div className="flex items-center gap-6 text-xs bg-zinc-950/20 p-3 border border-zinc-800/60 rounded-xl">
                    <p className="text-zinc-400 font-medium">Split Breakdown:</p>
                    <p className="text-zinc-300">
                      <span className="font-semibold text-white">Cash Amount:</span> {formatCurrency(selectedPaymentDetail.totalCash)}
                    </p>
                    <p className="text-zinc-300">
                      <span className="font-semibold text-white">Online Amount:</span> {formatCurrency(selectedPaymentDetail.totalOnline)}
                    </p>
                  </div>
                )}

                {/* Bookings Included (Games) */}
                {actualGamesList.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Bookings Included ({actualGamesList.length})</h4>
                    <div className="border border-zinc-800/60 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs text-zinc-300 divide-y divide-zinc-800/40">
                        <thead className="bg-zinc-950/40 font-bold text-zinc-500 uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="p-3">Customer</th>
                            <th className="p-3">Game / Slot</th>
                            <th className="p-3 text-right">Actual Price</th>
                            <th className="p-3 text-right">Settled Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40">
                          {actualGamesList.map((bk) => (
                            <tr key={bk.id} className="hover:bg-zinc-800/20 transition-colors">
                              <td className="p-3">
                                <p className="font-semibold text-white">{bk.user?.name ?? bk.guestName ?? "Guest"}</p>
                                {bk.user?.phone || bk.guestPhone ? (
                                  <p className="text-[10px] text-zinc-600 mt-0.5">{bk.user?.phone ?? bk.guestPhone}</p>
                                ) : null}
                              </td>
                              <td className="p-3">
                                <p className="font-medium text-zinc-200">{bk.game.name}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">
                                  {formatDate(bk.startDateTime)} ({formatTimeRange(bk.startDateTime, bk.endDateTime)})
                                </p>
                              </td>
                              <td className="p-3 text-right text-zinc-400 font-medium">
                                {formatCurrency(Number(bk.finalAmount))}
                              </td>
                              <td className="p-3 text-right text-emerald-400 font-semibold">
                                {formatCurrency(Number(bk.negotiatedAmount ?? bk.finalAmount))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Snacks Purchased */}
                {actualSnacksList.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Snacks Purchased ({actualSnacksList.length})</h4>
                    <div className="border border-zinc-800/60 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs text-zinc-300 divide-y divide-zinc-800/40">
                        <thead className="bg-zinc-950/40 font-bold text-zinc-500 uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="p-3">Customer</th>
                            <th className="p-3">Item</th>
                            <th className="p-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40">
                          {actualSnacksList.map((sn) => (
                            <tr key={sn.id} className="hover:bg-zinc-800/20 transition-colors">
                              <td className="p-3">
                                <p className="font-semibold text-white">{sn.user?.name ?? sn.guestName ?? "Guest"}</p>
                                {sn.user?.phone || sn.guestPhone ? (
                                  <p className="text-[10px] text-zinc-600 mt-0.5">{sn.user?.phone ?? sn.guestPhone}</p>
                                ) : null}
                              </td>
                              <td className="p-3">
                                <p className="font-medium text-zinc-200">Snacks</p>
                              </td>
                              <td className="p-3 text-right text-emerald-400 font-semibold">
                                {formatCurrency(Number(sn.finalAmount))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex border-t border-zinc-800/60 pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentDetail(null)}
                    className="w-full py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-semibold rounded-xl hover:text-white hover:bg-zinc-700 transition-all"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}


    </div>
  );
}
