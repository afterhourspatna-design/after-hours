"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, Clock, Calendar, Gamepad2,
  AlertCircle, Loader2, QrCode, Copy, CheckCircle2, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
interface Game {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  basePrice: number;
  minTimeMinutes: number;
  maxTimeMinutes: number;
  hasAccessories: boolean;
  defaultAccessories: number;
  maxAccessories: number;
}

interface Slot {
  time: string;
  startISO: string;
  available: boolean;
}

const UPI_ID = "afterhours@upi"; // ← replace with real UPI ID when ready
const UPI_NAME = "After Hours Gaming";

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function toDateInputValue(d: Date) {
  // Returns YYYY-MM-DD in IST
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function minDate() {
  return toDateInputValue(new Date());
}

// Duration multiples up to 4 h capped at window close (11 PM)
function getDurationOptions(
  game: Game,
  slotStartISO: string,
  selectedDate: string
): { minutes: number; label: string }[] {
  const step = game.minTimeMinutes;
  const maxMins = 240; // 4 hours
  const options: { minutes: number; label: string }[] = [];

  // How many minutes remain before 11 PM
  const slotStart = new Date(slotStartISO);
  const [y, m, day] = selectedDate.split("-").map(Number);
  const windowEndUTC = new Date(Date.UTC(y, m - 1, day, 0, 0, 0) - 5.5 * 3600000 + 23 * 3600000);
  const remainingBeforeClose = Math.floor((windowEndUTC.getTime() - slotStart.getTime()) / 60000);
  const cap = Math.min(maxMins, remainingBeforeClose);

  for (let mins = step; mins <= cap; mins += step) {
    const h = Math.floor(mins / 60);
    const m2 = mins % 60;
    const label = h > 0 && m2 > 0 ? `${h}h ${m2}m` : h > 0 ? `${h}h` : `${m2}m`;
    options.push({ minutes: mins, label });
  }
  return options;
}

// Rough client-side price estimate (actual price set by server)
function estimatePrice(game: Game, durationMinutes: number): number {
  const step = game.minTimeMinutes;
  const blocks = Math.ceil(durationMinutes / 60);
  let total = 0;
  let remaining = durationMinutes;
  for (let i = 0; i < blocks; i++) {
    const blockMins = Math.min(remaining, 60);
    // Use basePrice as hourly rate; 30 min = half
    total += blockMins >= 60 ? Number(game.basePrice) : Number(game.basePrice) * (blockMins / 60);
    remaining -= blockMins;
  }
  return Math.round(total);
}

// ── Step indicator ───────────────────────────────────────────────────────────
const STEPS = ["Game", "Date & Slot", "Duration", "Confirm"];

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, idx) => {
        const done = idx < step;
        const active = idx === step;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                done ? "bg-violet-600 border-violet-600 text-white" :
                active ? "bg-zinc-900 border-violet-500 text-violet-400" :
                "bg-zinc-900 border-zinc-700 text-zinc-600"
              )}>
                {done ? <Check className="w-3.5 h-3.5" /> : idx + 1}
              </div>
              <span className={cn("text-[10px] font-semibold hidden sm:block", active ? "text-white" : done ? "text-violet-400" : "text-zinc-600")}>
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={cn("flex-1 h-0.5 mx-1 mb-4 transition-all", done ? "bg-violet-600" : "bg-zinc-800")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function CustomerBookingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // State
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedDate, setSelectedDate] = useState(minDate());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [accessories, setAccessories] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);

  // Fetch games on mount
  useEffect(() => {
    fetch("/api/games")
      .then(r => r.json())
      .then(data => {
        const list: Game[] = (Array.isArray(data) ? data : (data.games ?? [])).filter((g: Game) => g.tag !== "SNACK" && g.tag !== "snack" && (g as any).isActive !== false);
        setGames(list);
      })
      .catch(() => toast.error("Failed to load games"));
  }, []);

  // Fetch slots when game or date changes
  const fetchSlots = useCallback(async () => {
    if (!selectedGame || !selectedDate) return;
    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlot(null);
    try {
      const res = await fetch(`/api/customer/slots?gameId=${selectedGame.id}&date=${selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots ?? []);
      } else {
        toast.error("Could not load available slots");
      }
    } catch {
      toast.error("Failed to load slots");
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedGame, selectedDate]);

  useEffect(() => {
    if (step === 1) fetchSlots();
  }, [step, fetchSlots]);

  // Duration options
  const durationOptions = selectedGame && selectedSlot
    ? getDurationOptions(selectedGame, selectedSlot.startISO, selectedDate)
    : [];

  // Estimated price
  const estimatedPrice = selectedGame && durationMinutes > 0
    ? estimatePrice(selectedGame, durationMinutes)
    : 0;

  const copyUPI = () => {
    navigator.clipboard.writeText(UPI_ID).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSubmit = async () => {
    if (!selectedGame || !selectedSlot || !durationMinutes) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: selectedGame.id,
          startDateTime: selectedSlot.startISO,
          durationMinutes,
          accessoriesCount: selectedGame.hasAccessories ? accessories : 0,
          notes: notes.trim() || null,
          source: "ONLINE",
          paymentStatus: "UNPAID",
          bookingType: "HOURLY",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfirmedBookingId(data.id);
        setStep(4); // success screen
      } else {
        toast.error(data.error || "Failed to create booking");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 0: Pick Game ────────────────────────────────────────────────────
  if (step === 0) return (
    <div className="space-y-5">
      <StepBar step={0} />
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Choose a Game</h2>
        <p className="text-sm text-zinc-500">Select what you'd like to play</p>
      </div>
      {games.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {games.map(g => (
            <button
              key={g.id}
              onClick={() => { setSelectedGame(g); setDurationMinutes(g.minTimeMinutes); setStep(1); }}
              className="text-left p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:border-violet-500/60 hover:bg-zinc-900 transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-bold text-white text-sm group-hover:text-violet-300 transition-colors">{g.name}</p>
                  {g.description && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{g.description}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-violet-400 mt-0.5 flex-shrink-0 transition-colors" />
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold">
                  from {formatCurrency(Number(g.basePrice))}/hr
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 font-medium">
                  min {g.minTimeMinutes}m
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ── Step 1: Pick Date + Slot ─────────────────────────────────────────────
  if (step === 1) return (
    <div className="space-y-5">
      <StepBar step={1} />
      <div className="flex items-center gap-3">
        <button onClick={() => { setStep(0); setSelectedSlot(null); }} className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">Pick a Date & Slot</h2>
          <p className="text-sm text-zinc-500">{selectedGame?.name} · Available slots: 12:00 PM – 11:00 PM</p>
        </div>
      </div>

      {/* Date Picker */}
      <div className="glass-card p-4 space-y-2">
        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> Select Date
        </label>
        <input
          type="date"
          value={selectedDate}
          min={minDate()}
          onChange={e => setSelectedDate(e.target.value)}
          className="w-full bg-zinc-950 text-white border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
        />
      </div>

      {/* Slot Grid */}
      <div className="glass-card p-4 space-y-3">
        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Available Slots
        </label>
        {slotsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
          </div>
        ) : slots.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-6">No slots available for this date.</p>
        ) : (
          <>
            {/* Legend */}
            <div className="flex items-center gap-4 text-[11px] text-zinc-500 mb-2">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-violet-600/30 border border-violet-500 inline-block" /> Available</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-zinc-800 border border-zinc-700 inline-block" /> Booked</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.startISO}
                  onClick={() => { if (slot.available) { setSelectedSlot(slot); setStep(2); } }}
                  disabled={!slot.available}
                  title={!slot.available ? "This slot is already booked" : ""}
                  className={cn(
                    "py-2.5 px-2 rounded-xl text-xs font-semibold text-center transition-all border",
                    slot.available
                      ? selectedSlot?.startISO === slot.startISO
                        ? "bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-900/30"
                        : "bg-zinc-900 border-zinc-700 text-zinc-200 hover:border-violet-500 hover:text-violet-300 cursor-pointer"
                      : "bg-zinc-900/40 border-zinc-800 text-zinc-600 cursor-not-allowed line-through"
                  )}
                >
                  {slot.time}
                  {!slot.available && (
                    <span className="block text-[9px] font-normal text-zinc-600 mt-0.5">Booked</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ── Step 2: Pick Duration ────────────────────────────────────────────────
  if (step === 2) return (
    <div className="space-y-5">
      <StepBar step={2} />
      <div className="flex items-center gap-3">
        <button onClick={() => setStep(1)} className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">How Long?</h2>
          <p className="text-sm text-zinc-500">{selectedGame?.name} · {selectedSlot?.time}</p>
        </div>
      </div>

      {/* Duration Grid */}
      <div className="glass-card p-5 space-y-4">
        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Select Duration</label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {durationOptions.map(opt => (
            <button
              key={opt.minutes}
              onClick={() => setDurationMinutes(opt.minutes)}
              className={cn(
                "py-3 rounded-xl text-sm font-bold text-center transition-all border",
                durationMinutes === opt.minutes
                  ? "bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-900/30"
                  : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-violet-500"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Accessories if applicable */}
        {selectedGame?.hasAccessories && (
          <div className="pt-3 border-t border-zinc-800 space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Controllers / Accessories</label>
            <div className="flex gap-2">
              {Array.from({ length: selectedGame.maxAccessories }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  onClick={() => setAccessories(n)}
                  className={cn(
                    "w-10 h-10 rounded-xl text-sm font-bold border transition-all",
                    accessories === n
                      ? "bg-violet-600 border-violet-600 text-white"
                      : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-violet-500"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="pt-3 border-t border-zinc-800 space-y-2">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Notes (optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any special requests..."
            className="w-full bg-zinc-950 border border-zinc-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-500 resize-none"
          />
        </div>
      </div>

      {/* Price Preview */}
      {durationMinutes > 0 && (
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500">Estimated Price</p>
            <p className="text-2xl font-extrabold text-white">{formatCurrency(estimatedPrice)}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Final price confirmed at counter</p>
          </div>
          <button
            onClick={() => setStep(3)}
            disabled={!durationMinutes}
            className="flex items-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-violet-900/30"
          >
            Review <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  // ── Step 3: Confirm & UPI ────────────────────────────────────────────────
  if (step === 3) return (
    <div className="space-y-5">
      <StepBar step={3} />
      <div className="flex items-center gap-3">
        <button onClick={() => setStep(2)} className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">Confirm Booking</h2>
          <p className="text-sm text-zinc-500">Review details and complete payment</p>
        </div>
      </div>

      {/* Summary */}
      <div className="glass-card p-5 space-y-3">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Booking Summary</h3>
        <div className="space-y-2 text-sm">
          {[
            ["Game", selectedGame?.name],
            ["Date", formatDate(new Date(selectedDate + "T00:00:00"))],
            ["Start Time", selectedSlot?.time],
            ["Duration", durationOptions.find(d => d.minutes === durationMinutes)?.label],
            ...(selectedGame?.hasAccessories ? [["Controllers", String(accessories)]] : []),
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b border-zinc-800/60 last:border-0">
              <span className="text-zinc-500">{label}</span>
              <span className="font-semibold text-white">{val}</span>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2">
            <span className="text-zinc-400 font-bold">Estimated Total</span>
            <span className="text-xl font-extrabold text-violet-400">{formatCurrency(estimatedPrice)}</span>
          </div>
        </div>
      </div>

      {/* Payment Instructions */}
      <div className="glass-card p-5 space-y-4 border-amber-500/20 bg-amber-500/5">
        <div className="flex items-start gap-2">
          <QrCode className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-white">Pay via UPI to confirm your slot</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Send <span className="text-white font-bold">{formatCurrency(estimatedPrice)}</span> to the UPI ID below,
              then submit your booking. Staff will verify your payment and confirm the slot.
            </p>
          </div>
        </div>

        {/* UPI ID */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">UPI ID</p>
            <p className="text-base font-mono font-bold text-white">{UPI_ID}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{UPI_NAME}</p>
          </div>
          <button
            onClick={copyUPI}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5",
              copied
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-violet-500"
            )}
          >
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </button>
        </div>

        {/* QR Placeholder */}
        <div className="flex justify-center">
          <div className="w-36 h-36 rounded-2xl border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center gap-2 text-zinc-600">
            <QrCode className="w-10 h-10" />
            <p className="text-[10px] text-center leading-tight">QR code<br/>coming soon</p>
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>Your booking will be <strong>Pending</strong> until staff verifies the payment. Please keep a screenshot of the payment handy when you arrive.</p>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-4 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-violet-900/30 disabled:opacity-60"
      >
        {submitting
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
          : <><Check className="w-4 h-4" /> Submit Booking Request</>}
      </button>
    </div>
  );

  // ── Step 4: Success ──────────────────────────────────────────────────────
  if (step === 4) return (
    <div className="space-y-6 text-center py-8">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-extrabold text-white">Booking Submitted!</h2>
        <p className="text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed">
          Your booking request is <span className="text-amber-400 font-semibold">Pending Review</span>. Staff will confirm it after verifying your payment.
        </p>
        {confirmedBookingId && (
          <p className="text-xs text-zinc-600 font-mono mt-1">
            Ref: #{confirmedBookingId.slice(-8).toUpperCase()}
          </p>
        )}
      </div>

      <div className="glass-card p-4 text-left space-y-2 max-w-xs mx-auto">
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">What happens next?</p>
        {[
          "Staff verifies your UPI payment",
          "Your booking status changes to Confirmed",
          "Show up at the venue at your booked time 🎮",
        ].map((txt, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
            <span className="w-4 h-4 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
            {txt}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 max-w-xs mx-auto">
        <button
          onClick={() => router.push("/customer/bookings")}
          className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl text-sm transition-all"
        >
          View My Bookings
        </button>
        <button
          onClick={() => { setStep(0); setSelectedGame(null); setSelectedSlot(null); setDurationMinutes(0); setNotes(""); }}
          className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold rounded-xl text-sm transition-all"
        >
          Book Another
        </button>
      </div>
    </div>
  );

  return null;
}
