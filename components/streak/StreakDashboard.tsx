"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Flame, Search, Phone, Calendar, CheckCircle2,
  Gift, History, ArrowRight, Loader2, UserPlus, X,
} from "lucide-react";
import { cn, formatCurrency, formatRelative } from "@/lib/utils";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface StreakChallenge {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "ISSUED" | "EXPIRED";
  issuedAt: string | null;
  issuedById: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; phone: string };
  issuedBy: { id: string; name: string } | null;
  progress: StreakProgress | null;
}

interface StreakDailyTotal {
  date: string;
  total: number;
  qualifies: boolean;
}

interface StreakProgress {
  qualifyingDays: number;
  target: number;
  remaining: number;
  isEligible: boolean;
  dailyTotals: StreakDailyTotal[];
}

const STREAK_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  ISSUED: { label: "Issued", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  EXPIRED: { label: "Expired", color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/25" },
};

function StreakStatusBadge({ status }: { status: string }) {
  const config = STREAK_STATUS_CONFIG[status] ?? STREAK_STATUS_CONFIG.ACTIVE;
  return <span className={cn("badge", config.color)}>{config.label}</span>;
}

/** Today's date as YYYY-MM-DD (local), for the start-date default. */
function todayStr(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface StreakDashboardProps {
  role?: "ADMIN" | "STAFF";
}

export default function StreakDashboard({ role = "ADMIN" }: StreakDashboardProps) {
  const [challenges, setChallenges] = useState<StreakChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  // View search (always-visible search bar)
  const [viewQuery, setViewQuery] = useState("");
  const [viewResults, setViewResults] = useState<Customer[]>([]);
  const [viewSearching, setViewSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Start-challenge dialog
  const [startOpen, setStartOpen] = useState(false);
  const [startCustomer, setStartCustomer] = useState<Customer | null>(null);
  const [startQuery, setStartQuery] = useState("");
  const [startResults, setStartResults] = useState<Customer[]>([]);
  const [startSearching, setStartSearching] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [creating, setCreating] = useState(false);

  // Issue gift
  const [issueTarget, setIssueTarget] = useState<StreakChallenge | null>(null);
  const [issuing, setIssuing] = useState(false);

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedCustomer
        ? `/api/streak?userId=${selectedCustomer.id}`
        : `/api/streak`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setChallenges(data);
      } else {
        toast.error("Failed to load streak challenges");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  // Debounced view search
  useEffect(() => {
    if (!viewQuery.trim()) {
      setViewResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setViewSearching(true);
      try {
        const res = await fetch(
          `/api/users?role=CUSTOMER&q=${encodeURIComponent(viewQuery)}&limit=8`
        );
        if (res.ok) {
          const data = await res.json();
          setViewResults(data.users ?? []);
        }
      } catch {
        /* ignore */
      } finally {
        setViewSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [viewQuery]);

  // Debounced start-dialog search
  useEffect(() => {
    if (!startOpen) return;
    if (!startQuery.trim()) {
      setStartResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setStartSearching(true);
      try {
        const res = await fetch(
          `/api/users?role=CUSTOMER&q=${encodeURIComponent(startQuery)}&limit=8`
        );
        if (res.ok) {
          const data = await res.json();
          setStartResults(data.users ?? []);
        }
      } catch {
        /* ignore */
      } finally {
        setStartSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [startQuery, startOpen]);

  const handleViewSelect = (c: Customer) => {
    setSelectedCustomer(c);
    setViewQuery("");
    setViewResults([]);
  };

  const openStartDialog = () => {
    // Prefill with the customer currently being viewed, if any
    setStartCustomer(selectedCustomer);
    setStartQuery(selectedCustomer ? selectedCustomer.name : "");
    setStartResults([]);
    setStartDate(todayStr());
    setCreating(false);
    setStartOpen(true);
  };

  const handleCreateChallenge = async () => {
    if (!startCustomer) {
      toast.error("Select a customer first");
      return;
    }
    if (!startDate) {
      toast.error("Pick a start date for the 30-day challenge");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/streak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: startCustomer.id, startDate }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`30-day streak started for ${startCustomer.name}`);
        setStartOpen(false);
        // Show the new challenge for that customer
        setSelectedCustomer(startCustomer);
        fetchChallenges();
      } else {
        toast.error(data.error ?? "Failed to start challenge");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleIssueGift = async () => {
    if (!issueTarget) return;
    setIssuing(true);
    try {
      const res = await fetch("/api/streak", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: issueTarget.id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Streak gift issued for ${issueTarget.user.name}!`);
        setIssueTarget(null);
        fetchChallenges();
      } else {
        toast.error(data.error ?? "Failed to issue gift");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIssuing(false);
    }
  };

  const activeChallenge = challenges.find((c) => c.status === "ACTIVE") ?? null;
  const history = challenges.filter((c) => c.status !== "ACTIVE");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Flame className="w-6 h-6 text-orange-400" />
            Streak
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5 font-medium">
            Start a 30-day challenge · 6 days of ₹120+ game bookings earns a gift
          </p>
        </div>
        <button
          onClick={openStartDialog}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-orange-600 hover:bg-orange-500 text-white transition-all active:scale-95 whitespace-nowrap"
        >
          <Flame className="w-4 h-4" />
          Start 30-day Challenge
        </button>
      </div>

      {/* Search bar — always visible, used to view a customer's streak */}
      <div className="glass-card border-zinc-900/50 p-4 sm:p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            value={viewQuery}
            onChange={(e) => setViewQuery(e.target.value)}
            placeholder="Search a customer by name or phone to view their streak…"
            className="input-field pl-10"
          />
          {viewSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 animate-spin" />
          )}
          {viewResults.length > 0 && (
            <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
              {viewResults.map((c) => {
                const hasActive = challenges.some(
                  (ch) => ch.userId === c.id && ch.status === "ACTIVE"
                );
                return (
                  <button
                    key={c.id}
                    onClick={() => handleViewSelect(c)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-900 transition-colors border-b border-zinc-900 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{c.name}</p>
                      <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" /> +91 {c.phone}
                      </p>
                    </div>
                    {hasActive && (
                      <span className="badge bg-amber-500/15 text-amber-400 border-amber-500/25 text-[10px]">
                        Active
                      </span>
                    )}
                    <ArrowRight className="w-4 h-4 text-zinc-600" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selected customer summary */}
      {selectedCustomer && (
        <div className="flex items-center justify-between gap-3 glass-card border-zinc-900/50 p-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{selectedCustomer.name}</p>
              <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                <Phone className="w-2.5 h-2.5" /> +91 {selectedCustomer.phone}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedCustomer(null)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap"
          >
            Clear
          </button>
        </div>
      )}

      {/* Active challenge */}
      {loading ? (
        <TableSkeleton rows={4} />
      ) : selectedCustomer && activeChallenge ? (
        <ActiveChallengeCard challenge={activeChallenge} onIssue={() => setIssueTarget(activeChallenge)} />
      ) : selectedCustomer ? (
        <EmptyState
          icon={Flame}
          title="No active challenge"
          description="This customer has no active challenge. Use “Start 30-day Challenge” above to begin one."
        />
      ) : (
        <EmptyState
          icon={Flame}
          title="Search a customer"
          description="Use the search bar above to find a customer and view their streak."
        />
      )}

      {/* History */}
      {selectedCustomer && history.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <History className="w-3.5 h-3.5" /> History ({history.length})
          </h3>
          <div className="glass-card overflow-hidden border-zinc-900/50 divide-y divide-zinc-900">
            {history.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                    {formatRelative(c.startDate)} → {formatRelative(c.endDate)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {c.status === "ISSUED" && c.issuedBy && (
                    <span className="text-[10px] text-zinc-500 hidden sm:inline">
                      by {c.issuedBy.name} · {formatRelative(c.issuedAt!)}
                    </span>
                  )}
                  <StreakStatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!issueTarget}
        title="Issue Streak Gift?"
        description={
          issueTarget
            ? `Confirm you want to issue the streak gift to ${issueTarget.user.name}? They have reached ${issueTarget.progress?.qualifyingDays ?? 0} / ${issueTarget.progress?.target ?? 6} qualifying days. This is recorded in history.`
            : ""
        }
        confirmLabel="Issue Gift"
        onConfirm={handleIssueGift}
        onCancel={() => setIssueTarget(null)}
        loading={issuing}
      />

      {/* Start 30-day Challenge dialog */}
      {startOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setStartOpen(false)}
          />
          <div className="relative glass-card p-5 w-full max-w-md animate-scale-in space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                Start 30-day Challenge
              </h3>
              <button
                onClick={() => setStartOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Customer picker */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Customer
              </label>
              {startCustomer ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                      <Flame className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{startCustomer.name}</p>
                      <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" /> +91 {startCustomer.phone}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setStartCustomer(null)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    autoFocus
                    value={startQuery}
                    onChange={(e) => setStartQuery(e.target.value)}
                    placeholder="Search customer by name or phone…"
                    className="input-field pl-10"
                  />
                  {startSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 animate-spin" />
                  )}
                  {startResults.length > 0 && (
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
                      {startResults.map((c) => {
                        const hasActive = challenges.some(
                          (ch) => ch.userId === c.id && ch.status === "ACTIVE"
                        );
                        return (
                          <button
                            key={c.id}
                            onClick={() => {
                              setStartCustomer(c);
                              setStartQuery("");
                              setStartResults([]);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-900 transition-colors border-b border-zinc-900 last:border-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate">{c.name}</p>
                              <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" /> +91 {c.phone}
                              </p>
                            </div>
                            {hasActive && (
                              <span className="badge bg-amber-500/15 text-amber-400 border-amber-500/25 text-[10px]">
                                Active
                              </span>
                            )}
                            <ArrowRight className="w-4 h-4 text-zinc-600" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Start date */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Start date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
            </div>

            <button
              onClick={handleCreateChallenge}
              disabled={creating || !startCustomer || !startDate}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95",
                startCustomer && startDate
                  ? "bg-orange-600 hover:bg-orange-500 text-white"
                  : "bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed"
              )}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Create Challenge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveChallengeCard({
  challenge,
  onIssue,
}: {
  challenge: StreakChallenge;
  onIssue: () => void;
}) {
  const progress = challenge.progress;
  const qualifyingDays = progress?.qualifyingDays ?? 0;
  const target = progress?.target ?? 6;
  const isEligible = progress?.isEligible ?? false;
  const pct = Math.min(100, Math.round((qualifyingDays / target) * 100));

  return (
    <div className="glass-card border-zinc-900/50 p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StreakStatusBadge status="ACTIVE" />
          <span className="text-xs text-zinc-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formatRelative(challenge.startDate)} → {formatRelative(challenge.endDate)}
          </span>
        </div>
        <button
          onClick={onIssue}
          disabled={!isEligible}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all duration-200 active:scale-95",
            isEligible
              ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30"
              : "bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed"
          )}
        >
          <Gift className="w-3.5 h-3.5" />
          Issue Gift
        </button>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-bold text-white">
            {qualifyingDays}
            <span className="text-zinc-600 text-xl"> / {target}</span>
          </span>
          <span className="text-xs font-medium text-zinc-500">
            {isEligible ? "Goal reached!" : `${target - qualifyingDays} more day(s) to go`}
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-zinc-900 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isEligible ? "bg-emerald-500" : "bg-orange-500"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-zinc-600">
          A day qualifies when game bookings total ₹120 or more (IST).
        </p>
      </div>

      {/* Daily breakdown */}
      {progress && progress.dailyTotals.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {progress.dailyTotals.map((d) => (
            <div
              key={d.date}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl border text-sm",
                d.qualifies
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                  : "bg-zinc-900/40 border-zinc-800 text-zinc-400"
              )}
            >
              <span className="text-xs font-medium">{d.date}</span>
              <span className="flex items-center gap-1.5">
                {formatCurrency(d.total)}
                {d.qualifies ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <span className="text-[10px] text-zinc-600">under</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
