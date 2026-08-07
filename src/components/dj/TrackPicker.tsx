"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CoverArt } from "@/components/ui/CoverArt";
import { Modal } from "@/components/ui/Modal";
import { SongListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useFetch } from "@/lib/hooks/useFetch";
import type { Paginated, SongDTO } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import type { DeckId } from "@/store/dj";

/** Track browser for loading a deck. */
export function TrackPicker({
  deck,
  onPick,
  onClose,
}: {
  deck: DeckId;
  onPick: (song: SongDTO) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(draft.trim()), 300);
    return () => clearTimeout(timer);
  }, [draft]);

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: "40", sort: "popular" });
    if (query) params.set("q", query);
    return `/api/songs?${params}`;
  }, [query]);

  const { data, loading, error, refetch } = useFetch<Paginated<SongDTO>>(url);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Load deck ${deck.toUpperCase()}`}
      description="Pick a track from the catalog."
    >
      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint"
          aria-hidden="true"
        />
        <label htmlFor={`deck-search-${deck}`} className="sr-only">
          Search tracks
        </label>
        <input
          id={`deck-search-${deck}`}
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search by title or artist…"
          className="h-11 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 text-fluid-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
        />
      </div>

      {loading && !data && <SongListSkeleton count={6} />}

      {error && (
        <ErrorState
          compact
          description={error.message}
          offline={error.isOffline}
          onRetry={refetch}
        />
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          title="No tracks found"
          description="Try a different search, or clear the box to browse the whole catalog."
        />
      )}

      {data && data.items.length > 0 && (
        <ul className="-mx-2 flex flex-col">
          {data.items.map((song) => (
            <li key={song.id}>
              <button
                type="button"
                onClick={() => onPick(song)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2"
              >
                <CoverArt
                  src={song.coverUrl}
                  alt=""
                  seed={song.title}
                  className="size-10 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-fluid-sm font-medium">
                    {song.title}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {song.artist}
                    {song.bpm ? ` · ${song.bpm} BPM` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-faint">
                  {formatDuration(song.durationSec)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
