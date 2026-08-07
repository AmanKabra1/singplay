"use client";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import { useUiStore } from "@/store/ui";
import { cn } from "@/lib/utils";

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
} as const;

const TONES = {
  success: "border-success/30 text-success",
  error: "border-danger/30 text-danger",
  info: "border-border-strong text-accent-soft",
} as const;

/**
 * Sits above the mini-player on mobile so a toast never hides the transport
 * controls, and bottom-right on desktop.
 */
export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-3 z-60 flex flex-col-reverse gap-2 sm:inset-x-auto sm:right-4 sm:w-96"
      style={{ bottom: "calc(var(--player-h) + var(--tabbar-h) + 0.75rem)" }}
    >
      {toasts.map((item) => {
        const Icon = ICONS[item.variant];
        return (
          <div
            key={item.id}
            role={item.variant === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface-2/95 px-4 py-3 shadow-xl backdrop-blur animate-rise",
              TONES[item.variant],
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-fluid-sm font-medium text-text">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-xs text-muted">{item.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="-m-1 rounded-md p-1 text-faint transition-colors hover:text-text"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
