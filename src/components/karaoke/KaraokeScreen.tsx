"use client";

import { ArrowLeft, Gauge, Type } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { MicMeter } from "@/components/karaoke/MicMeter";
import { PlayPauseButton, SeekBar, SkipButtons } from "@/components/player/PlayerControls";
import { CoverArt } from "@/components/ui/CoverArt";
import { KARAOKE_SPEEDS, LYRIC_FONT_SIZES } from "@/lib/constants";
import type { LyricsDTO, SongDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player";
import { LyricsScroller, StaticLyrics } from "./LyricsScroller";

/**
 * The sing-along stage.
 *
 * Three things happen here that don't happen in the normal player: playback runs
 * in `karaoke` mode (so it counts toward the practice streak), the tempo can be
 * dropped without the pitch dropping with it, and the position is checkpointed
 * so "Continue practicing" can pick the track back up.
 */
export function KaraokeScreen({
  song,
  lyrics,
}: {
  song: SongDTO;
  lyrics: LyricsDTO;
}) {
  const playSong = usePlayerStore((s) => s.playSong);
  const seek = usePlayerStore((s) => s.seek);
  const pause = usePlayerStore((s) => s.pause);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const isCurrent = usePlayerStore((s) => s.queue[s.index]?.id === song.id);

  const [fontScale, setFontScale] = useState(1.6);
  const startedRef = useRef(false);

  const lines = lyrics.synced?.lines ?? [];
  const hasSync = lines.length > 0;

  // Load the track into the player the first time the stage opens. Guarded by a
  // ref rather than a dependency list so re-renders don't restart the song.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (!isCurrent) playSong(song, [song], "karaoke");
  }, [isCurrent, playSong, song]);

  // Leaving the stage must not leave the deck in slow motion.
  useEffect(
    () => () => {
      usePlayerStore.getState().setPlaybackRate(1);
    },
    [],
  );

  /**
   * Checkpoint the practice position. Fired on unmount and when the tab is
   * hidden — `keepalive` so the request survives the page going away.
   */
  useEffect(() => {
    function checkpoint() {
      const state = usePlayerStore.getState();
      if (state.queue[state.index]?.id !== song.id) return;
      const position = state.currentTime;
      if (position < 5) return;

      const duration = state.duration || song.durationSec;
      void fetch("/api/karaoke/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          songId: song.id,
          lastPositionSec: Math.round(position),
          completed: duration > 0 && position >= duration * 0.9,
        }),
        keepalive: true,
      }).catch(() => {});
    }

    const onHide = () => {
      if (document.visibilityState === "hidden") checkpoint();
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      document.removeEventListener("visibilitychange", onHide);
      checkpoint();
    };
  }, [song.id, song.durationSec]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/song/${song.id}`}
          className="inline-flex items-center gap-1.5 text-fluid-sm text-muted transition-colors hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the track
        </Link>
        <MicMeter />
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        {/* Track + controls */}
        <aside className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 lg:flex-col lg:items-stretch lg:gap-5">
          <CoverArt
            src={song.coverUrl}
            alt=""
            seed={song.title}
            eager
            rounded="rounded-xl"
            className="size-20 shrink-0 lg:size-auto lg:w-full lg:aspect-square"
          />

          <div className="min-w-0 flex-1 lg:flex-none">
            <h1 className="truncate text-fluid-lg font-bold">{song.title}</h1>
            <p className="truncate text-fluid-sm text-muted">{song.artist}</p>
          </div>

          <div className="hidden flex-col gap-4 lg:flex">
            <SeekBar />
            <div className="flex items-center justify-center gap-2">
              <SkipButtons />
              <PlayPauseButton size="lg" />
            </div>

            <ControlGroup
              icon={<Gauge className="size-3.5" aria-hidden="true" />}
              label="Practice speed"
              hint="Pitch stays put — only the tempo changes."
            >
              {KARAOKE_SPEEDS.map((speed) => (
                <Segment
                  key={speed}
                  active={playbackRate === speed}
                  onClick={() => setPlaybackRate(speed)}
                  label={`${speed}×`}
                  aria-label={`Play at ${speed} times speed`}
                />
              ))}
            </ControlGroup>

            <ControlGroup
              icon={<Type className="size-3.5" aria-hidden="true" />}
              label="Lyric size"
            >
              {LYRIC_FONT_SIZES.map((size) => (
                <Segment
                  key={size.value}
                  active={fontScale === size.value}
                  onClick={() => setFontScale(size.value)}
                  label={size.label}
                  aria-label={`${size.label} lyric text`}
                />
              ))}
            </ControlGroup>
          </div>
        </aside>

        {/* Lyric stage */}
        <section
          aria-label="Lyrics"
          className="relative h-[58vh] min-h-80 overflow-hidden rounded-2xl border border-border bg-linear-to-b from-surface via-bg to-surface lg:h-[calc(100dvh-16rem)]"
        >
          {hasSync ? (
            <LyricsScroller
              lines={lines}
              fontScale={fontScale}
              onSeekToLine={(time) => seek(time)}
            />
          ) : (
            <div className="h-full overflow-y-auto px-5 py-6">
              <p
                role="status"
                className="mx-auto mb-5 max-w-md rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-center text-fluid-sm text-warning"
              >
                Sync isn&apos;t available for this track yet — the lyrics are
                below, but they won&apos;t highlight in time.
              </p>
              {lyrics.plainText ? (
                <StaticLyrics
                  text={lyrics.plainText}
                  fontScale={fontScale * 0.7}
                  className="mx-auto max-w-2xl text-center"
                />
              ) : (
                <p className="text-center text-fluid-sm text-faint">
                  No lyrics have been added for this track yet.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Phone/tablet controls, docked under the stage */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 lg:hidden">
        <SeekBar />
        <div className="flex items-center justify-center gap-3">
          <SkipButtons />
          <PlayPauseButton size="lg" />
        </div>
        <div className="flex flex-wrap gap-4">
          <ControlGroup
            icon={<Gauge className="size-3.5" aria-hidden="true" />}
            label="Speed"
          >
            {KARAOKE_SPEEDS.map((speed) => (
              <Segment
                key={speed}
                active={playbackRate === speed}
                onClick={() => setPlaybackRate(speed)}
                label={`${speed}×`}
                aria-label={`Play at ${speed} times speed`}
              />
            ))}
          </ControlGroup>
          <ControlGroup
            icon={<Type className="size-3.5" aria-hidden="true" />}
            label="Lyric size"
          >
            {LYRIC_FONT_SIZES.map((size) => (
              <Segment
                key={size.value}
                active={fontScale === size.value}
                onClick={() => setFontScale(size.value)}
                label={size.label}
                aria-label={`${size.label} lyric text`}
              />
            ))}
          </ControlGroup>
        </div>
        <button
          type="button"
          onClick={pause}
          className="text-fluid-sm text-faint hover:text-muted"
        >
          Pause and save my place
        </button>
      </div>
    </div>
  );
}

function ControlGroup({
  icon,
  label,
  hint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="min-w-0 flex-1">
      <legend className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-widest text-faint">
        {icon}
        {label}
      </legend>
      <div className="flex gap-1 rounded-xl bg-surface-2 p-1">{children}</div>
      {hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
    </fieldset>
  );
}

function Segment({
  active,
  onClick,
  label,
  ...rest
}: {
  active: boolean;
  onClick: () => void;
  label: string;
} & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-9 flex-1 rounded-lg px-2 text-fluid-sm font-medium transition-colors",
        active ? "bg-accent text-white" : "text-muted hover:bg-surface-3 hover:text-text",
      )}
      {...rest}
    >
      {label}
    </button>
  );
}
