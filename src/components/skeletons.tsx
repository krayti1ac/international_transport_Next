import { Skeleton } from '@/components/ui/skeleton';

export function TripsKanbanSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((col) => (
          <div key={col} className="bg-muted/30 p-3 rounded-2xl border border-border/50 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-6 rounded-full" />
            </div>
            <div className="space-y-2.5">
              {[1, 2, 3].map((card) => (
                <div key={card} className="bg-card p-3 rounded-xl border border-border/60 space-y-2">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-3 w-3/4" />
                  <div className="flex justify-between pt-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InvoicesTableSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-xs">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="w-10 h-10 rounded-xl" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-card border border-border/80 rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="space-y-1.5 py-1">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border/40">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-20 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TreasurySkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col justify-between h-40 shadow-xs">
            <div className="flex justify-between items-start">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="w-8 h-8 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border/60 bg-muted/20 flex justify-between items-center">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-3 bg-muted/20 rounded-xl border border-border/40 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FleetSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-xs">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-2.5 w-32" />
            </div>
            <Skeleton className="w-10 h-10 rounded-xl" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-card border border-border/80 rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex justify-between items-center pb-2 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-xl" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <div className="space-y-2 py-1">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-border/40">
              <Skeleton className="h-8 flex-1 rounded-xl" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MaintenanceSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border/80 p-4 rounded-xl space-y-2 shadow-xs">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-card border border-border/80 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-1.5 py-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex justify-end pt-2 border-t border-border/40">
              <Skeleton className="h-7 w-20 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col justify-between h-44 shadow-xs">
            <div className="flex justify-between items-start">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="w-8 h-8 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border/80 p-5 rounded-2xl h-72 shadow-xs space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
        <div className="bg-card border border-border/80 p-5 rounded-2xl h-72 shadow-xs space-y-3">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      </div>
      <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border/60 bg-muted/20">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-3 bg-muted/20 rounded-xl flex justify-between items-center">
              <div className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
