import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface StatTileProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  muted?: boolean;
  className?: string;
}

export const ACCENTS: Record<string, { iconBg: string; glow: string; bar: string }> = {
  zinc:    { iconBg: "bg-zinc-800/60 border-zinc-700/50",     glow: "bg-zinc-500",    bar: "bg-zinc-600" },
  emerald: { iconBg: "bg-emerald-500/10 border-emerald-500/25", glow: "bg-emerald-500", bar: "bg-emerald-500" },
  amber:   { iconBg: "bg-amber-500/10 border-amber-500/25",     glow: "bg-amber-500",   bar: "bg-amber-500" },
  violet:  { iconBg: "bg-violet-500/10 border-violet-500/25",   glow: "bg-violet-500",  bar: "bg-violet-500" },
  indigo:  { iconBg: "bg-indigo-500/10 border-indigo-500/25",   glow: "bg-indigo-500",  bar: "bg-indigo-500" },
  blue:    { iconBg: "bg-blue-500/10 border-blue-500/25",       glow: "bg-blue-500",    bar: "bg-blue-500" },
  rose:    { iconBg: "bg-rose-500/10 border-rose-500/25",       glow: "bg-rose-500",    bar: "bg-rose-500" },
};

export function accentFor(iconColor: string) {
  const match = iconColor.match(/text-(\w+)-\d+/);
  const name = match?.[1] ?? "violet";
  return ACCENTS[name] ?? ACCENTS.violet;
}

export default function StatTile({
  label, value, icon: Icon, iconColor = "text-violet-400", muted = false, className,
}: StatTileProps) {
  const accent = accentFor(iconColor);

  return (
    <div className={cn(
      "group relative glass-card px-4 py-6 flex flex-col items-center text-center gap-3 min-w-0 overflow-hidden",
      "hover:border-zinc-700/60 hover:-translate-y-0.5 transition-all duration-300",
      muted && "opacity-50",
      className
    )}>
      {/* Accent bar along the top */}
      <div className={cn("absolute left-0 right-0 top-0 h-[3px] opacity-70", accent.bar)} />

      {/* Corner glow, brightens on hover */}
      <div className={cn(
        "absolute -right-3 -top-3 w-20 h-20 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500",
        accent.glow
      )} />

      <div className={cn(
        "relative z-10 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border transition-transform duration-300 group-hover:scale-110",
        accent.iconBg
      )}>
        <Icon className={cn("w-6 h-6", iconColor)} />
      </div>
      <div className="relative z-10 min-w-0 w-full">
        <p className="text-xl font-black text-white leading-tight break-words tracking-tight">{value}</p>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider truncate mt-1">{label}</p>
      </div>
    </div>
  );
}
