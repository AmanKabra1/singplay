import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn("animate-shimmer rounded-lg bg-surface-2", className)}
    />
  );
}

/** Matches the geometry of `SongCard` so the grid doesn't reflow on load. */
export function SongCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-square w-full rounded-card" />
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function SongRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2 py-2.5">
      <Skeleton className="size-11 shrink-0 rounded-lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-3 w-10 shrink-0" />
    </div>
  );
}

export function SongGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <SongCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function SongListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex flex-col divide-y divide-border/60">
      {Array.from({ length: count }, (_, i) => (
        <SongRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function LyricsSkeleton() {
  const widths = ["70%", "55%", "82%", "48%", "66%", "76%", "40%"];
  return (
    <div className="flex flex-col gap-4 py-6">
      {widths.map((width, i) => (
        <Skeleton key={i} className="h-5" style={{ width }} />
      ))}
    </div>
  );
}
