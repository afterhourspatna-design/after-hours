import { cn } from "@/lib/utils";
import { LucideIcon, PackageOpen, CalendarX2, Users, Trophy } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-6 text-center",
      className
    )}>
      <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-zinc-500" />
      </div>
      <h3 className="text-base font-semibold text-zinc-300 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-zinc-600 max-w-xs leading-relaxed mb-4">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export const EMPTY_STATES = {
  bookings: {
    icon: CalendarX2,
    title: "No bookings yet",
    description: "Bookings you create will appear here.",
  },
  users: {
    icon: Users,
    title: "No users found",
    description: "Add your first customer to get started.",
  },
  games: {
    icon: Trophy,
    title: "No games configured",
    description: "Add games and pricing to start accepting bookings.",
  },
};
