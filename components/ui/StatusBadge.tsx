import { cn, BOOKING_STATUS_CONFIG, PAYMENT_STATUS_CONFIG } from "@/lib/utils";
import type { BookingStatus, PaymentStatus } from "@prisma/client";

interface BookingStatusBadgeProps {
  status: BookingStatus;
  className?: string;
}

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  className?: string;
}

export function BookingStatusBadge({ status, className }: BookingStatusBadgeProps) {
  const config = BOOKING_STATUS_CONFIG[status];
  return (
    <span className={cn("badge", config.color, className)}>
      {status === "HOLD" && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  const config = PAYMENT_STATUS_CONFIG[status];
  return (
    <span className={cn("badge", config.color, className)}>
      {config.label}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    ADMIN:    "bg-violet-500/15 text-violet-400 border-violet-500/25",
    STAFF:    "bg-blue-500/15 text-blue-400 border-blue-500/25",
    CUSTOMER: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  };
  return (
    <span className={cn("badge", map[role] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/25")}>
      {role}
    </span>
  );
}
