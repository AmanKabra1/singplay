"use client";

import { Mic2, Pause, Play, Volume2, X } from "lucide-react";
import Link from "next/link";

import { IconButton } from "@/components/ui/Button";
import { CoverArt } from "@/components/ui/CoverArt";
import { InlineError } from "@/components/ui/States";
import type { SongDTO } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";
import { usePlayerStore } from "@/store/player";
import { AddToPlaylistButton } from "./AddToPlaylistButton";
import { FavoriteButton } from "./FavoriteButton";

/**
 * Dense list row, used by search results, playlists and the library.
 *
 * The row is a grid rather than a flex chain so the columns line up between
 * rows even when a title wraps, and so the action cluster can be dropped
 * entirely on narrow screens without the layout shifting.
 */
export function SongRow({
  song,
  queue,
  index,
  showIndex = false,
  onRemove,
  removeLabel = "Remove",
}: {
  song: SongDTO;
  queue?: SongDTO[];
  index?: number;
  showIndex?: boolean;
  onRemove?: (song: SongDTO) => void;
  removeLabel?: string;
}) {
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id ?? null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playSong = usePlayerStore((s) => s.playSong);
  const toggle = usePlayerStore((s) => s.toggle);
  const failedMessage = usePlayerStore((s) =>
    s.errorSongId === song.id ? s.errorMessage : null,
  );

  const isCurrent = currentId === song.id;
  const showPause = isCurrent && isPlaying;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2",
        isCurrent && "bg-surface-2/60",
      )}
    >
      {showIndex && (
        <span
          aria-hidden="true"
          className="hidden w-6 shrink-0 text-right font-mono text-xs tabular-nums text-faint sm:block"
        >
          {isCurrent ? (
            <Volume2 className="ml-auto size-3.5 text-accent-soft" />
          ) : (
            (index ?? 0) + 1
          )}
        </span>
      )}

      <button
        type="button"
        onClick={() => (isCurrent ? toggle() : playSong(song, queue))}
        aria-label={showPause ? `Pause ${song.title}` : `Play ${song.title}`}
        className="relative shrink-0 rounded-lg"
      >
        <CoverArt src={song.coverUrl} alt="" seed={song.title} className="size-11" />
        <span
          className={cn(
            "absolute inset-0 grid place-items-center rounded-lg bg-black/55 text-white",
            isCurrent ? "opacity-100" : "reveal-on-hover",
          )}
        >
          {showPause ? (
            <Pause className="size-4 fill-current" aria-hidden="true" />
          ) : (
            <Play className="size-4 translate-x-px fill-current" aria-hidden="true" />
          )}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <Link
          href={`/song/${song.id}`}
          className={cn(
            "block truncate text-fluid-sm font-medium hover:underline",
            isCurrent ? "text-accent-soft" : "text-text",
          )}
        >
          {song.title}
        </Link>
        <p className="truncate text-xs text-muted">
          {song.artist}
          {song.album ? ` · ${song.album}` : ""}
        </p>
        {failedMessage && <InlineError message={failedMessage} />}
      </div>

      {song.hasSyncedLyrics && (
        <Link
          href={`/karaoke/${song.id}`}
          title="Sing along"
          aria-label={`Sing along to ${song.title}`}
          className="tap hidden w-11 shrink-0 place-items-center rounded-xl text-accent-soft transition-colors hover:bg-surface-3 sm:grid"
        >
          <Mic2 className="size-[1.15rem]" aria-hidden="true" />
        </Link>
      )}

      <div className="hidden shrink-0 items-center sm:flex">
        <AddToPlaylistButton song={song} />
      </div>

      <FavoriteButton song={song} size="sm" />

      <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-faint">
        {formatDuration(song.durationSec)}
      </span>

      {onRemove && (
        <IconButton
          label={`${removeLabel} ${song.title}`}
          size="sm"
          onClick={() => onRemove(song)}
        >
          <X className="size-4" aria-hidden="true" />
        </IconButton>
      )}
    </div>
  );
}

export function SongList({
  songs,
  showIndex = true,
  onRemove,
  removeLabel,
}: {
  songs: SongDTO[];
  showIndex?: boolean;
  onRemove?: (song: SongDTO) => void;
  removeLabel?: string;
}) {
  return (
    <div className="flex flex-col">
      {songs.map((song, index) => (
        <SongRow
          key={song.id}
          song={song}
          queue={songs}
          index={index}
          showIndex={showIndex}
          onRemove={onRemove}
          removeLabel={removeLabel}
        />
      ))}
    </div>
  );
}
