"use client";

import { WifiOff } from "lucide-react";

import { useUiStore } from "@/store/ui";

/**
 * Connection banner (brief §4.2). Pinned to the top so it's visible whatever
 * the user is doing, and announced politely rather than stealing focus.
 */
export function OfflineBanner() {
  const online = useUiStore((s) => s.online);
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-warning px-4 py-2 text-center text-xs font-semibold text-black"
    >
      <WifiOff className="size-4" aria-hidden="true" />
      You&apos;re offline — playback of cached audio may continue, but changes
      won&apos;t save until you reconnect.
    </div>
  );
}
