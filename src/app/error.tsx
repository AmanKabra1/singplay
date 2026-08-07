"use client";

import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Segment-level error boundary (brief §4.2). Anything that throws while
 * rendering lands here instead of a white screen, and the user gets a way out
 * that isn't "reload and hope".
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[singplay] unhandled render error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-danger/15 text-danger">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </div>
      <h1 className="text-fluid-xl font-bold">Something went wrong</h1>
      <p className="max-w-md text-fluid-sm leading-relaxed text-muted">
        That page didn&apos;t load. It&apos;s usually temporary — try again, and
        if it keeps happening the reference below helps us track it down.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-faint">Reference: {error.digest}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="tap inline-flex items-center gap-2 rounded-xl bg-accent px-5 text-fluid-sm font-semibold text-white transition-colors hover:bg-accent-soft"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </button>
        <Link
          href="/"
          className="tap inline-flex items-center gap-2 rounded-xl border border-border-strong px-5 text-fluid-sm font-medium transition-colors hover:bg-surface-2"
        >
          <Home className="size-4" aria-hidden="true" />
          Go home
        </Link>
      </div>
    </div>
  );
}
