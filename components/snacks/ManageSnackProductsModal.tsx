"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Pencil, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SnackCategory {
  id: string;
  name: string;
  isActive: boolean;
}

interface SnackProduct {
  id: string;
  name: string;
  price: string | number;
  isActive: boolean;
  categoryId: string | null;
  category?: { id: string; name: string } | null;
}

export default function ManageSnackProductsModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"products" | "categories">("products");

  // Products
  const [products, setProducts] = useState<SnackProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // Categories (fetched with includeInactive=1 so the product-assignment
  // dropdown can still show a category a product already has, even if it
  // was deactivated since)
  const [categories, setCategories] = useState<SnackCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);

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

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/snack-categories?includeInactive=1`);
      if (res.ok) setCategories(await res.json());
    } catch {
      toast.error("Failed to load categories");
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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
        body: JSON.stringify({ name, price, categoryId: newCategoryId || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to add item");
        return;
      }
      toast.success(`${name} added to the menu`);
      setNewName("");
      setNewPrice("");
      setNewCategoryId("");
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

  const changeProductCategory = async (p: SnackProduct, categoryId: string) => {
    setSavingId(p.id);
    try {
      const res = await fetch(`/api/snack-products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: categoryId || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to update category");
        return;
      }
      fetchProducts();
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return toast.error("Name is required");

    setCreatingCategory(true);
    try {
      const res = await fetch("/api/snack-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to add category");
        return;
      }
      toast.success(`${name} added`);
      setNewCategoryName("");
      fetchCategories();
    } finally {
      setCreatingCategory(false);
    }
  };

  const startEditCategory = (c: SnackCategory) => {
    setEditingCategoryId(c.id);
    setEditCategoryName(c.name);
  };

  const cancelEditCategory = () => setEditingCategoryId(null);

  const saveEditCategory = async (id: string) => {
    const name = editCategoryName.trim();
    if (!name) return toast.error("Name is required");

    setSavingCategoryId(id);
    try {
      const res = await fetch(`/api/snack-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to update category");
        return;
      }
      toast.success("Updated");
      setEditingCategoryId(null);
      fetchCategories();
      fetchProducts(); // category name may be shown inline on products
    } finally {
      setSavingCategoryId(null);
    }
  };

  const toggleCategoryActive = async (c: SnackCategory) => {
    setSavingCategoryId(c.id);
    try {
      const res = await fetch(`/api/snack-categories/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to update category");
        return;
      }
      fetchCategories();
    } finally {
      setSavingCategoryId(null);
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

        {/* Tabs */}
        <div className="flex items-center gap-2 bg-zinc-800/60 rounded-xl p-1 w-fit flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeTab === "products" ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            Products
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeTab === "categories" ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            Categories
          </button>
        </div>

        {activeTab === "products" ? (
          <>
            {/* Add product */}
            <div className="space-y-2 flex-shrink-0">
              <div className="flex gap-2">
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
                  className="px-3 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <select
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                disabled={creating}
                className="input-field text-xs py-1.5 w-full"
              >
                <option value="">No category</option>
                {categories.filter((c) => c.isActive).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-400 flex-shrink-0">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-zinc-700 text-orange-600 focus:ring-orange-500 bg-zinc-900 h-3.5 w-3.5"
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
                      "flex items-center gap-2 px-3 py-2 rounded-xl border flex-wrap",
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
                        <span className="text-sm text-white flex-1 truncate min-w-[80px]">{p.name}</span>
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
                    <select
                      value={p.categoryId ?? ""}
                      onChange={(e) => changeProductCategory(p, e.target.value)}
                      disabled={savingId === p.id}
                      className="input-field text-[11px] py-1 w-full order-last"
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}{!c.isActive ? " (inactive)" : ""}</option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* Add category */}
            <div className="flex gap-2 flex-shrink-0">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name"
                disabled={creatingCategory}
                className="input-field text-sm flex-1"
              />
              <button
                onClick={handleCreateCategory}
                disabled={creatingCategory || !newCategoryName.trim()}
                className="px-3 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Category list */}
            <div className="overflow-y-auto custom-scroll space-y-1.5 flex-1">
              {categories.length === 0 ? (
                <p className="text-center text-sm text-zinc-500 py-6">No categories yet.</p>
              ) : (
                categories.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl border",
                      c.isActive ? "bg-zinc-800/30 border-zinc-800/60" : "bg-zinc-950/40 border-zinc-800/40 opacity-60"
                    )}
                  >
                    {editingCategoryId === c.id ? (
                      <>
                        <input
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          className="input-field text-sm flex-1 py-1.5"
                        />
                        <button
                          onClick={() => saveEditCategory(c.id)}
                          disabled={savingCategoryId === c.id}
                          className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEditCategory}
                          className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-white flex-1 truncate">{c.name}</span>
                        <button
                          onClick={() => startEditCategory(c)}
                          disabled={savingCategoryId === c.id}
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleCategoryActive(c)}
                          disabled={savingCategoryId === c.id}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors",
                            c.isActive ? "text-red-400 hover:text-red-300 hover:bg-red-500/10" : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          )}
                          title={c.isActive ? "Deactivate" : "Reactivate"}
                        >
                          {c.isActive ? <Trash2 className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
