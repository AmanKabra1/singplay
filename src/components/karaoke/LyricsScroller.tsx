"use client";

import { useEffect, useRef, useState } from "react";

import { activeLineIndex, activeWordIndex } from "@/lib/lrc";
import type { LyricLine } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player";

/**
 * Timed lyric display shared by Now Playing and Karaoke mode.
 *
 * Performance note: the component subscribes to the player store through a
 * *derived* selector (the active line index), so a 60fps stream of time updates
 * only re-renders when the highlighted line actually changes. Word-level
 * highlighting is isolated in `<ActiveLine>` for the same reason.
 */
export function LyricsScroller({
  lines,
  fontScale = 1.25,
  onSeekToLine,
  className,
  align = "center",
}: {
  lines: LyricLine[];
  fontScale?: number;
  onSeekToLine?: (time: number) => void;
  className?: string;
  align?: "center" | "left";
}) {
  const active = usePlayerStore((s) => activeLineIndex(lines, s.currentTime));
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the active line vertically centred, unless the user is scrolling
  // themselves — then back off for a few seconds so we don't fight them.
  useEffect(() => {
    if (!autoScroll || active < 0) return;
    const node = lineRefs.current[active];
    const container = containerRef.current;
    if (!node || !container) return;

    const target =
      node.offsetTop - container.clientHeight / 2 + node.clientHeight / 2;
    container.scrollTo({
      top: Math.max(0, target),
      behavior: "smooth",
    });
  }, [active, autoScroll]);

  function pauseAutoScroll() {
    setAutoScroll(false);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setAutoScroll(true), 5000);
  }

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      onWheel={pauseAutoScroll}
      onTouchMove={pauseAutoScroll}
      className={cn(
        "scrollbar-none relative h-full overflow-y-auto overscroll-contain",
        className,
      )}
      // The blank space top and bottom lets the first and last lines reach the
      // centre of the viewport.
      style={{ scrollBehavior: "smooth" }}
    >
      <div aria-hidden="true" className="h-[38%]" />
      <ol
        className={cn(
          "flex flex-col gap-4 px-4",
          align === "center" ? "items-center text-center" : "items-start text-left",
        )}
        style={{ fontSize: `${fontScale}rem` }}
      >
        {lines.map((line, i) => {
          const state = i === active ? "active" : i < active ? "past" : "upcoming";
          return (
            <li
              key={`${line.t}-${i}`}
              ref={(node) => {
                lineRefs.current[i] = node;
              }}
              // The whole karaoke panel is one live region would be too noisy;
              // instead the active line alone is announced.
              aria-current={state === "active" ? "true" : undefined}
            >
              <button
                type="button"
                onClick={() => onSeekToLine?.(line.t)}
                disabled={!onSeekToLine}
                className={cn(
                  "block w-full rounded-lg px-2 py-1 leading-snug transition-all duration-300",
                  onSeekToLine && "hover:bg-white/5",
                  state === "active" &&
                    "scale-[1.04] font-bold text-white drop-shadow-[0_0_18px_rgba(139,92,246,0.55)]",
                  state === "past" && "text-muted/55",
                  state === "upcoming" && "text-muted",
                )}
              >
                {state === "active" && line.words?.length ? (
                  <ActiveLine line={line} />
                ) : (
                  (line.text || "♪")
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <div aria-hidden="true" className="h-[45%]" />

      {!autoScroll && (
        <button
          type="button"
          onClick={() => setAutoScroll(true)}
          className="sticky bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white shadow-lg"
        >
          Resume auto-scroll
        </button>
      )}
    </div>
  );
}

/**
 * Karaoke-ball word highlighting, used when the timing data has per-word marks.
 * Isolated so only this subtree re-renders as words advance.
 */
function ActiveLine({ line }: { line: LyricLine }) {
  const wordIndex = usePlayerStore((s) => activeWordIndex(line, s.currentTime));

  return (
    <span>
      {line.words!.map((word, i) => (
        <span
          key={`${word.t}-${i}`}
          className={cn(
            "transition-colors duration-150",
            i <= wordIndex ? "text-accent-soft" : "text-white/85",
          )}
        >
          {word.w}
          {i < line.words!.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

/** Untimed lyrics — still readable, just not synced (brief §3.4 fallback). */
export function StaticLyrics({
  text,
  fontScale = 1,
  className,
}: {
  text: string;
  fontScale?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("whitespace-pre-wrap leading-relaxed text-muted", className)}
      style={{ fontSize: `${fontScale}rem` }}
    >
      {text}
    </div>
  );
}
