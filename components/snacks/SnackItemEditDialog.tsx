"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface SnackItemEditDialogProps {
  itemName: string;
  initialQuantity: number;
  initialUnitPrice: number;
  initialNotes: string | null;
  onSave: (values: { quantity: number; unitPrice: number; notes: string | null }) => Promise<void>;
  onClose: () => void;
}

/** Small centered popup for changing one snack line's quantity, price and
 * note. A popup (rather than inline boxes) so it stays usable on phones. */
export default function SnackItemEditDialog({
  itemName, initialQuantity, initialUnitPrice, initialNotes, onSave, onClose,
}: SnackItemEditDialogProps) {
  const [quantity, setQuantity] = useState(String(initialQuantity));
  const [unitPrice, setUnitPrice] = useState(String(initialUnitPrice));
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, saving]);

  const qtyVal = Number(quantity);
  const priceVal = Number(unitPrice);
  const valid = Number.isInteger(qtyVal) && qtyVal >= 1 && Number.isFinite(priceVal) && priceVal > 0;
  const total = valid ? qtyVal * priceVal : 0;

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSave({ quantity: qtyVal, unitPrice: priceVal, notes: notes.trim() || null });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative glass-card bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xs p-5 space-y-4 shadow-2xl animate-scale-in">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Edit item</p>
            <h3 className="text-base font-bold text-white truncate">{itemName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1 text-zinc-500 hover:text-white rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
            Quantity
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input-field text-sm w-full mt-1"
            />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
            Price each
            <input
              type="number"
              min={0}
              inputMode="decimal"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="input-field text-sm w-full mt-1"
            />
          </label>
        </div>

        <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
          Note
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            className="input-field text-sm w-full mt-1"
          />
        </label>

        <div className="flex items-center justify-between text-sm border-t border-zinc-800/60 pt-3">
          <span className="text-zinc-500">Line total</span>
          <span className="font-bold text-emerald-400">{formatCurrency(total)}</span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 border border-zinc-700 text-zinc-300 text-sm font-medium rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!valid || saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
