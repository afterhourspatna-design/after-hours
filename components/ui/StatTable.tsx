import { cn } from "@/lib/utils";
import { accentFor, type StatTileProps } from "./StatTile";

interface StatTableProps {
  items: StatTileProps[];
  className?: string;
}

export default function StatTable({ items, className }: StatTableProps) {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-2", className)}>
      {items.map((item) => {
        const accent = accentFor(item.iconColor ?? "text-violet-400");
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={cn(
              "glass-card flex items-center gap-2.5 px-3 py-2.5 min-w-0 overflow-hidden",
              item.muted && "opacity-50"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border",
              accent.iconBg
            )}>
              <Icon className={cn("w-4 h-4", item.iconColor)} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider truncate">{item.label}</p>
              <p className="text-sm font-black text-white truncate">{item.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
