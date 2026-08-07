import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  return `Rs ${num.toLocaleString("en-PK")}`;
}

function getPartsInTimeZone(date: Date, timeZone: string = "Asia/Kolkata") {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const yearPart = parts.find(p => p.type === "year");
    const monthPart = parts.find(p => p.type === "month");
    const dayPart = parts.find(p => p.type === "day");
    const hourPart = parts.find(p => p.type === "hour");
    const minutePart = parts.find(p => p.type === "minute");

    return {
      year: yearPart ? parseInt(yearPart.value, 10) : date.getFullYear(),
      month: monthPart ? parseInt(monthPart.value, 10) : date.getMonth() + 1,
      day: dayPart ? parseInt(dayPart.value, 10) : date.getDate(),
      hour: hourPart ? parseInt(hourPart.value, 10) : date.getHours(),
      minute: minutePart ? parseInt(minutePart.value, 10) : date.getMinutes()
    };
  } catch (e) {
    // Return standard system local components if timezone formatting fails
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes()
    };
  }
}

function getISTDayRelative(date: Date): "today" | "tomorrow" | "yesterday" | "other" {
  const target = getPartsInTimeZone(date);
  const now = getPartsInTimeZone(new Date());

  const targetMidnight = Date.UTC(target.year, target.month - 1, target.day);
  const nowMidnight = Date.UTC(now.year, now.month - 1, now.day);
  
  const diffDays = Math.round((targetMidnight - nowMidnight) / (24 * 60 * 60 * 1000));
  
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  return "other";
}

function formatTimeInIST(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    // Replace any narrow no-break space or non-standard space with normal spaces to prevent NextJS hydration errors
    return formatter.format(date).replace(/\s+/g, " ");
  } catch (e) {
    return format(date, "h:mm a");
  }
}

function formatDateInISTFull(date: Date): string {
  const parts = getPartsInTimeZone(date);
  const timeStr = formatTimeInIST(date);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = months[Math.max(0, Math.min(parts.month - 1, 11))];
  return `${parts.day} ${monthName} ${parts.year}, ${timeStr}`;
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Invalid Date";
  
  const relative = getISTDayRelative(d);
  const timeStr = formatTimeInIST(d);
  
  if (relative === "today") return `Today, ${timeStr}`;
  if (relative === "tomorrow") return `Tomorrow, ${timeStr}`;
  if (relative === "yesterday") return `Yesterday, ${timeStr}`;
  
  return formatDateInISTFull(d);
}

export function formatTimeRange(start: Date | string, end: Date | string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "Invalid Time Range";
  return `${formatTimeInIST(s)} – ${formatTimeInIST(e)}`;
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
  ps4:         "#0ea5e9",
  metaquest:   "#2563eb",
  soccer:      "#16a34a",
  tabletennis: "#0891b2",
  pool:        "#d97706",
  basketball:  "#ea580c",
  foosball:    "#db2777",
  event:       "#7c3aed",
  carrom:      "#ef4444",
  jenga:       "#f59e0b",
  cards:       "#10b981",
};

export const SOURCE_LABELS: Record<string, string> = {
  WALK_IN:  "Walk-in",
  PHONE:    "Phone",
  INSTAGRAM:"Instagram",
  REFERRAL: "Referral",
  ONLINE:   "Online",
  CREDITS:  "Credits",
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
