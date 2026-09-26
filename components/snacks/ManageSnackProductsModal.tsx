"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Pencil, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SnackProduct {
  id: string;
  name: string;
  price: string | number;
  isActive: boolean;
}

export default function ManageSnackProductsModal({ onClose }: { onClose: () => void }) {
  const [products, setProducts] = useState<SnackProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/snack-products?includeInactive=${showInactive ? "1" : "0"}`);
      if (res.ok) setProducts(await res.json());
    } catch {
      toast.error("Failed to load menu");
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleCreate = async () => {
    const name = newName.trim();
    const price = Number(newPrice);
    if (!name) return toast.error("Name is required");
    if (!price || price <= 0) return toast.error("Enter a valid price");

    setCreating(true);
    try {
      const res = await fetch("/api/snack-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to add item");
        return;
      }
      toast.success(`${name} added to the menu`);
      setNewName("");
      setNewPrice("");
      fetchProducts();
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (p: SnackProduct) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditPrice(String(p.price));
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    const name = editName.trim();
    const price = Number(editPrice);
    if (!name) return toast.error("Name is required");
    if (!price || price <= 0) return toast.error("Enter a valid price");

    setSavingId(id);
    try {
      const res = await fetch(`/api/snack-products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to update item");
        return;
      }
      toast.success("Updated");
      setEditingId(null);
      fetchProducts();
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (p: SnackProduct) => {
    setSavingId(p.id);
    try {
      const res = await fetch(`/api/snack-products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to update item");
        return;
      }
      fetchProducts();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative glass-card bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl z-10 p-6 space-y-4 animate-scale-in max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 flex-shrink-0">
          <h3 className="text-lg font-bold text-white">Snack Menu</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add product */}
        <div className="flex gap-2 flex-shrink-0">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New item name"
            disabled={creating}
            className="input-field text-sm flex-1"
          />
          <div className="relative w-24">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-bold">₹</span>
            <input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="Price"
              disabled={creating}
              className="input-field pl-6 text-sm"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim() || !newPrice}
            className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-400 flex-shrink-0">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-zinc-700 text-violet-600 focus:ring-violet-500 bg-zinc-900 h-3.5 w-3.5"
          />
          Show deactivated items
        </label>

        {/* Product list */}
        <div className="overflow-y-auto custom-scroll space-y-1.5 flex-1">
          {loading ? (
            <p className="text-center text-sm text-zinc-500 py-6">Loading…</p>
          ) : products.length === 0 ? (
            <p className="text-center text-sm text-zinc-500 py-6">No items on the menu yet.</p>
          ) : (
            products.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border",
                  p.isActive ? "bg-zinc-800/30 border-zinc-800/60" : "bg-zinc-950/40 border-zinc-800/40 opacity-60"
                )}
              >
                {editingId === p.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-field text-sm flex-1 py-1.5"
                    />
                    <div className="relative w-20">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-bold">₹</span>
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="input-field pl-5 text-sm py-1.5"
                      />
                    </div>
                    <button
                      onClick={() => saveEdit(p.id)}
                      disabled={savingId === p.id}
                      className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-white flex-1 truncate">{p.name}</span>
                    <span className="text-sm font-semibold text-zinc-300">₹{Number(p.price)}</span>
                    <button
                      onClick={() => startEdit(p)}
                      disabled={savingId === p.id}
                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleActive(p)}
                      disabled={savingId === p.id}
                      className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        p.isActive ? "text-red-400 hover:text-red-300 hover:bg-red-500/10" : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                      )}
                      title={p.isActive ? "Deactivate" : "Reactivate"}
                    >
                      {p.isActive ? <Trash2 className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
