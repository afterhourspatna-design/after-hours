"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Zap, Search, RefreshCw, Loader2, Plus, Minus, User, Edit2, AlertCircle } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";

interface PrepaidUser {
  id: string;
  name: string;
  phone: string;
  prepaidHours: string | number; // Decimal string from DB
}

interface BalanceModalProps {
  user: PrepaidUser;
  onClose: () => void;
  onSaved: () => void;
}

function BalanceModal({ user, onClose, onSaved }: BalanceModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [action, setAction] = useState<"add" | "deduct">("add");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/prepaid-balances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          amount: action === "add" ? Number(amount) : -Number(amount),
          description
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update balance");
        return;
      }
      toast.success("Balance updated successfully!");
      onSaved();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card p-6 w-full max-w-sm animate-scale-in">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Zap className="w-5 h-5 text-violet-400" />
          Manage Balance
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Update prepaid hours for <span className="font-bold text-white">{user.name}</span>.
          Current Balance: <span className="font-bold text-violet-400">{user.prepaidHours} hrs</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex gap-2 p-1 bg-zinc-900 rounded-xl">
            <button
              type="button"
              onClick={() => setAction("add")}
              className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all", action === "add" ? "bg-violet-600 text-white" : "text-zinc-500 hover:text-white hover:bg-zinc-800")}
            >
              <Plus className="w-4 h-4" /> Add
            </button>
            <button
              type="button"
              onClick={() => setAction("deduct")}
              className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all", action === "deduct" ? "bg-red-600 text-white" : "text-zinc-500 hover:text-white hover:bg-zinc-800")}
            >
              <Minus className="w-4 h-4" /> Deduct
            </button>
          </div>

          <div>
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Hours *</label>
            <input 
              type="number"
              step="0.5"
              min="0.5"
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              placeholder="e.g. 5.5" 
              className="input-field" 
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Description (Optional)</label>
            <input 
              type="text"
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="e.g. Purchased 10hr pack" 
              className="input-field" 
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-400 text-sm font-bold hover:bg-zinc-900 transition-all">Cancel</button>
            <button type="submit" disabled={loading}
              className={cn("flex-1 py-3 rounded-xl text-white text-sm font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50", action === "add" ? "bg-violet-600 hover:bg-violet-500 shadow-violet-900/20" : "bg-red-600 hover:bg-red-500 shadow-red-900/20")}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PrepaidBalancesPage() {
  const [users, setUsers] = useState<PrepaidUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalUser, setModalUser] = useState<PrepaidUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(search ? { q: search } : {});
      const res = await fetch(`/api/prepaid-balances?${params}`);
      if (res.ok) { 
        const d = await res.json(); 
        setUsers(d.users); 
      }
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-violet-400" />
            Prepaid Balances
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5 font-medium">Manage users with remaining prepaid hours</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          <input value={search} onChange={e => { setSearch(e.target.value); }}
            placeholder="Search by name or phone…" className="input-field pl-10" />
        </div>
        <button onClick={fetchUsers} className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 transition-all active:rotate-180 duration-500">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="glass-card overflow-hidden border-zinc-900/50 shadow-2xl">
        {loading ? <TableSkeleton rows={5} /> : users.length === 0 ? (
          <EmptyState icon={User} title="No prepaid balances found"
            description={search ? "Try a different search" : "No users currently have a prepaid balance."}
          />
        ) : (
          <div className="divide-y divide-zinc-900">
            {users.map(u => (
              <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-zinc-900/40 transition-colors group">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600/20 group-hover:border-violet-500/30 transition-all duration-300">
                    <span className="text-sm font-bold text-violet-400">{getInitials(u.name)}</span>
                  </div>
                  <div className="flex-1 sm:hidden">
                    <p className="text-sm font-bold text-white group-hover:text-violet-400 transition-colors duration-300">{u.name}</p>
                    <p className="text-xs text-zinc-500">+91 {u.phone}</p>
                  </div>
                  <div className="flex gap-1 sm:hidden">
                    <button onClick={() => setModalUser(u)} className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-all flex items-center gap-2">
                       <Edit2 className="w-4 h-4" /> Manage
                    </button>
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0 pl-14 sm:pl-0">
                  <p className="hidden sm:block text-sm font-bold text-white group-hover:text-violet-400 transition-colors duration-300">{u.name}</p>
                  <p className="hidden sm:block text-xs text-zinc-500 mt-0.5">+91 {u.phone}</p>
                </div>

                {/* Balance & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-6 pl-14 sm:pl-0 mt-2 sm:mt-0">
                  <div className="flex flex-col sm:text-right">
                     <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Remaining</span>
                     <span className="text-lg font-bold text-violet-400">{Number(u.prepaidHours).toFixed(1)} <span className="text-xs text-zinc-400">hrs</span></span>
                  </div>
                  <div className="hidden sm:flex gap-2">
                    <button onClick={() => setModalUser(u)} className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all text-sm font-bold">
                       Manage
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalUser && (
        <BalanceModal user={modalUser} onClose={() => setModalUser(null)} onSaved={() => { setModalUser(null); fetchUsers(); }} />
      )}
    </div>
  );
}
