"use client";

import { useEffect } from "react";

import { usePlayerStore } from "@/store/player";

/**
 * Connects the audio engine's events to the player store, exactly once for the
 * lifetime of the tab.
 *
 * It lives in the root layout rather than inside the player UI on purpose: the
 * mini-player unmounts whenever the queue is empty, and audio must keep working
 * — and keep reporting time — regardless of what is on screen.
 */
export function PlayerBridge() {
  useEffect(() => usePlayerStore.getState().attach(), []);
  return null;
}
