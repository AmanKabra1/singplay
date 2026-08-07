"use client";

import { useEffect, useRef, useState } from "react";
import { Mic2, Pause, Play, Search, SkipBack, SkipForward, X } from "lucide-react";

import { CoverArt } from "@/components/ui/CoverArt";
import { useFetch } from "@/lib/hooks/useFetch";
import type { LyricsDTO, Paginated, SongDTO, SyncedLyrics } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { usePlayerStore } from "@/store/player";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findActiveLine(lines: SyncedLyrics["lines"], t: number): number {
  if (!lines.length) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (lines[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lines[lo].t <= t ? lo : -1;
}

// ---------------------------------------------------------------------------
// Search view
// ---------------------------------------------------------------------------

export function SingScreen() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<{ song: SongDTO; lyrics: LyricsDTO | null } | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);

  const playSong = usePlayerStore((s) => s.playSong);

  useEffect(() => {
    const t = setTimeout(() => setQuery(draft.trim()), 350);
    return () => clearTimeout(t);
  }, [draft]);

  const { data, loading } = useFetch<Paginated<SongDTO>>(
    query ? `/api/songs?q=${encodeURIComponent(query)}&limit=24` : `/api/songs?limit=24`,
  );

  async function openSong(song: SongDTO) {
    setLoadingLyrics(true);
    try {
      const resp = await fetch(`/api/songs/${song.id}/lyrics`);
      const lyr = resp.ok ? ((await resp.json()) as LyricsDTO) : null;
      setStage({ song, lyrics: lyr });
    } catch {
      setStage({ song, lyrics: null });
    } finally {
      setLoadingLyrics(false);
    }
    playSong(song, [song], "karaoke");
  }

  if (stage) {
    return <SingStage song={stage.song} lyrics={stage.lyrics} onClose={() => setStage(null)} />;
  }

  return (
    <div className="flex flex-col gap-8 pb-32">
      <header className="flex items-end gap-4">
        <div>
          <h1 className="text-fluid-2xl font-bold">Sing Along</h1>
          <p className="mt-1 text-fluid-sm text-muted">
            Pick a track, hit play, and sing the highlighted lyrics as they scroll.
          </p>
        </div>
        <Mic2 className="mb-1 ml-auto size-8 text-accent opacity-70" aria-hidden="true" />
      </header>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint"
          aria-hidden="true"
        />
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search songs to sing along to…"
          className="h-12 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-4 text-fluid-sm placeholder:text-faint focus:border-accent focus:outline-none"
        />
      </div>

      {loading && !data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      )}

      {data && data.items.length === 0 && (
        <p className="text-fluid-sm text-muted">No songs found. Try a different search.</p>
      )}

      {data && data.items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {data.items.map((song) => (
            <button
              key={song.id}
              onClick={() => openSong(song)}
              disabled={loadingLyrics}
              className="group flex flex-col gap-2 rounded-2xl border border-border bg-surface-2 p-3 text-left transition-all hover:border-accent/40 hover:bg-surface-3 active:scale-[0.97] disabled:opacity-50"
            >
              <CoverArt
                src={song.coverUrl}
                alt=""
                seed={song.title}
                className="aspect-square w-full rounded-xl"
              />
              <div className="min-w-0">
                <p className="truncate text-fluid-sm font-semibold">{song.title}</p>
                <p className="truncate text-xs text-muted">{song.artist}</p>
                {song.hasSyncedLyrics && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[0.65rem] font-semibold text-accent-soft">
                    <Mic2 className="size-2.5" aria-hidden="true" />
                    Lyrics
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theater / Stage view
// ---------------------------------------------------------------------------

function SingStage({
  song,
  lyrics,
  onClose,
}: {
  song: SongDTO;
  lyrics: LyricsDTO | null;
  onClose: () => void;
}) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const toggle = usePlayerStore((s) => s.toggle);
  const seek = usePlayerStore((s) => s.seek);
  const seekBy = usePlayerStore((s) => s.seekBy);

  const lines = lyrics?.synced?.lines ?? [];
  const activeIdx = findActiveLine(lines, currentTime);

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);

  // Keep the active line centered in the scroll window
  useEffect(() => {
    const el = activeRef.current;
    const container = scrollRef.current;
    if (!el || !container) return;
    const target = el.offsetTop + el.offsetHeight / 2 - container.clientHeight / 2;
    container.scrollTo({ top: target, behavior: "smooth" });
  }, [activeIdx]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black">
      {/* Blurred cover as background */}
      {song.coverUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center"
          style={{
            backgroundImage: `url(${song.coverUrl})`,
            filter: "blur(48px) brightness(0.22) saturate(1.5)",
          }}
        />
      )}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/55" />

      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Exit sing mode"
        className="absolute right-4 top-4 z-20 flex size-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
      >
        <X className="size-5" />
      </button>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center overflow-hidden">
        {/* Song header */}
        <div className="mt-6 flex shrink-0 flex-col items-center px-4 text-center">
          {song.coverUrl && (
            <img
              src={song.coverUrl}
              alt=""
              className="mb-3 size-14 rounded-xl object-cover shadow-2xl ring-1 ring-white/10"
            />
          )}
          <p className="text-sm text-white/50">{song.artist}</p>
          <h2 className="text-fluid-lg font-bold text-white">{song.title}</h2>
        </div>

        {/* Lyrics */}
        <div
          ref={scrollRef}
          className="mt-4 flex-1 w-full max-w-2xl overflow-y-auto px-4"
          style={{
            scrollbarWidth: "none",
            maskImage:
              "linear-gradient(to bottom, transparent, black 14%, black 86%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent, black 14%, black 86%, transparent)",
          }}
        >
          {lines.length === 0 && (
            <p className="mt-24 text-center text-sm text-white/30">
              {lyrics ? "No synced lyrics for this track." : "No lyrics available."}
            </p>
          )}
          <ul className="space-y-6 py-32 text-center">
            {lines.map((line, i) => {
              const diff = i - activeIdx;
              const isActive = diff === 0;
              const opacity =
                activeIdx < 0
                  ? 0.5
                  : isActive
                    ? 1
                    : Math.max(0.08, 0.55 - Math.abs(diff) * 0.12);

              return (
                <li
                  key={i}
                  ref={isActive ? activeRef : undefined}
                  onClick={() => seek(line.t)}
                  className="cursor-pointer select-none leading-snug transition-all duration-400"
                  style={{
                    opacity,
                    fontSize: isActive ? "1.85rem" : Math.abs(diff) === 1 ? "1.25rem" : "1rem",
                    fontWeight: isActive ? 800 : Math.abs(diff) === 1 ? 500 : 400,
                    color: "white",
                    textShadow: isActive
                      ? "0 0 28px rgba(167,139,250,0.85), 0 0 56px rgba(167,139,250,0.35)"
                      : "none",
                    transform: `scale(${isActive ? 1.05 : 1})`,
                  }}
                >
                  {line.text || "♪"}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Transport */}
        <div className="w-full max-w-lg shrink-0 px-6 pb-10 pt-2">
          {/* Seek bar */}
          <div className="relative mb-2 h-1.5 rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-accent transition-none"
              style={{ width: `${progress}%` }}
            />
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(duration))}
              step={0.5}
              value={Math.floor(currentTime)}
              onChange={(e) => seek(Number(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Seek"
            />
          </div>
          <div className="mb-5 flex justify-between text-xs text-white/35">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>

          {/* Play / skip buttons */}
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => seekBy(-10)}
              aria-label="Back 10 seconds"
              className="flex size-10 items-center justify-center rounded-full text-white/55 transition-colors hover:text-white"
            >
              <SkipBack className="size-5" />
            </button>
            <button
              onClick={toggle}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="flex size-16 items-center justify-center rounded-full bg-white text-black shadow-2xl shadow-white/20 transition-transform hover:scale-105 active:scale-95"
            >
              {isPlaying ? (
                <Pause className="size-6" fill="currentColor" />
              ) : (
                <Play className="size-6 translate-x-0.5" fill="currentColor" />
              )}
            </button>
            <button
              onClick={() => seekBy(10)}
              aria-label="Forward 10 seconds"
              className="flex size-10 items-center justify-center rounded-full text-white/55 transition-colors hover:text-white"
            >
              <SkipForward className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
