"use client";

import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useState } from "react";

import { IconButton } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/States";
import { GUEST_PREVIEW_SECONDS } from "@/lib/constants";
import { cn, formatDuration } from "@/lib/utils";
import { usePlayerStore } from "@/store/player";

export function PlayPauseButton({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const buffering = usePlayerStore((s) => s.buffering);
  const toggle = usePlayerStore((s) => s.toggle);
  const hasTrack = usePlayerStore((s) => s.index >= 0);

  const dimensions = {
    sm: "size-9",
    md: "size-11",
    lg: "size-16",
  }[size];
  const iconSize = { sm: "size-4", md: "size-5", lg: "size-7" }[size];

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!hasTrack}
      aria-label={isPlaying ? "Pause" : "Play"}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-text text-bg transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100",
        dimensions,
      )}
    >
      {buffering && isPlaying ? (
        <Spinner className={iconSize} />
      ) : isPlaying ? (
        <Pause className={cn(iconSize, "fill-current")} aria-hidden="true" />
      ) : (
        <Play className={cn(iconSize, "translate-x-px fill-current")} aria-hidden="true" />
      )}
    </button>
  );
}

export function SkipButtons({ compact = false }: { compact?: boolean }) {
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const hasTrack = usePlayerStore((s) => s.index >= 0);
  const size = compact ? "size-4" : "size-5";

  return (
    <>
      <IconButton
        label="Previous track"
        onClick={() => previous()}
        disabled={!hasTrack}
        size={compact ? "sm" : "icon"}
      >
        <SkipBack className={cn(size, "fill-current")} aria-hidden="true" />
      </IconButton>
      <IconButton
        label="Next track"
        onClick={() => next()}
        disabled={!hasTrack}
        size={compact ? "sm" : "icon"}
      >
        <SkipForward className={cn(size, "fill-current")} aria-hidden="true" />
      </IconButton>
    </>
  );
}

export function ShuffleRepeatButtons() {
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);

  const repeatLabel =
    repeat === "off"
      ? "Repeat off — press to repeat all"
      : repeat === "all"
        ? "Repeating queue — press to repeat one"
        : "Repeating one track — press to turn off";

  return (
    <>
      <IconButton
        label={shuffle ? "Shuffle on — press to turn off" : "Shuffle off"}
        aria-pressed={shuffle}
        onClick={toggleShuffle}
        size="sm"
        className={shuffle ? "text-accent-soft" : undefined}
      >
        <Shuffle className="size-4" aria-hidden="true" />
      </IconButton>
      <IconButton
        label={repeatLabel}
        onClick={cycleRepeat}
        size="sm"
        className={repeat !== "off" ? "text-accent-soft" : undefined}
      >
        {repeat === "one" ? (
          <Repeat1 className="size-4" aria-hidden="true" />
        ) : (
          <Repeat className="size-4" aria-hidden="true" />
        )}
      </IconButton>
    </>
  );
}

/**
 * Seek bar. Uses local state while dragging so the thumb tracks the pointer
 * instead of fighting the 60fps time updates coming back from the engine.
 */
export function SeekBar({ showTimes = true }: { showTimes?: boolean }) {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const storeDuration = usePlayerStore((s) => s.duration);
  const seek = usePlayerStore((s) => s.seek);
  const isAuthenticated = usePlayerStore((s) => s.isAuthenticated);
  const hasTrack = usePlayerStore((s) => s.index >= 0);

  /**
   * The in-progress drag is tagged with the duration it was captured against, so
   * a track change mid-drag discards it without an effect having to reset state.
   */
  const [drag, setDrag] = useState<{ value: number; duration: number } | null>(null);
  const dragValue = drag && drag.duration === storeDuration ? drag.value : null;
  const setDragValue = (value: number) => setDrag({ value, duration: storeDuration });
  const clearDrag = () => setDrag(null);

  // Guests can only scrub within the preview window.
  const duration = isAuthenticated
    ? storeDuration
    : Math.min(storeDuration || GUEST_PREVIEW_SECONDS, GUEST_PREVIEW_SECONDS);
  const value = dragValue ?? Math.min(currentTime, duration || 0);
  const percent = duration > 0 ? (value / duration) * 100 : 0;

  return (
    <div className="flex w-full items-center gap-2.5">
      {showTimes && (
        <span className="w-10 shrink-0 text-right font-mono text-[0.7rem] tabular-nums text-faint">
          {formatDuration(value)}
        </span>
      )}
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={value}
        disabled={!hasTrack || duration === 0}
        onChange={(event) => setDragValue(Number(event.target.value))}
        onPointerUp={() => {
          if (dragValue != null) seek(dragValue);
          clearDrag();
        }}
        onKeyUp={() => {
          if (dragValue != null) seek(dragValue);
          clearDrag();
        }}
        aria-label="Seek"
        aria-valuetext={`${formatDuration(value)} of ${formatDuration(duration)}`}
        className="min-w-0 flex-1"
        style={{
          // Filled portion of the track, painted through the shared range CSS.
          ["--track" as string]: `linear-gradient(to right, var(--color-accent) ${percent}%, var(--color-surface-3) ${percent}%)`,
        }}
      />
      {showTimes && (
        <span className="w-10 shrink-0 font-mono text-[0.7rem] tabular-nums text-faint">
          {formatDuration(duration)}
        </span>
      )}
    </div>
  );
}

export function VolumeControl({ className }: { className?: string }) {
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);

  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <IconButton
        label={muted ? "Unmute" : "Mute"}
        aria-pressed={muted}
        onClick={toggleMute}
        size="sm"
      >
        <Icon className="size-4" aria-hidden="true" />
      </IconButton>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={effective}
        onChange={(event) => setVolume(Number(event.target.value))}
        aria-label="Volume"
        aria-valuetext={`${Math.round(effective * 100)} percent`}
        className="w-24"
        style={{
          ["--track" as string]: `linear-gradient(to right, var(--color-text) ${effective * 100}%, var(--color-surface-3) ${effective * 100}%)`,
        }}
      />
    </div>
  );
}

/**
 * Global keyboard shortcuts for the transport (brief §4.4). Ignored while the
 * user is typing so Space still inserts a space in a search box.
 */
export function PlayerKeyboardShortcuts() {
  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const seekBy = usePlayerStore((s) => s.seekBy);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case " ":
        case "k":
          event.preventDefault();
          toggle();
          break;
        case "ArrowRight":
          if (event.shiftKey) {
            event.preventDefault();
            next();
          } else {
            event.preventDefault();
            seekBy(5);
          }
          break;
        case "ArrowLeft":
          if (event.shiftKey) {
            event.preventDefault();
            previous();
          } else {
            event.preventDefault();
            seekBy(-5);
          }
          break;
        case "ArrowUp":
          event.preventDefault();
          setVolume(usePlayerStore.getState().volume + 0.05);
          break;
        case "ArrowDown":
          event.preventDefault();
          setVolume(usePlayerStore.getState().volume - 0.05);
          break;
        case "m":
          toggleMute();
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle, next, previous, seekBy, setVolume, toggleMute]);

  return null;
}
