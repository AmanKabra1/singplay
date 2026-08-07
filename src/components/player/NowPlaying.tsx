"use client";

import { ChevronDown, ListMusic, Mic2 } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { AddToPlaylistButton } from "@/components/song/AddToPlaylistButton";
import { FavoriteButton } from "@/components/song/FavoriteButton";
import { LyricsScroller, StaticLyrics } from "@/components/karaoke/LyricsScroller";
import { IconButton } from "@/components/ui/Button";
import { CoverArt } from "@/components/ui/CoverArt";
import { LyricsSkeleton } from "@/components/ui/Skeleton";
import { ErrorState, InlineError } from "@/components/ui/States";
import { useFetch } from "@/lib/hooks/useFetch";
import type { LyricsDTO } from "@/lib/types";
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
 * Full-screen "Now Playing" (brief §3.3).
 *
 * Phone/tablet: a single stacked column — art, metadata, transport, lyrics.
 * Laptop and up: art and controls on the left, the lyric panel alongside.
 */
export function NowPlaying() {
  const open = useUiStore((s) => s.nowPlayingOpen);
  const setOpen = useUiStore((s) => s.setNowPlayingOpen);
  const song = usePlayerStore((s) => s.queue[s.index] ?? null);
  const setQueueOpen = useUiStore((s) => s.setQueueOpen);
  const seek = usePlayerStore((s) => s.seek);
  const failedMessage = usePlayerStore((s) =>
    song && s.errorSongId === song.id ? s.errorMessage : null,
  );

  // Only fetch lyrics for a track that has them, and only while the panel is up.
  const { data, loading, error, refetch } = useFetch<LyricsDTO>(
    open && song ? `/api/songs/${song.id}/lyrics` : null,
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, setOpen]);

  if (!open || !song) return null;

  const syncedLines = data?.synced?.lines ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Now playing: ${song.title} by ${song.artist}`}
      className="fixed inset-0 z-50 flex flex-col bg-bg animate-rise"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3 lg:px-8">
        <IconButton label="Close now playing" onClick={() => setOpen(false)}>
          <ChevronDown className="size-6" aria-hidden="true" />
        </IconButton>
        <p className="min-w-0 flex-1 truncate text-center text-xs uppercase tracking-[0.14em] text-faint">
          Now playing
        </p>
        <IconButton label="Open queue" onClick={() => setQueueOpen(true)}>
          <ListMusic className="size-5" aria-hidden="true" />
        </IconButton>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-y-auto px-4 pb-6 lg:grid-cols-2 lg:grid-rows-1 lg:items-center lg:gap-10 lg:overflow-hidden lg:px-10">
        {/* Art, metadata and transport */}
        <div className="flex flex-col items-center gap-5 lg:mx-auto lg:max-w-md">
          <CoverArt
            src={song.coverUrl}
            alt={`Cover art for ${song.title}`}
            seed={song.title}
            eager
            rounded="rounded-2xl"
            className="w-full max-w-64 shrink-0 shadow-2xl sm:max-w-80 lg:max-w-full"
          />

          <div className="w-full text-center">
            <h1 className="truncate text-fluid-xl font-bold">{song.title}</h1>
            <p className="truncate text-fluid-base text-muted">{song.artist}</p>
            {song.album && <p className="truncate text-fluid-sm text-faint">{song.album}</p>}
            {failedMessage && (
              <div className="mt-2 flex justify-center">
                <InlineError message={failedMessage} />
              </div>
            )}
          </div>

          <div className="w-full">
            <SeekBar />
          </div>

          <div className="flex items-center gap-2">
            <ShuffleRepeatButtons />
            <SkipButtons />
            <PlayPauseButton size="lg" />
            <FavoriteButton song={song} />
            <AddToPlaylistButton song={song} size="icon" />
          </div>

          <div className="flex w-full items-center justify-between gap-3">
            <Link
              href={`/karaoke/${song.id}`}
              onClick={() => setOpen(false)}
              className="tap inline-flex items-center gap-2 rounded-xl border border-accent/40 px-4 text-fluid-sm font-semibold text-accent-soft transition-colors hover:bg-accent/10"
            >
              <Mic2 className="size-4" aria-hidden="true" />
              Sing along
            </Link>
            <VolumeControl className="hidden sm:flex" />
          </div>
        </div>

        {/* Lyrics */}
        <div className="flex min-h-72 flex-col rounded-2xl border border-border bg-surface/60 lg:h-[70vh] lg:min-h-0">
          <h2 className="border-b border-border px-4 py-3 text-xs uppercase tracking-[0.14em] text-faint">
            Lyrics
          </h2>

          <div className="min-h-0 flex-1 overflow-hidden">
            {loading && (
              <div className="px-4">
                <LyricsSkeleton />
              </div>
            )}

            {error && (
              <div className="p-4">
                <ErrorState
                  compact
                  title="Couldn't load the lyrics"
                  description={error.message}
                  offline={error.isOffline}
                  onRetry={refetch}
                />
              </div>
            )}

            {data && syncedLines.length > 0 && (
              <LyricsScroller lines={syncedLines} fontScale={1.15} onSeekToLine={seek} />
            )}

            {data && syncedLines.length === 0 && data.plainText && (
              <div className="h-full overflow-y-auto px-5 py-4">
                <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                  Sync isn&apos;t available for this track yet — here are the
                  lyrics to read along with.
                </p>
                <StaticLyrics text={data.plainText} fontScale={1} />
              </div>
            )}

            {data && syncedLines.length === 0 && !data.plainText && (
              <p className="grid h-full place-items-center px-6 text-center text-fluid-sm text-faint">
                No lyrics have been added for this track yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
