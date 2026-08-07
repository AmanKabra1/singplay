import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Streaming placeholder for every page in the app shell.
 *
 * Deliberately neutral rather than shaped like any one screen: this boundary
 * covers browse, search, the library, the booth and the admin area, and a
 * skeleton that mimics the wrong page reads worse than one that mimics none.
 * Screens with a distinctive layout render their own skeleton once mounted.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3.5 w-64" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-48 w-full rounded-xl" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
