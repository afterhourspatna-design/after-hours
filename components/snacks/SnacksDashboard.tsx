"use client";

import { useState, useEffect, useCallback } from "react";
import { Coins, Search, X, Edit, Trash2, CheckCircle2, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SnackOrder {
  id: string;
  userId: string | null;
  guestName: string | null;
  guestPhone: string | null;
  amount: string;
  paymentStatus: "UNPAID" | "PAID";
  paymentId: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    name: string;
    phone: string;
  };
}

export default function SnacksDashboard() {
  const [snacks, setSnacks] = useState<SnackOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 15;

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Form states
  const [snackGuestMode, setSnackGuestMode] = useState(false);
  const [snackGuestName, setSnackGuestName] = useState("");
  const [snackGuestPhone, setSnackGuestPhone] = useState("");
  const [snackSearchQuery, setSnackSearchQuery] = useState("");
  const [snackSelectedUser, setSnackSelectedUser] = useState<any | null>(null);
  const [snackUserResults, setSnackUserResults] = useState<any[]>([]);
  const [snackAmountInput, setSnackAmountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchSnacks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search ? { q: search } : {}),
      });
      const res = await fetch(`/api/snacks?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSnacks(data.snacks ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch snacks");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchSnacks();
  }, [fetchSnacks]);

  // User search debounce for snacks sale
  useEffect(() => {
    if (snackGuestMode || snackSearchQuery.length < 2) {
      setSnackUserResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/users?q=${encodeURIComponent(snackSearchQuery)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setSnackUserResults(data.users ?? []);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [snackSearchQuery, snackGuestMode]);

  const handleOpenModal = (snack?: SnackOrder) => {
    if (snack) {
      setEditingId(snack.id);
      setSnackAmountInput(snack.amount.toString());
      if (snack.user) {
        setSnackGuestMode(false);
        setSnackSelectedUser({ id: snack.userId, name: snack.user.name, phone: snack.user.phone });
        setSnackGuestName("");
        setSnackGuestPhone("");
      } else {
        setSnackGuestMode(true);
        setSnackGuestName(snack.guestName || "");
        setSnackGuestPhone(snack.guestPhone || "");
        setSnackSelectedUser(null);
      }
    } else {
      setEditingId(null);
      setSnackAmountInput("");
      setSnackGuestMode(false);
      setSnackGuestName("");
      setSnackGuestPhone("");
      setSnackSelectedUser(null);
    }
    setSnackSearchQuery("");
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!snackAmountInput || Number(snackAmountInput) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = { amount: Number(snackAmountInput) };
      
      if (!snackGuestMode) {
        if (!snackSelectedUser) {
          toast.error("Please select a registered user");
          setSubmitting(false);
          return;
        }
        payload.userId = snackSelectedUser.id;
        payload.guestName = null;
        payload.guestPhone = null;
      } else {
        if (!snackGuestName || !snackGuestPhone) {
          toast.error("Guest name and phone are required");
          setSubmitting(false);
          return;
        }
        payload.userId = null;
        payload.guestName = snackGuestName;
        payload.guestPhone = snackGuestPhone;
      }

      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `/api/snacks/${editingId}` : "/api/snacks";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(editingId ? "Snack order updated" : "Snack order created");
        fetchSnacks();
        handleCloseModal();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to save snack order");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmationId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmationId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/snacks/${deleteConfirmationId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Snack order deleted");
        setDeleteConfirmationId(null);
        fetchSnacks();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error");
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(val);
  const formatDate = (ds: string) => new Date(ds).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Snacks Orders</h1>
          <p className="text-sm text-zinc-400 mt-1">Manage standalone snack sales</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
            />
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex-shrink-0 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-violet-900/20 transition-all flex items-center gap-2 active:scale-95"
          >
            <Coins className="w-4 h-4" />
            <span>Record Snack</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-zinc-500 animate-pulse">Loading snacks...</div>
        ) : snacks.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
              <Coins className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-zinc-200 font-bold mb-1">No snack orders found</h3>
            <p className="text-sm text-zinc-500">There are no snack orders matching your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-900/50 text-xs uppercase text-zinc-500 font-semibold tracking-wider">
                <tr>
                  <th className="px-4 py-4">Customer</th>
                  <th className="px-4 py-4">Date & Time</th>
                  <th className="px-4 py-4">Amount</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {snacks.map((snack) => (
                  <tr key={snack.id} className="hover:bg-zinc-800/20 transition-colors group">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-white">{snack.user?.name ?? snack.guestName ?? "Guest"}</p>
                      {(snack.user?.phone || snack.guestPhone) && (
                        <p className="text-xs text-zinc-500">{snack.user?.phone ?? snack.guestPhone}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-zinc-400 whitespace-nowrap">
                      {formatDate(snack.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-emerald-400 font-medium">
                      {formatCurrency(Number(snack.amount))}
                    </td>
                    <td className="px-4 py-4">
                      {snack.paymentStatus === "PAID" ? (
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded uppercase tracking-wider">PAID</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 text-[10px] font-bold rounded uppercase tracking-wider">UNPAID</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {snack.paymentStatus !== "PAID" && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(snack)}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(snack.id)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800/50 bg-zinc-950/30">
            <p className="text-xs text-zinc-500 font-medium">
              Showing <span className="text-zinc-300">{(page - 1) * LIMIT + 1}</span> to <span className="text-zinc-300">{Math.min(page * LIMIT, total)}</span> of <span className="text-zinc-300">{total}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Standalone Snack Sale Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => !submitting && handleCloseModal()}
          />

          <div className="relative glass-card bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl z-10 p-6 space-y-5 animate-scale-in max-h-[90vh] custom-scroll overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-violet-400" />
                <h3 className="text-lg font-bold text-white">{editingId ? "Edit Snack Order" : "Record Snack Sale"}</h3>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={submitting}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Customer Type</label>
                <div className="flex items-center gap-2 bg-zinc-800/60 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setSnackGuestMode(false)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      !snackGuestMode ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    Registered
                  </button>
                  <button
                    type="button"
                    onClick={() => setSnackGuestMode(true)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      snackGuestMode ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    Guest
                  </button>
                </div>
              </div>

              {snackGuestMode ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 font-medium block mb-1">Guest Name (optional)</label>
                    <input
                      value={snackGuestName}
                      onChange={(e) => setSnackGuestName(e.target.value)}
                      placeholder="e.g. Ahmed Ali"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 font-medium block mb-1">Mobile Number (optional)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-bold">+91</span>
                      <input
                        type="tel"
                        maxLength={10}
                        value={snackGuestPhone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setSnackGuestPhone(val);
                        }}
                        placeholder="9876543210"
                        className="input-field pl-10"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <label className="text-xs text-zinc-500 font-medium block mb-1">Search Registered User</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    {snackSelectedUser ? (
                      <div className="input-field pl-9 flex items-center justify-between">
                        <span className="text-sm text-white">
                          {snackSelectedUser.name} <span className="text-zinc-500 text-xs">· {snackSelectedUser.phone}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSnackSelectedUser(null);
                            setSnackSearchQuery("");
                          }}
                        >
                          <X className="w-4 h-4 text-zinc-500 hover:text-white" />
                        </button>
                      </div>
                    ) : (
                      <input
                        value={snackSearchQuery}
                        onChange={(e) => setSnackSearchQuery(e.target.value)}
                        placeholder="Search by name or phone…"
                        className="input-field pl-9"
                      />
                    )}
                  </div>
                  {snackUserResults.length > 0 && !snackSelectedUser && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {snackUserResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSnackSelectedUser(u);
                            setSnackSearchQuery("");
                            setSnackUserResults([]);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-zinc-800 transition-colors flex items-center justify-between text-sm"
                        >
                          <span className="text-white">{u.name}</span>
                          <span className="text-xs text-zinc-500">{u.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Snack Amount */}
            <div>
              <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block mb-1">Snacks Amount (₹) *</label>
              <input
                type="number"
                value={snackAmountInput}
                onChange={(e) => setSnackAmountInput(e.target.value)}
                disabled={submitting}
                placeholder="Enter snacks amount"
                className="input-field text-lg font-bold"
              />
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex gap-3 text-blue-400 mt-2">
              <Info className="w-5 h-5 flex-shrink-0" />
              <div className="text-xs leading-relaxed">
                <p className="font-semibold mb-0.5">Note on Payments</p>
                This will create an UNPAID snack order in the customer's open tab. You can settle it via the Payments page when they check out.
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 border-t border-zinc-800/60 pt-4 mt-2">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={submitting}
                className="flex-1 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-semibold rounded-xl hover:text-white hover:bg-zinc-700 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  submitting ||
                  (Number(snackAmountInput) || 0) <= 0 ||
                  (!snackGuestMode && !snackSelectedUser) ||
                  (snackGuestMode && (!snackGuestName || !snackGuestPhone || snackGuestPhone.length !== 10))
                }
                className={cn(
                  "flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2",
                  submitting ? "opacity-70 cursor-not-allowed" : "active:scale-95 hover:shadow-violet-900/50"
                )}
              >
                {submitting ? (
                  <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{editingId ? "Update Order" : "Save Order"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => !deleting && setDeleteConfirmationId(null)}
          />

          <div className="relative glass-card bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl z-10 p-6 space-y-5 animate-scale-in">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Delete Snack Order</h3>
                <p className="text-sm text-zinc-400">Are you sure you want to delete this snack order? This action cannot be undone.</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmationId(null)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-semibold rounded-xl hover:text-white hover:bg-zinc-700 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg flex items-center justify-center"
              >
                {deleting ? (
                  <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
