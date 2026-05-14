"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, addMinutes } from "date-fns";
import { Loader2, User, Users, Gamepad2, Clock, DollarSign, ChevronDown, Search, X } from "lucide-react";
import { cn, formatCurrency, SOURCE_LABELS } from "@/lib/utils";

interface Game {
  id: string;
  name: string;
  tag: string;
  basePrice: number;
  minTimeMinutes: number;
  maxTimeMinutes: number;
  isActive: boolean;
  resourceUnits: { id: string; unitName: string }[];
}

interface AppUser {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
}

interface PriceBreakdown {
  basePrice: number;
  discountPct: number;
  discountAmount: number;
  finalAmount: number;
  breakdown: { blockNumber: number; durationMinutes: number; discountPct: number; amount: number }[];
}

interface BookingFormProps {
  mode?: "create" | "edit";
  initialData?: any;
  prefillDate?: string;
  role?: "ADMIN" | "STAFF" | "CUSTOMER";
  currentUser?: AppUser | null;
}

const DURATIONS = [30, 60, 90, 120, 150, 180, 240];

export default function BookingForm({ mode = "create", initialData, prefillDate, role = "ADMIN", currentUser }: BookingFormProps) {
  const router = useRouter();

  // Mode toggle: registered user vs guest
  const [isGuest, setIsGuest] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<AppUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(
    role === "CUSTOMER" ? (currentUser ?? null) : (initialData?.user ?? null)
  );
  const [guestName, setGuestName] = useState(initialData?.guestName ?? "");
  const [guestPhone, setGuestPhone] = useState(initialData?.guestPhone ?? "");

  // Game/unit
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>(initialData?.resourceUnitId ?? "");
  const [unitAvailability, setUnitAvailability] = useState<boolean | null>(null);

  // Time
  const defaultDate = prefillDate ? new Date(prefillDate) : new Date();
  const [bookingDate, setBookingDate] = useState(format(defaultDate, "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(
    prefillDate ? format(defaultDate, "HH:mm") : "14:00"
  );
  const [durationMinutes, setDurationMinutes] = useState(initialData?.durationMinutes ?? 60);

  // Booking details
  const [bookingType, setBookingType] = useState(initialData?.bookingType ?? "HOURLY");
  const [source, setSource] = useState(initialData?.source ?? "WALK_IN");
  const [paymentStatus, setPaymentStatus] = useState(initialData?.paymentStatus ?? "UNPAID");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [priceOverride, setPriceOverride] = useState<string>("");

  // Pricing
  const [pricing, setPricing] = useState<PriceBreakdown | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Load games on mount
  useEffect(() => {
    fetch("/api/games").then(r => r.json()).then((data: Game[]) => {
      setGames(data.filter(g => g.isActive !== false));
      if (initialData?.gameId) {
        const g = data.find((g: Game) => g.id === initialData.gameId);
        if (g) setSelectedGame(g);
      }
    });
  }, []);

  // User search debounce
  useEffect(() => {
    if (isGuest || userSearch.length < 2) { setUserResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/users?q=${encodeURIComponent(userSearch)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setUserResults(data.users ?? []);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [userSearch, isGuest]);

  // Calculate price whenever inputs change
  const calcPrice = useCallback(async () => {
    if (!selectedGame) return;
    const startDT = `${bookingDate}T${startTime}:00`;
    try {
      setPricingLoading(true);
      const params = new URLSearchParams({
        gameId: selectedGame.id,
        durationMinutes: String(durationMinutes),
        startDateTime: new Date(startDT).toISOString(),
        ...(selectedUser && !isGuest ? { userId: selectedUser.id } : {}),
        ...(initialData?.id ? { excludeBookingId: initialData.id } : {}),
      });
      const res = await fetch(`/api/bookings/price?${params}`);
      if (res.ok) setPricing(await res.json());
    } finally {
      setPricingLoading(false);
    }
  }, [selectedGame, bookingDate, startTime, durationMinutes, selectedUser, isGuest]);

  useEffect(() => { calcPrice(); }, [calcPrice]);

  // Check unit availability
  useEffect(() => {
    if (!selectedUnit || !bookingDate || !startTime) { setUnitAvailability(null); return; }
    const startDT = new Date(`${bookingDate}T${startTime}:00`);
    const params = new URLSearchParams({
      resourceUnitId: selectedUnit,
      startDateTime: startDT.toISOString(),
      durationMinutes: String(durationMinutes),
      ...(initialData?.id ? { excludeBookingId: initialData.id } : {}),
    });
    fetch(`/api/bookings/availability?${params}`)
      .then(r => r.json())
      .then(d => setUnitAvailability(d.available));
  }, [selectedUnit, bookingDate, startTime, durationMinutes]);

  // Enforce game min/max time
  useEffect(() => {
    if (!selectedGame) return;
    if (durationMinutes < selectedGame.minTimeMinutes) setDurationMinutes(selectedGame.minTimeMinutes);
    if (durationMinutes > selectedGame.maxTimeMinutes) setDurationMinutes(selectedGame.maxTimeMinutes);
  }, [selectedGame]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedGame) { toast.error("Please select a game"); return; }
    if (isGuest && (!guestName || !guestPhone)) { toast.error("Guest name and phone are required"); return; }
    if (!isGuest && !selectedUser) { toast.error("Please select a user or switch to Guest mode"); return; }
    if (unitAvailability === false) { toast.error("This unit is not available at the selected time"); return; }

    const startDT = new Date(`${bookingDate}T${startTime}:00`);
    const payload = {
      userId: isGuest ? null : selectedUser?.id,
      guestName: isGuest ? guestName : null,
      guestPhone: isGuest ? guestPhone : null,
      gameId: selectedGame.id,
      resourceUnitId: selectedUnit || null,
      startDateTime: startDT.toISOString(),
      durationMinutes,
      bookingType,
      paymentStatus,
      source: role === "CUSTOMER" ? "ONLINE" : source,
      notes: notes || null,
      ...(priceOverride && role === "ADMIN" ? { priceOverride: Number(priceOverride) } : {}),
    };

    setSubmitting(true);
    try {
      const url = mode === "edit" ? `/api/bookings/${initialData.id}` : "/api/bookings";
      const method = mode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save booking");
        return;
      }

      toast.success(mode === "edit" ? "Booking updated!" : "Booking created — on hold for 15 min");
      router.push(role === "CUSTOMER" ? "/customer/bookings" : role === "STAFF" ? "/staff/bookings" : "/admin/bookings");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const finalPrice = priceOverride ? Number(priceOverride) : (pricing?.finalAmount ?? 0);
  const endTime = startTime
    ? format(addMinutes(new Date(`${bookingDate}T${startTime}:00`), durationMinutes), "HH:mm")
    : "";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col — main form */}
        <div className="lg:col-span-2 space-y-5">

          {/* ── Customer / Guest Section ── */}
          {role !== "CUSTOMER" && (
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Users className="w-4 h-4 text-violet-400" />
                  Customer
                </div>
                {/* Guest toggle */}
                <div className="flex items-center gap-2 bg-zinc-800/60 rounded-xl p-1">
                  <button type="button" onClick={() => setIsGuest(false)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      !isGuest ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-200")}>
                    <User className="w-3 h-3 inline mr-1" />Registered
                  </button>
                  <button type="button" onClick={() => setIsGuest(true)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      isGuest ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-200")}>
                    Guest
                  </button>
                </div>
              </div>

              {isGuest ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Guest Name *</label>
                    <input value={guestName} onChange={e => setGuestName(e.target.value)}
                      placeholder="e.g. Ahmed Ali" className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Mobile Number (10 Digits) *</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 font-bold">+92</span>
                       <input 
                         type="tel"
                         maxLength={10}
                         value={guestPhone} 
                         onChange={e => {
                           const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                           setGuestPhone(val);
                         }}
                         placeholder="3000000000" 
                         className="input-field pl-12" 
                       />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <label className="text-xs text-zinc-400 mb-1 block">Search User (name or phone)</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    {selectedUser ? (
                      <div className="input-field pl-9 flex items-center justify-between">
                        <span className="text-sm text-white">
                          {selectedUser.name} <span className="text-zinc-500 text-xs">· {selectedUser.phone}</span>
                        </span>
                        <button type="button" onClick={() => { setSelectedUser(null); setUserSearch(""); }}>
                          <X className="w-3.5 h-3.5 text-zinc-500 hover:text-white" />
                        </button>
                      </div>
                    ) : (
                      <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                        placeholder="Search by name or phone…" className="input-field pl-9" />
                    )}
                  </div>
                  {userResults.length > 0 && !selectedUser && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden">
                      {userResults.map(u => (
                        <button key={u.id} type="button"
                          onClick={() => { setSelectedUser(u); setUserSearch(""); setUserResults([]); }}
                          className="w-full px-4 py-2.5 text-left hover:bg-zinc-800 transition-colors flex items-center justify-between">
                          <span className="text-sm text-white">{u.name}</span>
                          <span className="text-xs text-zinc-500">{u.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Game / Unit ── */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Gamepad2 className="w-4 h-4 text-violet-400" />
              Game & Unit
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Game *</label>
                <select
                  value={selectedGame?.id ?? ""}
                  onChange={e => {
                    const g = games.find(g => g.id === e.target.value) ?? null;
                    setSelectedGame(g);
                    setSelectedUnit("");
                  }}
                  className="input-field"
                >
                  <option value="">Select game…</option>
                  {games.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Unit (optional — auto-assigned)</label>
                <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)} className="input-field"
                  disabled={!selectedGame}>
                  <option value="">Auto-assign</option>
                  {selectedGame?.resourceUnits.map(u => (
                    <option key={u.id} value={u.id}>{u.unitName}</option>
                  ))}
                </select>
                {unitAvailability === false && (
                  <p className="text-xs text-red-400 mt-1">⚠ This unit is already booked at this time</p>
                )}
                {unitAvailability === true && selectedUnit && (
                  <p className="text-xs text-emerald-400 mt-1">✓ Available</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Date & Time ── */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Clock className="w-4 h-4 text-violet-400" />
              Date & Time
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Date *</label>
                <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)}
                  className="input-field" min={format(new Date(), "yyyy-MM-dd")} />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Start Time *</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  step="900" className="input-field" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">
                  Duration
                  {selectedGame && (
                    <span className="text-zinc-600 ml-1">
                      ({selectedGame.minTimeMinutes}–{selectedGame.maxTimeMinutes}min)
                    </span>
                  )}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {DURATIONS.filter(d => {
                    if (!selectedGame) return d <= 120;
                    return d >= selectedGame.minTimeMinutes && d <= selectedGame.maxTimeMinutes;
                  }).map(d => (
                    <button key={d} type="button"
                      onClick={() => setDurationMinutes(d)}
                      className={cn("px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
                        durationMinutes === d
                          ? "bg-violet-600 border-violet-600 text-white"
                          : "bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:border-zinc-600")}>
                      {d < 60 ? `${d}m` : `${d / 60}h`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {startTime && endTime && (
              <p className="text-xs text-zinc-500">
                Session: <span className="text-zinc-300">{startTime} → {endTime}</span>
              </p>
            )}
          </div>

          {/* ── Details ── */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Booking Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {role !== "CUSTOMER" && (
                <>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Booking Type</label>
                    <select value={bookingType} onChange={e => setBookingType(e.target.value)} className="input-field">
                      <option value="HOURLY">Hourly</option>
                      <option value="EVENT">Event</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Source</label>
                    <select value={source} onChange={e => setSource(e.target.value)} className="input-field">
                      {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Payment Status</label>
                    <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="input-field">
                      <option value="UNPAID">Unpaid</option>
                      <option value="PARTIAL">Partial</option>
                      <option value="PAID">Paid</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Notes / Special Instructions</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                rows={3} placeholder="Any notes for this booking…"
                className="input-field resize-none" />
            </div>
          </div>
        </div>

        {/* Right col — Price summary */}
        <div className="space-y-4">
          <div className="glass-card p-5 space-y-4 sticky top-20">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <DollarSign className="w-4 h-4 text-violet-400" />
              Price Summary
            </div>

            {pricingLoading ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculating…
              </div>
            ) : pricing ? (
              <div className="space-y-3">
                {/* Breakdown */}
                {pricing.breakdown.map((block) => (
                  <div key={block.blockNumber} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">
                      Hour {block.blockNumber}
                      {block.durationMinutes < 60 && ` (${block.durationMinutes}min)`}
                    </span>
                    <div className="flex items-center gap-2">
                      {block.discountPct > 0 && (
                        <span className="badge bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          -{block.discountPct}%
                        </span>
                      )}
                      <span className="text-zinc-300 font-medium">{formatCurrency(block.amount)}</span>
                    </div>
                  </div>
                ))}

                <div className="border-t border-zinc-800 pt-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Base price</span>
                    <span className="text-zinc-400">{formatCurrency(pricing.basePrice)}</span>
                  </div>
                  {pricing.discountAmount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-500">Discount</span>
                      <span className="text-emerald-400">-{formatCurrency(pricing.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold pt-1">
                    <span className="text-white">Total</span>
                    <span className="text-violet-400">{formatCurrency(priceOverride || pricing.finalAmount)}</span>
                  </div>
                </div>

                {/* Admin override */}
                {role === "ADMIN" && (
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Override price (admin only)</label>
                    <input
                      type="number"
                      value={priceOverride}
                      onChange={e => setPriceOverride(e.target.value)}
                      placeholder={String(pricing.finalAmount)}
                      className="input-field text-sm"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-600">Select a game and time to see pricing</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || unitAvailability === false}
              className="w-full flex items-center justify-center gap-2 py-3 px-4
                         bg-violet-600 hover:bg-violet-500 active:bg-violet-700
                         text-white text-sm font-semibold rounded-xl
                         transition-all duration-200 shadow-lg shadow-violet-900/30
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : mode === "edit" ? "Update Booking" : "Create Booking"}
            </button>
            {mode === "create" && (
              <p className="text-xs text-zinc-600 text-center">
                Booking will be placed on 15-min hold
              </p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
