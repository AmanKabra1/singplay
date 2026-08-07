"use client";

import { AlertTriangle, Loader2, RefreshCw, SearchX, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden="true"
      className={cn("size-5 animate-spin text-current", className)}
    />
  );
}

/** Inline "we're loading, hold on" with an accessible live announcement. */
export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3 py-16 text-muted"
    >
      <Spinner className="size-6 text-accent-soft" />
      <p className="text-fluid-sm">{label}…</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border px-6 py-14 text-center">
      <div className="text-faint" aria-hidden="true">
        {icon ?? <SearchX className="size-8" />}
      </div>
      <h3 className="text-fluid-lg font-semibold text-text">{title}</h3>
      {description && (
        <p className="max-w-sm text-fluid-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * The one thing a user should never see is a blank screen or a stack trace.
 * Every fetch failure in the app renders through here (brief §4.2).
 */
export function ErrorState({
  title = "Couldn't load this",
  description,
  onRetry,
  offline = false,
  compact = false,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  offline?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-danger/25 bg-danger/5 text-center",
        compact ? "px-4 py-6" : "px-6 py-12",
      )}
    >
      <div className="text-danger" aria-hidden="true">
        {offline ? <WifiOff className="size-7" /> : <AlertTriangle className="size-7" />}
      </div>
      <h3 className="text-fluid-base font-semibold text-text">
        {offline ? "You're offline" : title}
      </h3>
      <p className="max-w-sm text-fluid-sm text-muted">
        {offline
          ? "We'll pick up where you left off as soon as you reconnect."
          : (description ?? "Something went wrong while loading this section.")}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="tap mt-1 inline-flex items-center gap-2 rounded-xl border border-border-strong px-4 text-fluid-sm font-medium text-text transition-colors hover:bg-surface-2"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}

/** Inline error for a single row — e.g. one track in a queue failed to load. */
export function InlineError({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}
