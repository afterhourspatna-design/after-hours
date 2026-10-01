"use client";

import { useState, useEffect, useCallback } from "react";
import { Coins, Search, X, Trash2, ChevronLeft, ChevronRight, Info, ListPlus, Pencil } from "lucide-react";
import { cn, formatDate, getISTDayRelative } from "@/lib/utils";
import { toast } from "sonner";
import SnackProductPicker, { SnackItemPayload } from "./SnackProductPicker";
import ManageSnackProductsModal from "./ManageSnackProductsModal";
import SnackItemEditDialog from "./SnackItemEditDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export interface SnackOrderItem {
  id: string;
  amount: string;
  notes: string | null;
  productId?: string | null;
  quantity?: number | null;
  unitPrice?: string | number | null;
  product?: { name: string } | null;
  addedBy: { name: string } | null;
  createdAt: string;
}

interface SnackOrder {
  id: string;
  userId: string | null;
  guestName: string | null;
  guestPhone: string | null;
  amount: string;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  paymentId: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    name: string;
    phone: string;
  };
  items?: SnackOrderItem[];
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
  const [showManageProducts, setShowManageProducts] = useState(false);
  // The order this modal session is adding items to. Null until the first
  // item is added (for a brand-new tab), or pre-filled when adding to an
  // existing open one.
  const [savingItem, setSavingItem] = useState(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyOrder, setHistoryOrder] = useState<SnackOrder | null>(null);
  const [editingItem, setEditingItem] = useState<SnackOrderItem | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<{ orderId: string; item: SnackOrderItem } | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  // Form states
  const [snackGuestMode, setSnackGuestMode] = useState(false);
  const [snackGuestName, setSnackGuestName] = useState("");
  const [snackGuestPhone, setSnackGuestPhone] = useState("");
  const [snackSearchQuery, setSnackSearchQuery] = useState("");
  const [snackSelectedUser, setSnackSelectedUser] = useState<any | null>(null);
  const [tabPrompt, setTabPrompt] = useState<{ tab: SnackOrder; item: SnackItemPayload } | null>(null);
  const [snackUserResults, setSnackUserResults] = useState<any[]>([]);

  // Wait for a pause in typing before querying, instead of one request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchSnacks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
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
  }, [page, debouncedSearch]);

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

  const handleOpenModal = () => {
    setSnackGuestMode(false);
    setSnackGuestName("");
    setSnackGuestPhone("");
    setSnackSelectedUser(null);
    setSnackSearchQuery("");
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    fetchSnacks();
  };

  // Each add persists immediately (it's a running tab, not a draft to save).
  // Throwing here — rather than just toasting — keeps the picker's own
  // fields intact on failure, so a customer-selection mistake doesn't lose
  // what was already typed into the item form.
  const handleAddItem = async (item: SnackItemPayload, opts?: { target?: SnackOrder; forceNew?: boolean }) => {
    setSavingItem(true);
    try {
      const itemPayload = {
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        notes: item.notes,
      };

      const targetOrder = opts?.target;
      let res: Response;
      if (targetOrder) {
        res = await fetch(`/api/snacks/${targetOrder.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemPayload),
        });
      } else {
        const payload: any = { ...itemPayload };
        if (!snackGuestMode) {
          if (!snackSelectedUser) {
            toast.error("Please select a registered user");
            throw new Error("No user selected");
          }
          payload.userId = snackSelectedUser.id;

          // Registered customer: if they already have a snack tab today that
          // still has a balance, ask whether to merge into it or start a new one.
          if (!opts?.forceNew) {
            const lookup = await fetch(`/api/snacks?open=1&userId=${encodeURIComponent(snackSelectedUser.id)}`);
            if (lookup.ok) {
              const found = (await lookup.json()).snacks?.[0];
              if (found) {
                setTabPrompt({ tab: found, item });
                return;
              }
            }
          }
        } else {
          if (!snackGuestName) {
            toast.error("Guest name is required");
            throw new Error("Guest details missing");
          }
          payload.guestName = snackGuestName;
          payload.guestPhone = snackGuestPhone || null;
        }
        res = await fetch("/api/snacks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to add item");
        throw new Error(err.error || "Failed to add item");
      }

      const updated = await res.json();
      // Whether merged into an existing tab or a brand-new one was created,
      // land on the same Snack Tab (info) popup, where more items can be added.
      setShowModal(false);
      setHistoryOrder(updated);
      setShowHistoryModal(true);
      fetchSnacks();
    } finally {
      setSavingItem(false);
    }
  };

  // Adds a line to the tab shown in the Snack Tab popup. Throws on failure so
  // the picker keeps what was typed.
  const handleAddItemToOpenTab = async (item: SnackItemPayload) => {
    if (!historyOrder) return;
    const res = await fetch(`/api/snacks/${historyOrder.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        notes: item.notes,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to add item");
      throw new Error(data.error || "Failed to add item");
    }
    setHistoryOrder(data);
    fetchSnacks();
  };

  // Saves the edit dialog. Errors stay in the dialog (toast + it remains open).
  const saveEditItem = async (
    orderId: string,
    itemId: string,
    values: { quantity: number; unitPrice: number; notes: string | null }
  ) => {
    try {
      const res = await fetch(`/api/snacks/${orderId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Item updated");
        setHistoryOrder(data);
        setEditingItem(null);
        fetchSnacks();
      } else {
        toast.error(data.error || "Failed to update item");
      }
    } catch {
      toast.error("Network error");
    }
  };

  // Asks for confirmation in a popup first; the actual delete is below.
  const handleDeleteItem = (orderId: string, item: SnackOrderItem) => {
    setDeleteItemTarget({ orderId, item });
  };

  const confirmDeleteItem = async () => {
    if (!deleteItemTarget) return;
    const { orderId, item } = deleteItemTarget;
    setDeletingItem(true);
    try {
      const res = await fetch(`/api/snacks/${orderId}/items/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Item deleted");
        fetchSnacks();
        // Update history modal data if open
        const updatedOrder = await res.json();
        setHistoryOrder(updatedOrder);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete item");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setDeletingItem(false);
      setDeleteItemTarget(null);
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
        toast.success("Snack tab deleted");
        setDeleteConfirmationId(null);
        setShowHistoryModal(false);
        setHistoryOrder(null);
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

  // The tab the delete popup is asking about, so its message can be specific.
  const tabToDelete = deleteConfirmationId ? snacks.find((s) => s.id === deleteConfirmationId) ?? null : null;

  // "Yesterday" / "Today" / "Tomorrow" or "27 Sep", plus the time, for the list.
  const dayAndTime = (iso: string) => {
    const d = new Date(iso);
    const rel = getISTDayRelative(d);
    const day = rel === "other"
      ? d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })
      : rel.charAt(0).toUpperCase() + rel.slice(1);
    const time = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
    return { day, time };
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(val);
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">Workspace / Snacks</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Snacks</h1>
          <p className="text-sm text-zinc-500 font-medium">Customer snack tabs — record sales, edit items and track what's unpaid.</p>
        </div>
        <div className="flex flex-col gap-3 w-full md:flex-row md:items-center md:w-auto">
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
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setShowManageProducts(true)}
              className="flex-1 md:flex-none justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 active:scale-95"
            >
              <ListPlus className="w-4 h-4" />
              <span>Menu</span>
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="flex-1 md:flex-none justify-center bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-orange-900/20 transition-all flex items-center gap-2 active:scale-95"
            >
              <Coins className="w-4 h-4" />
              <span>Record Snack</span>
            </button>
          </div>
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
            <h3 className="text-zinc-200 font-bold mb-1">No snack tabs found</h3>
            <p className="text-sm text-zinc-500">No snack tabs match your search. Use "Record Snack" to start one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] sm:min-w-[680px] table-fixed text-center text-xs sm:text-sm text-zinc-300">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[20%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead className="bg-zinc-900/50 text-[10px] sm:text-xs uppercase text-zinc-500 font-semibold tracking-wider">
                <tr>
                  <th className="px-2 py-3 sm:px-4 sm:py-4 text-center">Customer</th>
                  <th className="px-2 py-3 sm:px-4 sm:py-4 text-center">Date & Time</th>
                  <th className="px-2 py-3 sm:px-4 sm:py-4 text-center">Amount</th>
                  <th className="px-2 py-3 sm:px-4 sm:py-4 text-center">Status</th>
                  <th className="px-2 py-3 sm:px-4 sm:py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {snacks.map((snack) => {
                  const { day, time } = dayAndTime(snack.createdAt);
                  return (
                    <tr key={snack.id} className="hover:bg-zinc-800/20 transition-colors group">
                      <td className="px-2 py-3 sm:px-4 sm:py-4 text-center align-middle">
                        <p className="font-semibold text-white truncate">{snack.user?.name ?? snack.guestName ?? "Guest"}</p>
                        {(snack.user?.phone || snack.guestPhone) && (
                          <p className="text-[10px] sm:text-xs text-zinc-500 truncate">{snack.user?.phone ?? snack.guestPhone}</p>
                        )}
                      </td>
                      <td className="px-2 py-3 sm:px-4 sm:py-4 text-center align-middle whitespace-nowrap">
                        <p className="text-zinc-300">{day}</p>
                        <p className="text-[10px] sm:text-xs text-zinc-500">{time}</p>
                      </td>
                      <td className="px-2 py-3 sm:px-4 sm:py-4 text-center align-middle text-emerald-400 font-semibold whitespace-nowrap">
                        {formatCurrency(Number(snack.amount))}
                      </td>
                      <td className="px-2 py-3 sm:px-4 sm:py-4 text-center align-middle">
                        {snack.paymentStatus === "PAID" ? (
                          <span className="inline-block min-w-[56px] sm:min-w-[72px] px-1.5 sm:px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-[9px] sm:text-[10px] font-bold rounded uppercase tracking-wider">PAID</span>
                        ) : snack.paymentStatus === "PARTIAL" ? (
                          <span className="inline-block min-w-[56px] sm:min-w-[72px] px-1.5 sm:px-2.5 py-1 bg-amber-500/10 text-amber-400 text-[9px] sm:text-[10px] font-bold rounded uppercase tracking-wider">PARTIAL</span>
                        ) : (
                          <span className="inline-block min-w-[56px] sm:min-w-[72px] px-1.5 sm:px-2.5 py-1 bg-red-500/10 text-red-400 text-[9px] sm:text-[10px] font-bold rounded uppercase tracking-wider">UNPAID</span>
                        )}
                      </td>
                      <td className="px-2 py-3 sm:px-4 sm:py-4 text-center align-middle">
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                          <button
                            onClick={() => {
                              setHistoryOrder(snack);
                              setShowHistoryModal(true);
                            }}
                            className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-950/30 rounded-lg transition-colors"
                            title="Info"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                          {snack.paymentStatus !== "PAID" ? (
                            <button
                              onClick={() => handleDelete(snack.id)}
                              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="w-[28px]" aria-hidden="true" />
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

      {/* Snack Sale / Add-to-Tab Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => !savingItem && handleCloseModal()}
          />

          <div className="relative glass-card bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl z-10 p-3 sm:p-6 space-y-3 sm:space-y-5 animate-scale-in max-h-[90vh] custom-scroll overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2 sm:pb-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                <h3 className="text-sm sm:text-lg font-bold text-white">Record Snack Sale</h3>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {(
              /* Customer Toggle */
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] sm:text-xs text-zinc-400 font-semibold uppercase tracking-wider">Customer Type</label>
                  <div className="flex items-center gap-1 sm:gap-2 bg-zinc-800/60 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setSnackGuestMode(false)}
                      className={cn(
                        "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all",
                        !snackGuestMode ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      Registered
                    </button>
                    <button
                      type="button"
                      onClick={() => setSnackGuestMode(true)}
                      className={cn(
                        "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all",
                        snackGuestMode ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      Guest
                    </button>
                  </div>
                </div>

                {snackGuestMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] sm:text-xs text-zinc-500 font-medium block mb-1">Guest Name</label>
                      <input
                        value={snackGuestName}
                        onChange={(e) => setSnackGuestName(e.target.value)}
                        placeholder="e.g. Ahmed Ali"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] sm:text-xs text-zinc-500 font-medium block mb-1">Mobile Number (optional)</label>
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
                    <label className="text-[11px] sm:text-xs text-zinc-500 font-medium block mb-1">Search Registered User</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      {snackSelectedUser ? (
                        <div className="input-field pl-9 flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-white truncate">
                            {snackSelectedUser.name} <span className="text-zinc-500 text-[11px] sm:text-xs">· {snackSelectedUser.phone}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSnackSelectedUser(null);
                              setSnackSearchQuery("");
                            }}
                          >
                            <X className="w-4 h-4 text-zinc-500 hover:text-white flex-shrink-0" />
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
                            className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-left hover:bg-zinc-800 transition-colors flex items-center justify-between text-xs sm:text-sm"
                          >
                            <span className="text-white">{u.name}</span>
                            <span className="text-[11px] sm:text-xs text-zinc-500">{u.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Item picker */}
            <div>
              <label className="text-[11px] sm:text-xs text-zinc-400 font-semibold uppercase tracking-wider block mb-1 sm:mb-1.5">Add Item</label>
              <SnackProductPicker onAdd={handleAddItem} disabled={savingItem} />
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 sm:p-3 rounded-xl flex gap-2 sm:gap-3 text-blue-400 mt-1 sm:mt-2">
              <Info className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <div className="text-[11px] sm:text-xs leading-relaxed">
                <p className="font-semibold mb-0.5">Note on Payments</p>
                Items land in the customer's open tab as UNPAID. You can settle it via the Payments page when they check out.
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-zinc-800/60 pt-3 sm:pt-4 mt-1.5 sm:mt-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-full py-2 sm:py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs sm:text-sm font-semibold rounded-xl hover:text-white hover:bg-zinc-700 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      
      {/* History Modal */}
      {showHistoryModal && historyOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setShowHistoryModal(false)}
          />

          <div className="relative glass-card bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl z-10 p-3 sm:p-6 animate-scale-in max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-2 sm:gap-3 border-b border-zinc-800/60 pb-2.5 sm:pb-4 mb-2.5 sm:mb-4 flex-shrink-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-xl font-bold text-white flex items-center gap-1.5 sm:gap-2">
                  <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 flex-shrink-0" />
                  <span className="truncate">{historyOrder.user?.name ?? historyOrder.guestName ?? "Guest"}</span>
                </h3>
                <p className="text-[11px] sm:text-sm text-zinc-400 mt-0.5 sm:mt-1 flex items-center flex-wrap gap-x-1.5 sm:gap-x-2">
                  {(historyOrder.user?.phone ?? historyOrder.guestPhone) && (
                    <>
                      <span>{historyOrder.user?.phone ?? historyOrder.guestPhone}</span>
                      <span>•</span>
                    </>
                  )}
                  <span>Snack tab from {dayAndTime(historyOrder.createdAt).day}, {dayAndTime(historyOrder.createdAt).time}</span>
                  <span>•</span>
                  <span className={
                    historyOrder.paymentStatus === "PAID" ? "text-emerald-400 font-semibold"
                    : historyOrder.paymentStatus === "PARTIAL" ? "text-amber-400 font-semibold"
                    : "text-red-400 font-semibold"
                  }>
                    {historyOrder.paymentStatus === "PAID" ? "Paid" : historyOrder.paymentStatus === "PARTIAL" ? "Partly paid" : "Unpaid"}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                <div className="text-right">
                  <p className="text-[9px] sm:text-xs text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Total Amount</p>
                  <p className="text-sm sm:text-xl font-bold text-emerald-400">{formatCurrency(Number(historyOrder.amount))}</p>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-1.5 sm:p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {historyOrder.paymentStatus !== "PAID" && (
              <div className="mb-2.5 sm:mb-4 flex-shrink-0">
                <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1 sm:mb-2">Add new item</p>
                <SnackProductPicker onAdd={handleAddItemToOpenTab} addLabel="Add" />
              </div>
            )}

            <div className="overflow-y-auto custom-scroll pr-2 space-y-2 sm:space-y-3">
              {historyOrder.items && historyOrder.items.length > 0 ? (
                historyOrder.items.map((item, idx) => (
                  <div key={item.id} className="p-2 sm:p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/50 flex items-center justify-between gap-2 sm:gap-3 group">
                    <div className="flex items-start gap-2 sm:gap-4 min-w-0 flex-1">
                      <div className="hidden sm:flex w-8 h-8 rounded-full bg-zinc-800 items-center justify-center text-xs font-bold text-zinc-400 flex-shrink-0">
                        {historyOrder.items!.length - idx}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-white mb-0.5 truncate">
                          {item.product?.name ?? item.notes ?? "Added items"}
                          {item.quantity && item.quantity > 1 && <span className="text-zinc-500"> × {item.quantity}</span>}
                        </p>
                        {item.product?.name && item.notes && (
                          <p className="text-[10px] sm:text-xs text-zinc-500 mb-0.5 truncate">{item.notes}</p>
                        )}
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-zinc-500 flex-wrap">
                          <span>{formatDate(item.createdAt)}</span>
                          {item.addedBy && (
                            <>
                              <span>•</span>
                              <span className="truncate">Added by {item.addedBy.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {(
                      <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0">
                        <p className="text-sm sm:text-lg font-bold text-emerald-400 whitespace-nowrap">{formatCurrency(Number(item.amount))}</p>
                        {historyOrder.paymentStatus !== "PAID" && (
                          <>
                            <button
                              onClick={() => setEditingItem(item)}
                              className="p-1 sm:p-1.5 text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                              title="Edit quantity / price"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(historyOrder.id, item)}
                              className="p-1 sm:p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Delete line item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-zinc-500 bg-zinc-800/20 rounded-xl border border-zinc-800/50">
                  <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No item history available for this order.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-800/60 pt-4 mt-4 flex-shrink-0">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  fetchSnacks();
                }}
                className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-xl transition-all"
              >
                Save
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
                <h3 className="text-lg font-bold text-white mb-1">
                  Delete {tabToDelete ? `${tabToDelete.user?.name ?? tabToDelete.guestName ?? "Guest"}'s` : "this"} snack tab?
                </h3>
                <p className="text-sm text-zinc-400">
                  {tabToDelete ? (
                    <>
                      This removes the whole tab
                      {tabToDelete.items && tabToDelete.items.length > 0
                        ? ` — ${tabToDelete.items.length} item${tabToDelete.items.length === 1 ? "" : "s"}, ${formatCurrency(Number(tabToDelete.amount))} in total`
                        : ` (${formatCurrency(Number(tabToDelete.amount))})`}
                      . It won't be counted as owed any more and can't be brought back.
                      {tabToDelete.paymentStatus === "PARTIAL" && " Part of it has already been paid, so check the payment records afterwards."}
                    </>
                  ) : (
                    "This removes the whole tab and all its items, and can't be brought back."
                  )}
                </p>
                <p className="text-xs text-zinc-500 mt-2">To remove just one item, open Info and delete that item instead.</p>
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
                  "Delete Tab"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showManageProducts && (
        <ManageSnackProductsModal onClose={() => setShowManageProducts(false)} />
      )}

      <ConfirmDialog
        open={!!deleteItemTarget}
        title="Delete Item"
        description={
          deleteItemTarget
            ? `Remove ${deleteItemTarget.item.product?.name ?? deleteItemTarget.item.notes ?? "this item"}${
                deleteItemTarget.item.quantity && deleteItemTarget.item.quantity > 1 ? ` × ${deleteItemTarget.item.quantity}` : ""
              } (${formatCurrency(Number(deleteItemTarget.item.amount))}) from this tab? The tab total will go down by that amount.`
            : ""
        }
        confirmLabel="Delete Item"
        onConfirm={confirmDeleteItem}
        onCancel={() => !deletingItem && setDeleteItemTarget(null)}
        loading={deletingItem}
        destructive
      />

      {editingItem && historyOrder && (
        <SnackItemEditDialog
          itemName={editingItem.product?.name ?? editingItem.notes ?? "Item"}
          initialQuantity={editingItem.quantity ?? 1}
          initialUnitPrice={
            editingItem.unitPrice != null
              ? Number(editingItem.unitPrice)
              : Number(editingItem.amount) / (editingItem.quantity ?? 1)
          }
          initialNotes={editingItem.notes}
          onSave={(values) => saveEditItem(historyOrder.id, editingItem.id, values)}
          onClose={() => setEditingItem(null)}
        />
      )}

      {tabPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setTabPrompt(null)} />
          <div className="relative glass-card bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl animate-scale-in">
            <div>
              <h3 className="text-base font-bold text-white">Unpaid snacks already exist</h3>
              <p className="text-sm text-zinc-500 mt-1">
                {tabPrompt.tab.user?.name ?? "This customer"} already has a {tabPrompt.tab.paymentStatus === "PARTIAL" ? "partly paid" : "unpaid"} snack tab from today
                ({Number(tabPrompt.tab.amount).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                {tabPrompt.tab.items?.length ? `, ${tabPrompt.tab.items.length} item${tabPrompt.tab.items.length === 1 ? "" : "s"}` : ""}).
              </p>
            </div>
            <div className="bg-zinc-950/40 border border-zinc-800/60 rounded-xl p-3 text-xs">
              <p className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold mb-1">Adding</p>
              <p className="text-zinc-200 font-semibold">
                {tabPrompt.item.productName}{tabPrompt.item.quantity > 1 ? ` × ${tabPrompt.item.quantity}` : ""}
                <span className="text-zinc-500 font-normal"> — ₹{(tabPrompt.item.unitPrice * tabPrompt.item.quantity).toFixed(2)}</span>
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  const p = tabPrompt;
                  setTabPrompt(null);
                  handleAddItem(p.item, { target: p.tab });
                }}
                className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-xl transition-all"
              >
                Merge into existing tab
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = tabPrompt;
                  setTabPrompt(null);
                  handleAddItem(p.item, { forceNew: true });
                }}
                className="w-full py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-semibold rounded-xl hover:bg-zinc-700 transition-all"
              >
                Create new tab
              </button>
              <button
                type="button"
                onClick={() => setTabPrompt(null)}
                className="w-full py-2 text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
