"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Receipt, Plus, Trash2, Edit, Loader2, Search, AlertCircle,
  Tag, X, Wallet, Home, Landmark, Filter, PieChartIcon
} from "lucide-react";
import {
  startOfDay, endOfDay, startOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear,
} from "date-fns";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import StatCard from "@/components/ui/StatCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

// Validated dark-mode categorical palette (see dataviz skill palette.md) — fixed
// hue order, assigned by stable category identity (never by current rank/amount).
const CATEGORY_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300"];
const OTHER_COLOR = "#71717a";
const PAYMENT_MODE_COLORS: Record<PaymentMode, string> = { COUNTER: "#3987e5", HOUSE: "#d95926", BANK: "#199e70" };

type DatePreset = "all" | "today" | "week" | "month" | "lastMonth" | "year" | "custom";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
];

function getPresetRange(preset: DatePreset, customFrom: string, customTo: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case "month":
      return { from: startOfMonth(now), to: endOfDay(now) };
    case "lastMonth": {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm) };
    }
    case "year":
      return { from: startOfYear(now), to: endOfDay(now) };
    case "custom":
      return {
        from: customFrom ? startOfDay(new Date(customFrom)) : null,
        to: customTo ? endOfDay(new Date(customTo)) : null,
      };
    case "all":
    default:
      return { from: null, to: null };
  }
}

type PaymentMode = "COUNTER" | "HOUSE" | "BANK";

