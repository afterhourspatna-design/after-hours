import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-48 rounded-lg" />
            <Skeleton className="h-3 w-32 rounded-lg" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-5 space-y-3">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-3.5 w-28 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="glass-card p-4 animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-xl" />
          <Skeleton className="h-8 w-16 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-6 rounded-lg" />
        ))}
      </div>
      <div className="space-y-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
            <Skeleton className="h-12 flex-1 rounded-lg" style={{ opacity: Math.random() > 0.6 ? 1 : 0.3 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
