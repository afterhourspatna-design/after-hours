"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Wallet, Home, Landmark, ArrowRightLeft, Plus, Trash2, Edit,
  Loader2, X, AlertCircle, Pencil, ArrowRight, TrendingUp, TrendingDown, Minus
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type FundSource = "COUNTER" | "HOUSE" | "BANK";

const SOURCE_META: Record<FundSource, { label: string; icon: React.ElementType; iconClass: string }> = {
  COUNTER: { label: "Counter", icon: Wallet, iconClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  HOUSE: { label: "House", icon: Home, iconClass: "bg-amber-500/10 border-amber-500/30 text-amber-400" },
  BANK: { label: "Bank", icon: Landmark, iconClass: "bg-sky-500/10 border-sky-500/30 text-sky-400" },
};

interface SourceBreakdown {
  source: FundSource;
  opening: number;
  openingAnchorDate: string | null;
  revenue: number;
  expenses: number;
  transfersIn: number;
  transfersOut: number;
  calculatedClosing: number;
  actualClosing: number | null;
  difference: number | null;
}

interface FundTransaction {
  id: string;
  date: string;
  fromSource: FundSource;
  toSource: FundSource;
  amount: string | number;
  notes: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

export default function FundSettlementPanel({ date }: { date: string }) {
  const [sources, setSources] = useState<SourceBreakdown[]>([]);
  const [transactions, setTransactions] = useState<FundTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [actualEdit, setActualEdit] = useState<FundSource | null>(null);
  const [actualValue, setActualValue] = useState("");
  const [actualNotes, setActualNotes] = useState("");
  const [savingActual, setSavingActual] = useState(false);

  const [isAddingTx, setIsAddingTx] = useState(false);
  const [editingTx, setEditingTx] = useState<FundTransaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FundTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [txForm, setTxForm] = useState({ fromSource: "COUNTER" as FundSource, toSource: "BANK" as FundSource, amount: "", notes: "" });
  const [txErrors, setTxErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, txRes] = await Promise.all([
        fetch(`/api/admin/settlement/summary?date=${date}`),
        fetch(`/api/admin/settlement/transactions?date=${date}`),
      ]);
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSources(data.sources);
      } else {
        toast.error("Failed to load fund source summary");
      }
      if (txRes.ok) {
        setTransactions(await txRes.json());
      } else {
        toast.error("Failed to load transactions");
      }
    } catch {
      toast.error("Failed to load settlement data");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const startActualEdit = (breakdown: SourceBreakdown) => {
    setActualEdit(breakdown.source);
    setActualValue(String(breakdown.actualClosing ?? breakdown.calculatedClosing));
    setActualNotes("");
  };

  const saveActual = async () => {
    if (!actualEdit) return;
    const amt = parseFloat(actualValue);
    if (isNaN(amt)) {
      toast.error("Enter a valid amount");
      return;
    }
    setSavingActual(true);
    try {
      const res = await fetch("/api/admin/settlement/actual-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, source: actualEdit, amount: amt, notes: actualNotes }),
      });
      if (res.ok) {
        toast.success(`Actual closing set for ${SOURCE_META[actualEdit].label}`);
        setActualEdit(null);
        load();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to set actual closing balance");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSavingActual(false);
    }
  };

  const resetTxForm = () => {
    setTxForm({ fromSource: "COUNTER", toSource: "BANK", amount: "", notes: "" });
    setTxErrors({});
  };

  const validateTx = () => {
    const errs: Record<string, string> = {};
    if (txForm.fromSource === txForm.toSource) errs.toSource = "Must differ from source";
    const amt = parseFloat(txForm.amount);
    if (isNaN(amt) || amt <= 0) errs.amount = "Amount must be a positive number";
    setTxErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateTx()) return;

    try {
      const isEdit = !!editingTx;
      const url = isEdit ? `/api/admin/settlement/transactions/${editingTx.id}` : "/api/admin/settlement/transactions";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          fromSource: txForm.fromSource,
          toSource: txForm.toSource,
          amount: parseFloat(txForm.amount),
          notes: txForm.notes,
        }),
      });
      if (res.ok) {
        toast.success(isEdit ? "Transaction updated" : "Transaction added");
        setIsAddingTx(false);
        setEditingTx(null);
        resetTxForm();
        load();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save transaction");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const startEditTx = (tx: FundTransaction) => {
    setEditingTx(tx);
    setTxForm({ fromSource: tx.fromSource, toSource: tx.toSource, amount: String(tx.amount), notes: tx.notes ?? "" });
    setIsAddingTx(true);
    setTxErrors({});
  };

  const handleDeleteTx = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/settlement/transactions/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Transaction deleted");
        load();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete transaction");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Fund Source Cards */}
      <div>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-violet-400" />
          Fund Sources
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {sources.map((s) => {
            const meta = SOURCE_META[s.source];
            const Icon = meta.icon;
            const isEditingThis = actualEdit === s.source;
            const hasActual = s.actualClosing !== null;
            const diff = s.difference ?? 0;
            return (
              <div key={s.source} className="glass-card p-5 border-zinc-800/80 bg-zinc-950/40 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-2 rounded-xl border", meta.iconClass)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-white">{meta.label}</span>
                  </div>
                  {!isEditingThis && (
                    <button
                      onClick={() => startActualEdit(s)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
                      title="Set Actual Closing Balance"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isEditingThis ? (
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">
                        Actual Closing Balance ({date})
                      </label>
                      <input
                        type="number"
                        step="any"
                        autoFocus
                        value={actualValue}
                        onChange={(e) => setActualValue(e.target.value)}
                        className="input-field text-sm"
                      />
                      <p className="text-[10px] text-zinc-600 mt-1">Becomes tomorrow's opening balance</p>
                    </div>
                    <input
                      value={actualNotes}
                      onChange={(e) => setActualNotes(e.target.value)}
                      placeholder="Reason (optional)"
                      className="input-field text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActualEdit(null)}
                        className="flex-1 py-1.5 text-xs font-bold text-zinc-400 bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveActual}
                        disabled={savingActual}
                        className="flex-1 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {savingActual && <Loader2 className="w-3 h-3 animate-spin" />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">
                        Opening {!s.openingAnchorDate && <span className="text-zinc-600">(not set)</span>}
                      </span>
                      <span className="text-sm font-bold text-zinc-300">{formatCurrency(s.opening)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">Revenue</span>
                      <span className="text-sm font-medium text-emerald-400">+ {formatCurrency(s.revenue)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">Expenses</span>
                      <span className="text-sm font-medium text-red-400">- {formatCurrency(s.expenses)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">Transfers In</span>
                      <span className="text-sm font-medium text-emerald-400">+ {formatCurrency(s.transfersIn)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">Transfers Out</span>
                      <span className="text-sm font-medium text-red-400">- {formatCurrency(s.transfersOut)}</span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-zinc-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Calculated Closing</span>
                      <span className="text-base font-black text-white">{formatCurrency(s.calculatedClosing)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Actual Closing</span>
                      <span className={cn("text-base font-black", hasActual ? "text-white" : "text-zinc-600")}>
                        {hasActual ? formatCurrency(s.actualClosing!) : "Not entered"}
                      </span>
                    </div>
                    {hasActual && (
                      <div className={cn(
                        "flex items-center justify-between px-2.5 py-1.5 rounded-lg border mt-1",
                        diff === 0 ? "bg-zinc-900/60 border-zinc-800 text-zinc-500" :
                        diff > 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                        "bg-red-500/10 border-red-500/20 text-red-400"
                      )}>
                        <span className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
                          {diff === 0 ? <Minus className="w-3 h-3" /> : diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          Difference
                        </span>
                        <span className="text-xs font-bold">
                          {diff > 0 ? "+" : ""}{formatCurrency(diff)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Transactions */}
      <div className="glass-card overflow-hidden border-zinc-800/80 bg-zinc-950/40">
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-violet-400" />
              Fund Transfers
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">Money moved between sources on {date}</p>
          </div>
          <button
            onClick={() => {
              if (isAddingTx) {
                setIsAddingTx(false);
                setEditingTx(null);
                resetTxForm();
              } else {
                setIsAddingTx(true);
              }
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-violet-900/20 active:scale-95"
          >
            {isAddingTx ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {isAddingTx ? "Cancel" : "Add Transfer"}
          </button>
        </div>

        {isAddingTx && (
          <form onSubmit={handleTxSubmit} className="p-5 border-b border-zinc-800/80 bg-zinc-900/30 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">From</label>
                <select
                  value={txForm.fromSource}
                  onChange={(e) => setTxForm({ ...txForm, fromSource: e.target.value as FundSource })}
                  className="input-field text-sm"
                >
                  {(Object.keys(SOURCE_META) as FundSource[]).map((s) => (
                    <option key={s} value={s}>{SOURCE_META[s].label}</option>
                  ))}
                </select>
              </div>
              <div className="hidden sm:flex justify-center pb-2.5">
                <ArrowRight className="w-4 h-4 text-zinc-600" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">To</label>
                <select
                  value={txForm.toSource}
                  onChange={(e) => setTxForm({ ...txForm, toSource: e.target.value as FundSource })}
                  className={cn("input-field text-sm", txErrors.toSource && "border-red-500/50 bg-red-500/5")}
                >
                  {(Object.keys(SOURCE_META) as FundSource[]).map((s) => (
                    <option key={s} value={s}>{SOURCE_META[s].label}</option>
                  ))}
                </select>
                {txErrors.toSource && <p className="text-[10px] text-red-400 font-bold mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {txErrors.toSource}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-bold">Rs.</span>
                  <input
                    type="number"
                    step="any"
                    value={txForm.amount}
                    onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                    className={cn("input-field pl-10 text-sm", txErrors.amount && "border-red-500/50 bg-red-500/5")}
                    placeholder="0"
                  />
                </div>
                {txErrors.amount && <p className="text-[10px] text-red-400 font-bold mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {txErrors.amount}</p>}
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Notes</label>
                <input
                  value={txForm.notes}
                  onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                  className="input-field text-sm"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-violet-900/20 active:scale-95">
                {editingTx ? "Save Changes" : "Add Transfer"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-zinc-500">Loading transfers...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 text-sm">
            <ArrowRightLeft className="w-10 h-10 mx-auto mb-3 opacity-20" />
            No fund transfers recorded for this date.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-950/20">
                  <th className="px-5 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Transfer</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Amount</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Notes</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">By</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-900/40 transition-colors group">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <span>{SOURCE_META[tx.fromSource].label}</span>
                        <ArrowRight className="w-3 h-3 text-zinc-600" />
                        <span>{SOURCE_META[tx.toSource].label}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm font-bold text-white">{formatCurrency(Number(tx.amount))}</td>
                    <td className="px-5 py-3 text-xs text-zinc-500 max-w-xs truncate">{tx.notes || "—"}</td>
                    <td className="px-5 py-3 text-xs text-zinc-500">{tx.createdBy?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => startEditTx(tx)} className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all" title="Edit">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(tx)} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Transfer"
        description={deleteTarget ? `Delete this ${formatCurrency(Number(deleteTarget.amount))} transfer from ${SOURCE_META[deleteTarget.fromSource].label} to ${SOURCE_META[deleteTarget.toSource].label}?` : ""}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDeleteTx}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
