"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Zap, Search, RefreshCw, Loader2, Plus, Trash2, User, Edit2, AlertCircle } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";

interface Game {
  id: string;
  name: string;
  tag: string;
}

interface CreditBalance {
  id: string;
  balance: string | number;
  isAllGames: boolean;
  applicableGames: Game[];
}

interface PrepaidTransaction {
  id: string;
  amount: number | string;
  description: string | null;
  createdAt: string;
  moneyGiven: number | string;
  creditsReceived: number | string;
  paymentId: string | null;
  bookingId: string | null;
}

interface PrepaidUser {
  id: string;
  name: string;
  phone: string;
  creditBalances: CreditBalance[];
  prepaidTransactions: PrepaidTransaction[];
}

interface BalanceModalProps {
  user: PrepaidUser;
  games: Game[];
  onClose: () => void;
  onSaved: () => void;
}

function BalanceModal({ user, games, onClose, onSaved }: BalanceModalProps) {
  const [moneyGiven, setMoneyGiven] = useState("");
  const [creditsReceived, setCreditsReceived] = useState("");
  const [description, setDescription] = useState("");
  const [isAllGames, setIsAllGames] = useState(true);
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [cashAmount, setCashAmount] = useState<number | "">("");
  const [onlineAmount, setOnlineAmount] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  const toggleGame = (id: string) => {
    setSelectedGames(prev => 
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!creditsReceived || isNaN(Number(creditsReceived)) || Number(creditsReceived) <= 0) {
      toast.error("Please enter a valid credits amount");
      return;
    }
    if (!moneyGiven || isNaN(Number(moneyGiven))) {
      toast.error("Please enter money given amount");
      return;
    }
    if (!isAllGames && selectedGames.length === 0) {
      toast.error("Please select at least one game");
      return;
    }
    if (paymentMethod === "MIXED") {
      const c = Number(cashAmount) || 0;
      const o = Number(onlineAmount) || 0;
      if (c + o !== Number(moneyGiven)) {
        toast.error(`Cash + Online must equal Money Given (₹${moneyGiven})`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/prepaid-balances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          moneyGiven: Number(moneyGiven),
          creditsReceived: Number(creditsReceived),
          description,
          isAllGames,
          gameIds: isAllGames ? [] : selectedGames,
          paymentMethod,
          cashAmount: paymentMethod === "MIXED" ? Number(cashAmount) : paymentMethod === "CASH" ? Number(moneyGiven) : 0,
          onlineAmount: paymentMethod === "MIXED" ? Number(onlineAmount) : paymentMethod !== "CASH" ? Number(moneyGiven) : 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to add credits");
        return;
      }
      toast.success("Credits added successfully!");
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
      <div className="relative glass-card p-6 w-full max-w-sm animate-scale-in max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Zap className="w-5 h-5 text-violet-400" />
          Add Credits
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Add prepaid credits for <span className="font-bold text-white">{user.name}</span>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Money Given (₹)</label>
              <input 
                type="number"
                min="0"
                value={moneyGiven} 
                onChange={e => setMoneyGiven(e.target.value)} 
                placeholder="e.g. 1000" 
                className="input-field" 
                required
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Credits (₹)</label>
              <input 
                type="number"
                min="1"
                value={creditsReceived} 
                onChange={e => setCreditsReceived(e.target.value)} 
                placeholder="e.g. 1200" 
                className="input-field border-violet-500/30" 
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={e => {
                setPaymentMethod(e.target.value);
                if (e.target.value !== "MIXED") {
                  setCashAmount("");
                  setOnlineAmount("");
                }
              }}
              className="input-field"
            >
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="MIXED">Split (Cash + Online)</option>
            </select>
          </div>

          {paymentMethod === "MIXED" && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Cash Amount</label>
                <input
                  type="number"
                  min="0"
                  value={cashAmount}
                  onChange={e => setCashAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="₹0"
                  className="input-field"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Online Amount</label>
                <input
                  type="number"
                  min="0"
                  value={onlineAmount}
                  onChange={e => setOnlineAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="₹0"
                  className="input-field"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Applicable Games</label>
            <div className="flex items-center gap-2 mb-3">
              <input 
                type="checkbox" 
                id="allGames"
                checked={isAllGames}
                onChange={e => {
                  setIsAllGames(e.target.checked);
                  if (e.target.checked) setSelectedGames([]);
                }}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-violet-500"
              />
              <label htmlFor="allGames" className="text-sm text-zinc-300">All Games (General Wallet)</label>
            </div>

            {!isAllGames && (
              <div className="space-y-2 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                {games.map(g => (
                  <label key={g.id} className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox"
                      checked={selectedGames.includes(g.id)}
                      onChange={() => toggleGame(g.id)}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-violet-500"
                    />
                    <span className="text-sm text-zinc-400 group-hover:text-zinc-200">{g.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Description (Optional)</label>
            <input 
              type="text"
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="e.g. Special offer pack" 
              className="input-field" 
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-800 text-zinc-400 text-sm font-bold hover:bg-zinc-900 transition-all">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all shadow-lg shadow-violet-900/20 active:scale-95 disabled:opacity-50">
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
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalUser, setModalUser] = useState<PrepaidUser | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  const handleDeleteTransaction = async (txId: string) => {
    if (!confirm("Are you sure you want to delete this top-up? This will reverse the balance and delete the payment record.")) return;
    
    setDeletingTxId(txId);
    try {
      const res = await fetch(`/api/prepaid-balances/${txId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Transaction deleted successfully");
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to delete transaction");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDeletingTxId(null);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, gRes] = await Promise.all([
        fetch(`/api/prepaid-balances?${new URLSearchParams(search ? { q: search } : {})}`),
        fetch('/api/games')
      ]);
      if (uRes.ok) {
        const d = await uRes.json();
        setUsers(d.users);
      }
      if (gRes.ok) {
        const d = await gRes.json();
        setGames(d);
      }
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-violet-400" />
            Prepaid Credits
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5 font-medium">Manage user credit balances and wallets</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone…" className="input-field pl-10" />
        </div>
        <button onClick={fetchData} className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 transition-all active:rotate-180 duration-500">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="glass-card overflow-hidden border-zinc-900/50 shadow-2xl">
        {loading ? <TableSkeleton rows={5} /> : users.length === 0 ? (
          <EmptyState icon={User} title="No prepaid balances found"
            description={search ? "Try a different search" : "No users currently have prepaid credits."}
          />
        ) : (
          <div className="divide-y divide-zinc-900">
            {users.map(u => (
              <div key={u.id} className="flex flex-col group border-b border-zinc-900 last:border-0">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-zinc-900/40 transition-colors">
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
                         <Plus className="w-4 h-4" /> Add
                      </button>
                    </div>
                  </div>
  
                  <div className="flex-1 min-w-0 pl-14 sm:pl-0">
                    <p className="hidden sm:block text-sm font-bold text-white group-hover:text-violet-400 transition-colors duration-300">{u.name}</p>
                    <p className="hidden sm:block text-xs text-zinc-500 mt-0.5">+91 {u.phone}</p>
                    
                    <div className="mt-3 flex flex-wrap gap-2">
                      {u.creditBalances.filter(cb => Number(cb.balance) > 0).map(cb => (
                        <div key={cb.id} className="px-2.5 py-1 rounded-md bg-zinc-900/80 border border-zinc-800 text-xs">
                          <span className="font-bold text-violet-400">₹{Number(cb.balance)}</span>
                          <span className="text-zinc-500 ml-1.5">
                            {cb.isAllGames ? "All Games" : cb.applicableGames.map(g => g.name).join(", ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
  
                  <div className="hidden sm:flex items-center justify-end gap-3 mt-2 sm:mt-0">
                    <button onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)} className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all text-sm font-bold flex items-center gap-2">
                      {expandedUserId === u.id ? "Hide History" : "View History"}
                    </button>
                    <button onClick={() => setModalUser(u)} className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all text-sm font-bold flex items-center gap-2">
                       <Plus className="w-4 h-4" /> Add Credits
                    </button>
                  </div>
                </div>
                
                {expandedUserId === u.id && (
                  <div className="px-4 sm:px-6 pb-4 pt-2 bg-zinc-950 border-t border-zinc-900">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Transaction History</h4>
                    {u.prepaidTransactions.filter(tx => Number(tx.amount) > 0 || tx.bookingId).length === 0 ? (
                      <p className="text-sm text-zinc-600">No transactions yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {u.prepaidTransactions
                          .filter(tx => Number(tx.amount) > 0 || tx.bookingId)
                          .map(tx => (
                          <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50 text-sm">
                            <div>
                              <p className="font-bold text-zinc-200">
                                {Number(tx.amount) > 0 ? "+" : ""}₹{Number(tx.amount)}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {new Date(tx.createdAt).toLocaleString("en-IN", { 
                                  day: 'numeric', month: 'short', year: 'numeric',
                                  hour: 'numeric', minute: '2-digit', hour12: true
                                })}
                              </p>
                              {tx.description && <p className="text-xs text-zinc-400 mt-0.5">{tx.description}</p>}
                            </div>
                            {Number(tx.amount) > 0 && tx.paymentId && (
                              <button 
                                onClick={() => handleDeleteTransaction(tx.id)}
                                disabled={deletingTxId === tx.id}
                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                title="Delete Top-up"
                              >
                                {deletingTxId === tx.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {modalUser && (
        <BalanceModal user={modalUser} games={games} onClose={() => setModalUser(null)} onSaved={() => { setModalUser(null); fetchData(); }} />
      )}
    </div>
  );
}