interface ExpenseCategory {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

interface Expense {
  id: string;
  date: string;
  paymentMode: PaymentMode;
  categoryId: string;
  amount: string | number;
  notes: string | null;
  category: { id: string; name: string };
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

const PAYMENT_MODES: { value: PaymentMode; label: string; icon: React.ElementType }[] = [
  { value: "COUNTER", label: "Counter", icon: Wallet },
  { value: "HOUSE", label: "House", icon: Home },
  { value: "BANK", label: "Bank", icon: Landmark },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpensesManagementPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAdding, setIsAdding] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPaymentMode, setFilterPaymentMode] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [form, setForm] = useState({
    date: todayStr(),
    paymentMode: "COUNTER" as PaymentMode,
    categoryId: "",
    amount: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/expenses");
      if (res.ok) {
        setExpenses(await res.json());
      } else {
        toast.error("Failed to load expenses");
      }
    } catch {
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/admin/expenses/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
        setForm((f) => (f.categoryId ? f : { ...f, categoryId: data.find((c: ExpenseCategory) => c.isActive)?.id ?? "" }));
      } else {
        toast.error("Failed to load categories");
      }
    } catch {
      toast.error("Failed to load categories");
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
  }, []);

  const activeCategories = categories.filter((c) => c.isActive);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.date) newErrors.date = "Date is required";
    if (!form.categoryId) newErrors.categoryId = "Category is required";
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) newErrors.amount = "Amount must be a positive number";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setForm({
      date: todayStr(),
      paymentMode: "COUNTER",
      categoryId: activeCategories[0]?.id ?? "",
      amount: "",
      notes: "",
    });
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const isEdit = !!editingExpense;
      const url = isEdit ? `/api/admin/expenses/${editingExpense.id}` : "/api/admin/expenses";
      const method = isEdit ? "PUT" : "POST";

      const payload = {
        date: form.date,
        paymentMode: form.paymentMode,
        categoryId: form.categoryId,
        amount: parseFloat(form.amount),
        notes: form.notes,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(isEdit ? "Expense updated" : "Expense added");
        setIsAdding(false);
        setEditingExpense(null);
        resetForm();
        fetchExpenses();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save expense");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const startEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setForm({
      date: expense.date.slice(0, 10),
      paymentMode: expense.paymentMode,
      categoryId: expense.categoryId,
      amount: String(expense.amount),
      notes: expense.notes ?? "",
    });
    setIsAdding(true);
    setErrors({});
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/expenses/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Expense deleted");
        fetchExpenses();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete expense");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      const res = await fetch("/api/admin/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (res.ok) {
        toast.success("Category added");
        setNewCategoryName("");
        fetchCategories();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add category");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setAddingCategory(false);
    }
  };

  const toggleCategoryActive = async (category: ExpenseCategory) => {
    try {
      const res = await fetch(`/api/admin/expenses/categories/${category.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !category.isActive }),
      });
      if (res.ok) {
        fetchCategories();
      } else {
        toast.error("Failed to update category");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const handleDeleteCategory = async (category: ExpenseCategory) => {
    if (!confirm(`Delete category "${category.name}"? If it's used by any expense, it will be deactivated instead.`)) return;
    try {
      const res = await fetch(`/api/admin/expenses/categories/${category.id}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || "Category deleted");
        fetchCategories();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete category");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const { from: rangeFrom, to: rangeTo } = useMemo(
    () => getPresetRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo]
  );

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (filterCategory && e.categoryId !== filterCategory) return false;
      if (filterPaymentMode && e.paymentMode !== filterPaymentMode) return false;
      if (search && !(e.notes ?? "").toLowerCase().includes(search.toLowerCase()) && !e.category.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      const d = new Date(e.date);
      if (rangeFrom && d < rangeFrom) return false;
      if (rangeTo && d > rangeTo) return false;
      return true;
    });
  }, [expenses, filterCategory, filterPaymentMode, search, rangeFrom, rangeTo]);

  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const byMode: Record<PaymentMode, number> = { COUNTER: 0, HOUSE: 0, BANK: 0 };
    for (const e of filteredExpenses) byMode[e.paymentMode] += Number(e.amount);
    return { total, byMode, count: filteredExpenses.length };
  }, [filteredExpenses]);

  // Color follows category identity (fixed slot by creation order — the
  // earliest-established categories keep a dedicated color), never the
  // current filter/amount, so a category's color never changes as filters
  // or spend levels change. Pie charts read part-to-whole at a glance only,
  // so we cap visible slices at 6 and fold anything past that into "Other".
  const categoryColorSlots = useMemo(() => {
    const byCreatedAt = [...categories].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return byCreatedAt.map((c) => c.name).slice(0, 6);
  }, [categories]);

  const categoryBreakdown = useMemo(() => {
    const sums = new Map<string, number>();
    for (const e of filteredExpenses) {
      sums.set(e.category.name, (sums.get(e.category.name) ?? 0) + Number(e.amount));
    }
    const rows: { name: string; value: number; color: string }[] = [];
    let otherTotal = 0;
    for (const [name, value] of sums.entries()) {
      const slot = categoryColorSlots.indexOf(name);
      if (slot >= 0) {
        rows.push({ name, value, color: CATEGORY_COLORS[slot] });
      } else {
        otherTotal += value;
      }
    }
    rows.sort((a, b) => categoryColorSlots.indexOf(a.name) - categoryColorSlots.indexOf(b.name));
    if (otherTotal > 0) rows.push({ name: "Other", value: otherTotal, color: OTHER_COLOR });
    return rows;
  }, [filteredExpenses, categoryColorSlots]);

  const paymentModeBreakdown = useMemo(() => {
    const sums: Record<PaymentMode, number> = { COUNTER: 0, HOUSE: 0, BANK: 0 };
    for (const e of filteredExpenses) sums[e.paymentMode] += Number(e.amount);
    return PAYMENT_MODES
      .filter((m) => sums[m.value] > 0)
      .map((m) => ({ name: m.label, value: sums[m.value], color: PAYMENT_MODE_COLORS[m.value] }));
  }, [filteredExpenses]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Expense Management</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Track business expenses by category and payment mode</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setManagingCategories(true)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-bold rounded-xl transition-all border border-zinc-800"
          >
            <Tag className="w-4 h-4" />
            Categories
          </button>
          <button
            onClick={() => {
              if (isAdding) {
                setIsAdding(false);
                setEditingExpense(null);
                resetForm();
              } else {
                setIsAdding(true);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-violet-900/20 active:scale-95"
          >
            {isAdding ? <Receipt className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isAdding ? "View Expenses" : "Add Expense"}
          </button>
        </div>
      </div>

      {!isAdding && (
        <>
          {/* Date range — one row, scopes the stats, charts, and table below it */}
          <div className="flex flex-wrap items-center gap-2">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setDatePreset(p.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                  datePreset === p.value
                    ? "bg-violet-600 border-violet-500 text-white"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-1.5 ml-1">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); setDatePreset("custom"); }}
                className="input-field w-auto text-xs py-1.5"
              />
              <span className="text-xs text-zinc-600">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setDatePreset("custom"); }}
                className="input-field w-auto text-xs py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total (Filtered)" value={`Rs. ${stats.total.toLocaleString()}`} icon={Receipt} loading={loading} />
            <StatCard title="Counter" value={`Rs. ${stats.byMode.COUNTER.toLocaleString()}`} icon={Wallet} loading={loading} />
            <StatCard title="House" value={`Rs. ${stats.byMode.HOUSE.toLocaleString()}`} icon={Home} loading={loading} />
            <StatCard title="Bank" value={`Rs. ${stats.byMode.BANK.toLocaleString()}`} icon={Landmark} loading={loading} />
          </div>

          {!loading && filteredExpenses.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <BreakdownPieCard title="By Category" data={categoryBreakdown} total={stats.total} />
              <BreakdownPieCard title="By Payment Mode" data={paymentModeBreakdown} total={stats.total} />
            </div>
          )}
        </>
      )}

      {isAdding ? (
        <div className="glass-card p-6 max-w-xl mx-auto animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-bold text-white mb-6">
            {editingExpense ? "Edit Expense" : "Add Expense"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Date *</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className={cn("input-field", errors.date && "border-red-500/50 bg-red-500/5")}
                />
                {errors.date && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.date}</p>}
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Payment Mode *</label>
                <select
                  value={form.paymentMode}
                  onChange={(e) => setForm({ ...form, paymentMode: e.target.value as PaymentMode })}
                  className="input-field"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Category *</label>
              {activeCategories.length === 0 ? (
                <div className="text-xs text-zinc-500 bg-zinc-950/40 border border-zinc-900 rounded-xl p-3">
                  No categories yet.{" "}
                  <button type="button" onClick={() => setManagingCategories(true)} className="text-violet-400 font-bold hover:underline">
                    Add one first
                  </button>
                </div>
              ) : (
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className={cn("input-field", errors.categoryId && "border-red-500/50 bg-red-500/5")}
                >
                  <option value="" disabled>Select category</option>
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              {errors.categoryId && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.categoryId}</p>}
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-bold">Rs.</span>
                <input
                  required
                  type="number"
                  step="any"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className={cn("input-field pl-10", errors.amount && "border-red-500/50 bg-red-500/5")}
                  placeholder="0"
                />
              </div>
              {errors.amount && <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.amount}</p>}
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input-field min-h-[80px] resize-none"
                placeholder="Optional details about this expense"
              />
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingExpense(null);
                  resetForm();
                }}
                className="w-1/2 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={activeCategories.length === 0}
                className="w-1/2 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-500 transition-all shadow-lg shadow-violet-900/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editingExpense ? "Save Changes" : "Add Expense"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes or category..."
                className="input-field pl-10"
              />
            </div>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input-field w-auto min-w-[160px]">
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select value={filterPaymentMode} onChange={(e) => setFilterPaymentMode(e.target.value)} className="input-field w-auto min-w-[140px]">
              <option value="">All Modes</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            {(filterCategory || filterPaymentMode || search) && (
              <button
                onClick={() => { setFilterCategory(""); setFilterPaymentMode(""); setSearch(""); }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
              >
                <Filter className="w-3.5 h-3.5" /> Clear Filters
              </button>
            )}
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-950/20">
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Date</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Category</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Payment Mode</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Amount</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Notes</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-20 text-center">
                        <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-zinc-500">Loading expenses...</p>
                      </td>
                    </tr>
                  ) : filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-20 text-center text-zinc-500">
                        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No expenses found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((e) => {
                      const modeInfo = PAYMENT_MODES.find((m) => m.value === e.paymentMode)!;
                      const ModeIcon = modeInfo.icon;
                      return (
                        <tr key={e.id} className="hover:bg-zinc-900/40 transition-colors group">
                          <td className="px-5 py-4 text-sm text-white font-medium">
                            {new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-5 py-4">
                            <span className="px-2 py-1 rounded-lg text-xs font-bold text-violet-400 bg-violet-500/5 border border-violet-500/10">
                              {e.category.name}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                              <ModeIcon className="w-3.5 h-3.5 text-zinc-500" />
                              {modeInfo.label}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm font-bold text-white">Rs. {Number(e.amount).toLocaleString()}</td>
                          <td className="px-5 py-4 text-xs text-zinc-500 max-w-xs truncate">{e.notes || "—"}</td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => startEdit(e)}
                                className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
                                title="Edit Expense"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(e)}
                                className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                title="Delete Expense"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {managingCategories && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setManagingCategories(false)} />
          <div className="relative glass-card p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">Expense Categories</h3>
              <button onClick={() => setManagingCategories(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name"
                className="input-field flex-1"
              />
              <button
                type="submit"
                disabled={addingCategory || !newCategoryName.trim()}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {addingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </form>

            <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scroll">
              {categories.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6">No categories yet. Add your first one above.</p>
              ) : (
                categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-950/40 border border-zinc-900">
                    <div className="flex items-center gap-2">
                      <span className={cn("w-1.5 h-1.5 rounded-full", c.isActive ? "bg-emerald-500" : "bg-zinc-600")} />
                      <span className={cn("text-sm font-medium", c.isActive ? "text-white" : "text-zinc-500 line-through")}>{c.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleCategoryActive(c)}
                        className="text-[10px] font-bold uppercase tracking-tight text-zinc-500 hover:text-white px-2 py-1 rounded-lg hover:bg-zinc-800 transition-all"
                      >
                        {c.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(c)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Expense"
        description={deleteTarget ? `Delete this Rs. ${Number(deleteTarget.amount).toLocaleString()} expense in "${deleteTarget.category.name}"? This cannot be undone.` : ""}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

interface BreakdownDatum {
  name: string;
  value: number;
  color: string;
}

/** Donut chart + manual legend (dot, name, amount, share). The full expense
 * table below already serves as this chart's table-view twin, so every value
 * here stays reachable without hovering. */
function BreakdownPieCard({ title, data, total }: { title: string; data: BreakdownDatum[]; total: number }) {
  return (
    <div className="glass-card p-5 border-zinc-800/80 bg-zinc-950/40">
      <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
        <PieChartIcon className="w-4 h-4 text-violet-400" />
        {title}
      </h3>
      {data.length === 0 ? (
        <p className="text-xs text-zinc-500 py-10 text-center">No expenses in this range</p>
      ) : (
        <div className="flex items-center gap-6">
          <div className="w-36 h-36 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} stroke="#0a0a0b" strokeWidth={2}>
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip
                  formatter={(v: number, name: string) => [`Rs. ${v.toLocaleString()}`, name]}
                  contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px", fontSize: "12px" }}
                  itemStyle={{ color: "#e4e4e7" }}
                  labelStyle={{ color: "#a1a1aa" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            {data.map((d) => (
              <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-zinc-300 truncate">{d.name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-white">Rs. {d.value.toLocaleString()}</span>
                  <span className="text-zinc-600 w-9 text-right">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
