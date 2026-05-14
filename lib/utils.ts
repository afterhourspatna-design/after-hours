import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  return `Rs ${num.toLocaleString("en-PK")}`;
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  if (isToday(d)) return `Today, ${format(d, "h:mm a")}`;
  if (isTomorrow(d)) return `Tomorrow, ${format(d, "h:mm a")}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, "h:mm a")}`;
  return format(d, "d MMM yyyy, h:mm a");
}

export function formatTimeRange(start: Date | string, end: Date | string): string {
  return `${format(new Date(start), "h:mm a")} – ${format(new Date(end), "h:mm a")}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}hr`;
  return `${h}hr ${m}min`;
}

export function formatRelative(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export const BOOKING_STATUS_CONFIG = {
  HOLD:      { label: "Hold",      color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  PENDING:   { label: "Pending",   color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  CONFIRMED: { label: "Confirmed", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  COMPLETED: { label: "Completed", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  CANCELLED: { label: "Cancelled", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  EXPIRED:   { label: "Expired",   color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
} as const;

export const PAYMENT_STATUS_CONFIG = {
  UNPAID:  { label: "Unpaid",  color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  PARTIAL: { label: "Partial", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  PAID:    { label: "Paid",    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
} as const;

export const GAME_COLOR_MAP: Record<string, string> = {
  ps5:         "#7c3aed",
  metaquest:   "#2563eb",
  soccer:      "#16a34a",
  tabletennis: "#0891b2",
  pool:        "#d97706",
  basketball:  "#ea580c",
  foosball:    "#db2777",
  event:       "#7c3aed",
};

export const SOURCE_LABELS: Record<string, string> = {
  WALK_IN:  "Walk-in",
  PHONE:    "Phone",
  INSTAGRAM:"Instagram",
  REFERRAL: "Referral",
  ONLINE:   "Online",
};

export function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function generateCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => {
        const val = r[h] ?? "";
        const str = String(val).replace(/"/g, '""');
        return str.includes(",") || str.includes('"') ? `"${str}"` : str;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
