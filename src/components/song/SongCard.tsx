"use client";

import { Pause, Play } from "lucide-react";
import Link from "next/link";

import { CoverArt } from "@/components/ui/CoverArt";
import { InlineError } from "@/components/ui/States";
import type { SongDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player";
import { FavoriteButton } from "./FavoriteButton";

/** Animated equalizer bars — shown on the cover art while the track is current. */
function EqualizerBars({ paused }: { paused: boolean }) {
  const bars = [
    { h: 14, delay: "0ms", dur: "0.8s" },
    { h: 14, delay: "120ms", dur: "0.65s" },
    { h: 14, delay: "240ms", dur: "0.75s" },
    { h: 14, delay: "60ms", dur: "0.55s" },
  ];
  return (
    <div className="flex items-end gap-[2.5px]" aria-hidden="true" style={{ height: 14 }}>
      {bars.map((bar, i) => (
        <span
          key={i}
          className={cn(
            "w-0.75 rounded-full bg-accent-soft origin-bottom",
            paused ? "" : "animate-eq-bar",
          )}
          style={{
            height: paused ? `${bar.h * 0.4}px` : `${bar.h}px`,
            animationDelay: paused ? undefined : bar.delay,
            animationDuration: paused ? undefined : bar.dur,
            opacity: paused ? 0.6 : 1,
          }}
        />
      ))}
    </div>
  );
}

export function SongCard({
  song,
  queue,
  eager = false,
}: {
  song: SongDTO;
  queue?: SongDTO[];
  eager?: boolean;
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
    <div className="group relative flex flex-col gap-2.5">
      {/* Art with hover and playing effects */}
      <div
        className={cn(
          "relative overflow-hidden rounded-card transition-all duration-300",
          isCurrent && "glow-accent",
        )}
      >
        <Link
          href={`/song/${song.id}`}
          className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft"
          aria-label={`${song.title} by ${song.artist}`}
        >
          <CoverArt
            src={song.coverUrl}
            alt=""
            seed={song.title}
            eager={eager}
            rounded=""
            className={cn(
              "aspect-square w-full transition-all duration-500",
              "group-hover:scale-[1.06] group-hover:brightness-[0.85]",
            )}
          />
        </Link>

        {/* Bottom gradient — appears on hover and when this track is active */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent",
            "opacity-0 transition-opacity duration-300",
            "group-hover:opacity-100",
            isCurrent && "opacity-50",
          )}
          aria-hidden="true"
        />

        {/* Equalizer bars — top-left corner when current */}
        {isCurrent && (
          <div className="absolute left-2.5 top-2.5 rounded-md bg-black/50 px-1.5 py-1 backdrop-blur-sm">
            <EqualizerBars paused={!isPlaying} />
          </div>
        )}

        {/* Play / pause button — white Spotify-style circle */}
        <button
          type="button"
          onClick={() => (isCurrent ? toggle() : playSong(song, queue))}
          aria-label={showPause ? `Pause ${song.title}` : `Play ${song.title}`}
          className={cn(
            "absolute bottom-2.5 right-2.5 grid size-11 place-items-center rounded-full",
            "bg-white text-bg shadow-xl shadow-black/40",
            "translate-y-1 scale-90 transition-all duration-200",
            "hover:scale-105 active:scale-95",
            isCurrent
              ? "opacity-100 translate-y-0 scale-100"
              : "reveal-on-hover",
            "group-hover:translate-y-0 group-hover:scale-100",
          )}
        >
          {showPause ? (
            <Pause className="size-4 fill-current" aria-hidden="true" />
          ) : (
            <Play className="size-4 translate-x-px fill-current" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Text below the art */}
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <Link
            href={`/song/${song.id}`}
            className={cn(
              "block truncate text-fluid-sm font-semibold leading-snug hover:underline",
              isCurrent ? "text-accent-soft" : "text-text",
            )}
          >
            {song.title}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted">{song.artist}</p>
          {song.genre && (
            <p className="mt-0.5 truncate text-[0.65rem] text-faint">{song.genre}</p>
          )}
          {failedMessage && <InlineError message={failedMessage} />}
        </div>
        <FavoriteButton song={song} size="sm" className="-mr-1.5 -mt-0.5 shrink-0" />
      </div>
    </div>
  );
}

export function SongGrid({
  songs,
  eagerCount = 6,
}: {
  songs: SongDTO[];
  eagerCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {songs.map((song, index) => (
        <SongCard
          key={song.id}
          song={song}
          queue={songs}
          eager={index < eagerCount}
        />
      ))}
    </div>
  );
}

/**
 * Horizontal scroll shelf for the home page. Scroll-snapped so a swipe on a
 * phone lands on a card rather than halfway between two.
 */
export function Shelf({
  title,
  subtitle,
  songs,
  action,
  accent,
}: {
  title: string;
  subtitle?: string;
  songs: SongDTO[];
  action?: React.ReactNode;
  /** Optional HSL hue (0–360) that tints the section heading dot. */
  accent?: number;
}) {
  if (songs.length === 0) return null;

  const id = `shelf-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <section aria-labelledby={id}>
      <div className="mb-3.5 flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Colored indicator dot beside the section title */}
          <span
            className="hidden size-2 shrink-0 rounded-full sm:block"
            aria-hidden="true"
            style={{
              background:
                accent != null
                  ? `hsl(${accent} 75% 58%)`
                  : "var(--color-accent)",
              boxShadow:
                accent != null
                  ? `0 0 8px hsl(${accent} 75% 58% / 0.6)`
                  : "0 0 8px var(--color-accent-soft)",
            }}
          />
          <div className="min-w-0">
            <h2 id={id} className="truncate text-fluid-lg font-bold">
              {title}
            </h2>
            {subtitle && (
              <p className="truncate text-xs text-muted">{subtitle}</p>
            )}
          </div>
        </div>
        {action && (
          <div className="shrink-0 text-fluid-sm font-medium text-muted hover:text-text">
            {action}
          </div>
        )}
      </div>

      <ul className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 lg:-mx-2 lg:px-2">
        {songs.map((song, index) => (
          <li key={song.id} className="w-38 shrink-0 snap-start sm:w-44 lg:w-48">
            <SongCard song={song} queue={songs} eager={index < 4} />
          </li>
        ))}
      </ul>
    </section>
  );
}
