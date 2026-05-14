import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: { value: number; label: string };
  className?: string;
  loading?: boolean;
}

export default function StatCard({
  title, value, subtitle, icon: Icon, iconColor = "text-violet-400",
  trend, className, loading = false,
}: StatCardProps) {
  if (loading) {
    return (
      <div className={cn("glass-card p-5", className)}>
        <div className="flex items-start justify-between mb-4">
          <div className="skeleton w-9 h-9 rounded-xl" />
          <div className="skeleton w-16 h-5 rounded-full" />
        </div>
        <div className="skeleton w-24 h-7 rounded-lg mb-2" />
        <div className="skeleton w-32 h-4 rounded-lg" />
      </div>
    );
  }

  const trendPositive = (trend?.value ?? 0) >= 0;

  return (
    <div className={cn(
      "glass-card p-5 hover:border-zinc-700/60 transition-all duration-300 group overflow-hidden relative",
      className
    )}>
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div>
           <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{title}</p>
           <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
        </div>
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border border-zinc-800/60 bg-zinc-900/50",
          "group-hover:scale-110 transition-transform duration-300"
        )}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-4 relative z-10">
        <div className="flex items-center gap-2">
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border",
              trendPositive
                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                : "text-red-400 bg-red-500/10 border-red-500/20"
            )}>
              {trendPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              {Math.abs(trend.value)}%
            </div>
          )}
          {subtitle && <p className="text-[10px] text-zinc-500 font-medium">{subtitle}</p>}
        </div>

        {/* Sparkline simulation */}
        <div className="w-16 h-8 opacity-40 group-hover:opacity-80 transition-opacity duration-500">
           <svg viewBox="0 0 60 30" fill="none" className="w-full h-full">
              <path 
                d={trendPositive ? "M0 25 L10 20 L20 22 L30 15 L40 18 L50 10 L60 5" : "M0 5 L10 10 L20 8 L30 15 L40 12 L50 20 L60 25"} 
                stroke={trendPositive ? "#10b981" : "#ef4444"} 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
           </svg>
        </div>
      </div>

      {/* Subtle background glow */}
      <div className={cn(
        "absolute -right-4 -bottom-4 w-16 h-16 blur-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-500",
        trendPositive ? "bg-emerald-500" : "bg-red-500"
      )} />
    </div>
  );
}
