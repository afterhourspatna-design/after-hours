"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { 
  Users, Gift, ChevronDown, ChevronUp, RefreshCw, 
  Search, Phone, Calendar, ArrowRight, CheckCircle2, Award
} from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface Referee {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

interface Referrer {
  id: string;
  name: string;
  phone: string;
  referralRewardsClaimed: number;
  totalReferrals: number;
  unclaimedReferrals: number;
  refereeUsers: Referee[];
}

interface ReferralsDashboardProps {
  role?: "ADMIN" | "STAFF";
}

export default function ReferralsDashboard({ role = "ADMIN" }: ReferralsDashboardProps) {
  const [referrals, setReferrals] = useState<Referrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [availUser, setAvailUser] = useState<Referrer | null>(null);
  const [availing, setAvailing] = useState(false);

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/referrals");
      if (res.ok) {
        const data = await res.json();
        setReferrals(data);
      } else {
        toast.error("Failed to load referrals");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleAvailReward = async () => {
    if (!availUser) return;
    setAvailing(true);
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referrerId: availUser.id }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(`Reward availed successfully for ${availUser.name}!`);
        setAvailUser(null);
        fetchReferrals();
      } else {
        toast.error(data.error ?? "Failed to avail reward");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setAvailing(false);
    }
  };

  const filteredReferrals = referrals.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-violet-400" />
            Referrals
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5 font-medium">
            Track customer referrals and reward active promoters
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by promoter name or phone…" 
            className="input-field pl-10" 
          />
        </div>
        <button 
          onClick={fetchReferrals} 
          className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 transition-all active:rotate-180 duration-500"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="glass-card overflow-hidden border-zinc-900/50 shadow-2xl">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : filteredReferrals.length === 0 ? (
          <EmptyState 
            icon={Users} 
            title="No referrals found"
            description={search ? "Try a different search" : "No customer referral has been recorded yet."} 
          />
        ) : (
          <div className="divide-y divide-zinc-900">
            {filteredReferrals.map(r => {
              const isExpanded = !!expandedIds[r.id];
              const canAvail = r.unclaimedReferrals >= 3;
              
              return (
                <div key={r.id} className="transition-all duration-300">
                  {/* Promoter Row */}
                  <div 
                    onClick={() => toggleExpand(r.id)} 
                    className="flex items-center gap-4 px-6 py-5 hover:bg-zinc-900/40 cursor-pointer transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600/20 group-hover:border-violet-500/30 transition-all duration-300">
                      <Gift className="w-5 h-5 text-violet-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white group-hover:text-violet-400 transition-colors duration-300">
                          {r.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                          <Phone className="w-3 h-3 text-zinc-600" /> +91 {r.phone}
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-8 mr-4 flex-shrink-0">
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Total</span>
                        <span className="text-sm font-bold text-white">{r.totalReferrals}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Claimed</span>
                        <span className="text-sm font-bold text-zinc-500">{r.referralRewardsClaimed}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Unclaimed</span>
                        <span className={cn(
                          "text-sm font-bold", 
                          canAvail ? "text-emerald-400" : "text-violet-400"
                        )}>
                          {r.unclaimedReferrals}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        disabled={!canAvail}
                        onClick={() => setAvailUser(r)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all duration-200 active:scale-95",
                          canAvail 
                            ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30" 
                            : "bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed"
                        )}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Avail Reward
                      </button>
                      <button className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-all">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Referee Expanded Row */}
                  {isExpanded && (
                    <div className="bg-zinc-950/40 border-t border-zinc-900/60 px-6 py-4 space-y-3">
                      <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-2 mb-1">
                        People Referred ({r.refereeUsers.length})
                      </h4>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {r.refereeUsers.map((ref, idx) => (
                          <div 
                            key={ref.id} 
                            className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/40 hover:border-zinc-800 transition-all"
                          >
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-zinc-300 truncate">{ref.name}</p>
                              <p className="text-[10px] font-medium text-zinc-500 flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5" /> +91 {ref.phone}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-bold text-zinc-600 uppercase flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" /> {formatRelative(ref.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog 
        open={!!availUser} 
        title="Redeem Referral Reward?" 
        description={
          availUser 
            ? `Are you sure you want to avail a reward for ${availUser.name}? This will claim 3 of their unclaimed referrals.` 
            : ""
        } 
        confirmLabel="Avail Reward" 
        onConfirm={handleAvailReward} 
        onCancel={() => setAvailUser(null)} 
        loading={availing} 
      />
    </div>
  );
}
