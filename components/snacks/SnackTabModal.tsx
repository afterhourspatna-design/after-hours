"use client";

import { useState, useEffect, useCallback } from "react";
import { Info, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate, getISTDayRelative } from "@/lib/utils";
import SnackProductPicker, { SnackItemPayload } from "./SnackProductPicker";
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

export interface SnackOrder {
  id: string;
  userId: string | null;
  guestName: string | null;
  guestPhone: string | null;
  amount: string;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  paymentId: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { name: string; phone: string };
  items?: SnackOrderItem[];
}

// "Yesterday" / "Today" / "Tomorrow" or "27 Sep", plus the time.
function dayAndTime(iso: string) {
  const d = new Date(iso);
  const rel = getISTDayRelative(d);
  const day = rel === "other"
    ? d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })
    : rel.charAt(0).toUpperCase() + rel.slice(1);
  const time = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
  return { day, time };
}

interface SnackTabModalProps {
  orderId: string;
  onClose: () => void;
  /** Called after any item is added, edited or deleted, so the caller can refresh its own list. */
  onChanged?: () => void;
}

/** The same "Snack Tab" info popup used on the Snacks page's Info button —
 * shared so other screens (e.g. Payments' quick-add) open the identical view
 * instead of a stripped-down one. Fetches and manages its own order state by id. */
export default function SnackTabModal({ orderId, onClose, onChanged }: SnackTabModalProps) {
  const [order, setOrder] = useState<SnackOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<SnackOrderItem | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<SnackOrderItem | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/snacks/${orderId}`);
    if (res.ok) setOrder(await res.json());
    setLoading(false);
  }, [orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleAddItem = async (item: SnackItemPayload) => {
    const res = await fetch(`/api/snacks/${orderId}/items`, {
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
    setOrder(data);
    onChanged?.();
  };

  const saveEditItem = async (values: { quantity: number; unitPrice: number; notes: string | null }) => {
    if (!editingItem) return;
    try {
      const res = await fetch(`/api/snacks/${orderId}/items/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Item updated");
        setOrder(data);
        setEditingItem(null);
        onChanged?.();
      } else {
        toast.error(data.error || "Failed to update item");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const confirmDeleteItem = async () => {
    if (!deleteItemTarget) return;
    setDeletingItem(true);
    try {
      const res = await fetch(`/api/snacks/${orderId}/items/${deleteItemTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Item deleted");
        setOrder(await res.json());
        onChanged?.();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete item");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDeletingItem(false);
      setDeleteItemTarget(null);
    }
  };

  if (loading || !order) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
        <div className="relative glass-card bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl p-6 animate-scale-in flex items-center justify-center min-h-[160px]">
          <span className="w-6 h-6 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity" onClick={onClose} />

        <div className="relative glass-card bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl z-10 p-3 sm:p-6 animate-scale-in max-h-[90vh]">
          <div className="flex items-start justify-between gap-2 sm:gap-3 border-b border-zinc-800/60 pb-2.5 sm:pb-4 mb-2.5 sm:mb-4 flex-shrink-0">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-xl font-bold text-white flex items-center gap-1.5 sm:gap-2">
                <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 flex-shrink-0" />
                <span className="truncate">{order.user?.name ?? order.guestName ?? "Guest"}</span>
              </h3>
              <p className="text-[11px] sm:text-sm text-zinc-400 mt-0.5 sm:mt-1 flex items-center flex-wrap gap-x-1.5 sm:gap-x-2">
                {(order.user?.phone ?? order.guestPhone) && (
                  <>
                    <span>{order.user?.phone ?? order.guestPhone}</span>
                    <span>•</span>
                  </>
                )}
                <span>Snack tab from {dayAndTime(order.createdAt).day}, {dayAndTime(order.createdAt).time}</span>
                <span>•</span>
                <span className={
                  order.paymentStatus === "PAID" ? "text-emerald-400 font-semibold"
                  : order.paymentStatus === "PARTIAL" ? "text-amber-400 font-semibold"
                  : "text-red-400 font-semibold"
                }>
                  {order.paymentStatus === "PAID" ? "Paid" : order.paymentStatus === "PARTIAL" ? "Partly paid" : "Unpaid"}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <div className="text-right">
                <p className="text-[9px] sm:text-xs text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Total Amount</p>
                <p className="text-sm sm:text-xl font-bold text-emerald-400">{formatCurrency(Number(order.amount))}</p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {order.paymentStatus !== "PAID" && (
            <div className="mb-2.5 sm:mb-4 flex-shrink-0">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1 sm:mb-2">Add new item</p>
              <SnackProductPicker onAdd={handleAddItem} addLabel="Add" />
            </div>
          )}

          <div className="overflow-y-auto custom-scroll pr-2 space-y-2 sm:space-y-3">
            {order.items && order.items.length > 0 ? (
              order.items.map((item, idx) => (
                <div key={item.id} className="p-2 sm:p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/50 flex items-center justify-between gap-2 sm:gap-3 group">
                  <div className="flex items-start gap-2 sm:gap-4 min-w-0 flex-1">
                    <div className="hidden sm:flex w-8 h-8 rounded-full bg-zinc-800 items-center justify-center text-xs font-bold text-zinc-400 flex-shrink-0">
                      {order.items!.length - idx}
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
                  <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0">
                    <p className="text-sm sm:text-lg font-bold text-emerald-400 whitespace-nowrap">{formatCurrency(Number(item.amount))}</p>
                    {order.paymentStatus !== "PAID" && (
                      <>
                        <button
                          onClick={() => setEditingItem(item)}
                          className="p-1 sm:p-1.5 text-zinc-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
                          title="Edit quantity / price"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteItemTarget(item)}
                          className="p-1 sm:p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete line item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
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
              onClick={onClose}
              className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-all"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteItemTarget}
        title="Delete Item"
        description={
          deleteItemTarget
            ? `Remove ${deleteItemTarget.product?.name ?? deleteItemTarget.notes ?? "this item"}${
                deleteItemTarget.quantity && deleteItemTarget.quantity > 1 ? ` × ${deleteItemTarget.quantity}` : ""
              } (${formatCurrency(Number(deleteItemTarget.amount))}) from this tab? The tab total will go down by that amount.`
            : ""
        }
        confirmLabel="Delete Item"
        onConfirm={confirmDeleteItem}
        onCancel={() => !deletingItem && setDeleteItemTarget(null)}
        loading={deletingItem}
        destructive
      />

      {editingItem && (
        <SnackItemEditDialog
          itemName={editingItem.product?.name ?? editingItem.notes ?? "Item"}
          initialQuantity={editingItem.quantity ?? 1}
          initialUnitPrice={
            editingItem.unitPrice != null
              ? Number(editingItem.unitPrice)
              : Number(editingItem.amount) / (editingItem.quantity ?? 1)
          }
          initialNotes={editingItem.notes}
          onSave={saveEditItem}
          onClose={() => setEditingItem(null)}
        />
      )}
    </>
  );
}
