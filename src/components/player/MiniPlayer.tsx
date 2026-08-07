"use client";

import Link from "next/link";
import { ChevronUp, ListMusic, Mic2 } from "lucide-react";

import { CoverArt } from "@/components/ui/CoverArt";
import { IconButton } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/States";
import { usePlayerStore } from "@/store/player";
import { useUiStore } from "@/store/ui";
import {
  PlayPauseButton,
  SeekBar,
  ShuffleRepeatButtons,
  SkipButtons,
  VolumeControl,
} from "./PlayerControls";

/**
 * The persistent transport bar (brief §3.3).
 *
 * One component across every breakpoint — it doesn't swap layouts, it just
 * reveals more controls as space allows: cover + title + play on a phone,
 * the full transport with seek and volume on a laptop.
 */
export function MiniPlayer() {
  const song = usePlayerStore((s) => s.queue[s.index] ?? null);
  const errorSongId = usePlayerStore((s) => s.errorSongId);
  const errorMessage = usePlayerStore((s) => s.errorMessage);
  const setNowPlayingOpen = useUiStore((s) => s.setNowPlayingOpen);
  const setQueueOpen = useUiStore((s) => s.setQueueOpen);

  if (!song) return null;

  const failed = errorSongId === song.id ? errorMessage : null;

  return (
    <div
      className="fixed inset-x-0 z-40 bg-surface/95 backdrop-blur-md lg:left-64"
      style={{ bottom: "var(--tabbar-h)", height: "var(--player-h)" }}
    >
      {/* Gradient accent stripe at the very top of the player */}
      <div
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--color-accent) 30%, var(--color-cyan) 70%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      {/* Thin progress line for phones, where the full seek bar doesn't fit. */}
      <div className="px-3 pt-1 lg:hidden">
        <SeekBar showTimes={false} />
      </div>

      <div className="flex h-full items-center gap-3 px-3 pb-1 lg:gap-4 lg:px-6 lg:pb-0">
        <button
          type="button"
          onClick={() => setNowPlayingOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors hover:bg-surface-2 lg:max-w-[22rem] lg:flex-none"
          aria-label={`Open now playing: ${song.title} by ${song.artist}`}
        >
          <CoverArt
            src={song.coverUrl}
            alt=""
            seed={song.title}
            className="size-11 shrink-0"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-fluid-sm font-medium text-text">
              {song.title}
            </span>
            <span className="block truncate text-xs text-muted">{song.artist}</span>
            {failed && <InlineError message={failed} />}
          </span>
          <ChevronUp className="size-4 shrink-0 text-faint lg:hidden" aria-hidden="true" />
        </button>

        {/* Phone: just the essentials — the full transport lives in Now Playing. */}
        <div className="flex items-center gap-1 lg:hidden">
          <PlayPauseButton size="sm" />
        </div>

        {/* Laptop and up: the full transport, centred. */}
        <div className="hidden min-w-0 flex-1 flex-col items-center gap-1 lg:flex">
          <div className="flex items-center gap-1">
            <ShuffleRepeatButtons />
            <SkipButtons compact />
            <PlayPauseButton size="sm" />
          </div>
          <div className="w-full max-w-xl">
            <SeekBar />
          </div>
        </div>

        <div className="hidden items-center gap-1 lg:flex">
          <Link
            href={`/karaoke/${song.id}`}
            aria-label={`Sing along to ${song.title}`}
            title="Sing along"
            className="tap grid w-11 place-items-center rounded-xl text-accent-soft transition-colors hover:bg-surface-2"
          >
            <Mic2 className="size-4" aria-hidden="true" />
          </Link>
          <IconButton label="Open queue" size="sm" onClick={() => setQueueOpen(true)}>
            <ListMusic className="size-4" aria-hidden="true" />
          </IconButton>
          <VolumeControl />
        </div>
      </div>
    </div>
  );
}
