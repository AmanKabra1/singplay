"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PlayAllButton } from "@/components/song/PlayAllButton";
import { SongGrid } from "@/components/song/SongCard";
import { SongList } from "@/components/song/SongRow";
import { Button } from "@/components/ui/Button";
import { SongListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useFetch } from "@/lib/hooks/useFetch";
import { DECADES, GENRES, MOODS } from "@/lib/constants";
import type { Paginated, SongDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

type Results = Paginated<SongDTO> & { query?: string };

const SORTS = [
  { value: "new", label: "Newest" },
  { value: "popular", label: "Most played" },
  { value: "title", label: "Title A–Z" },
  { value: "artist", label: "Artist A–Z" },
] as const;

const SCOPES = [
  { value: "all", label: "Everything" },
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
  { value: "lyrics", label: "Lyrics" },
] as const;

const PAGE_SIZE = 30;

/**
 * Search and browse (brief §6.2).
 *
 * All state lives in the URL, so a filtered view is shareable and the back
 * button behaves. Typing is debounced into the URL rather than fetched directly,
 * which keeps a single source of truth for what's on screen.
 */
export function SearchScreen() {
  const router = useRouter();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const genre = params.get("genre") ?? "";
  const mood = params.get("mood") ?? "";
  const decade = params.get("decade") ?? "";
  const artist = params.get("artist") ?? "";
  const sort = params.get("sort") ?? (q ? "popular" : "new");
  const scope = params.get("scope") ?? "all";

  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * The search box holds what the user typed, tagged with the `?q=` it was typed
   * against. When navigation changes `?q=` (a genre chip, the back button), the
   * tag stops matching and the box falls back to the URL — so the two stay in
   * step without an effect copying one into the other.
   */
  const [typed, setTyped] = useState<{ against: string; value: string } | null>(null);
  const draft = typed?.against === q ? typed.value : q;
  const setDraft = (value: string) => setTyped({ against: q, value });

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      router.replace(next.toString() ? `/search?${next}` : "/search", { scroll: false });
    },
    [params, router],
  );

  // Debounce keystrokes into the URL — one request per pause, not per letter.
  useEffect(() => {
    if (draft === q) return;
    const timer = setTimeout(() => setParam({ q: draft || null }), 300);
    return () => clearTimeout(timer);
  }, [draft, q, setParam]);

  const filterKey = `${q}|${genre}|${mood}|${decade}|${artist}|${sort}|${scope}`;

  /**
   * Paging is tagged with the filters it belongs to, so any change to the query
   * resets it to page one by construction — no effect, and no window in which a
   * stale page is briefly shown against fresh filters.
   *
   * `loaded` holds the pages already scrolled past. It grows in the "Load more"
   * handler, where the current page's items are already in hand, which is why
   * accumulating them needs no effect either.
   */
  const [paging, setPaging] = useState<{
    key: string;
    page: number;
    loaded: SongDTO[];
    /** Remembered so the result count and "Load more" survive the next request. */
    total: number;
  }>({ key: filterKey, page: 0, loaded: [], total: 0 });

  const onCurrentFilters = paging.key === filterKey;
  const page = onCurrentFilters ? paging.page : 0;
  const loaded = onCurrentFilters ? paging.loaded : [];
  const knownTotal = onCurrentFilters ? paging.total : 0;

  const url = useMemo(() => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (genre) search.set("genre", genre);
    if (mood) search.set("mood", mood);
    if (decade) search.set("decade", decade);
    if (artist) search.set("artist", artist);
    search.set("sort", sort);
    if (q) search.set("scope", scope);
    search.set("limit", String(PAGE_SIZE));
    search.set("offset", String(page * PAGE_SIZE));

    // `/api/search` also records the query for the admin analytics; plain
    // browsing with no search term shouldn't pollute that.
    return q ? `/api/search?${search}` : `/api/songs?${search}`;
  }, [q, genre, mood, decade, artist, sort, scope, page]);

  const { data, loading, error, refetch } = useFetch<Results>(url);

  // Pages already scrolled past, plus whatever the current request returned.
  const songs = [...loaded, ...(data?.items ?? [])];
  // Falling back to the remembered total keeps the count steady — and keeps the
  // "Load more" button on screen — while the next page is in flight.
  const total = data?.total ?? knownTotal;
  const hasMore = songs.length < total;
  const activeFilters = [genre, mood, decade, artist].filter(Boolean).length;
  const isFirstLoad = loading && songs.length === 0;

  function loadMore() {
    if (!data) return;
    setPaging({
      key: filterKey,
      page: page + 1,
      loaded: [...loaded, ...data.items],
      total: data.total,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h1 className="text-fluid-xl font-bold">Search</h1>

        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-[1.15rem] -translate-y-1/2 text-faint"
              aria-hidden="true"
            />
            <label htmlFor="catalog-search" className="sr-only">
              Search songs, artists or lyrics
            </label>
            <input
              id="catalog-search"
              ref={inputRef}
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Songs, artists, or a line of lyrics…"
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-border bg-surface-2 pl-11 pr-10 text-fluid-base text-text placeholder:text-faint focus:border-accent focus:outline-none"
            />
            {draft && (
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  setParam({ q: null });
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-faint transition-colors hover:text-text"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <Button
            variant={activeFilters > 0 ? "primary" : "secondary"}
            size="lg"
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
            className="shrink-0"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilters > 0 && (
              <span className="grid size-5 place-items-center rounded-full bg-white/25 text-[0.7rem] font-bold">
                {activeFilters}
              </span>
            )}
          </Button>
        </div>

        {q && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-faint">Search in:</span>
            {SCOPES.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                active={scope === option.value}
                onClick={() => setParam({ scope: option.value })}
              />
            ))}
          </div>
        )}

        {showFilters && (
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
            <FilterGroup
              title="Genre"
              values={GENRES}
              active={genre}
              onSelect={(value) => setParam({ genre: value })}
            />
            <FilterGroup
              title="Mood"
              values={MOODS}
              active={mood}
              onSelect={(value) => setParam({ mood: value })}
            />
            <FilterGroup
              title="Decade"
              values={["0", ...DECADES.map(String)]}
              labels={{ "0": "Pre-1970s" }}
              suffix="s"
              active={decade}
              onSelect={(value) => setParam({ decade: value })}
            />
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-faint">
                Sort
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {SORTS.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    active={sort === option.value}
                    onClick={() => setParam({ sort: option.value })}
                  />
                ))}
              </div>
            </div>

            {(activeFilters > 0 || artist) && (
              <button
                type="button"
                onClick={() =>
                  setParam({ genre: null, mood: null, decade: null, artist: null })
                }
                className="self-start text-fluid-sm font-medium text-accent-soft hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {artist && (
          <p className="text-fluid-sm text-muted">
            Showing tracks by <span className="font-semibold text-text">{artist}</span>
          </p>
        )}
      </div>

      {isFirstLoad && <SongListSkeleton count={10} />}

      {error && songs.length === 0 && (
        <ErrorState
          title="Couldn't run that search"
          description={error.message}
          offline={error.isOffline}
          onRetry={refetch}
        />
      )}

      {!isFirstLoad && !error && songs.length === 0 && (
        <EmptyState
          title={q ? `No results for “${q}”` : "Nothing matches those filters"}
          description={
            q
              ? "Try a shorter phrase, check the spelling, or switch “Search in” to Lyrics if you're quoting a line."
              : "Loosen a filter or two and there'll be more to hear."
          }
          action={
            (q || activeFilters > 0) && (
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft("");
                  setParam({
                    q: null,
                    genre: null,
                    mood: null,
                    decade: null,
                    artist: null,
                  });
                }}
              >
                Reset search
              </Button>
            )
          }
        />
      )}

      {songs.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-fluid-sm text-muted" aria-live="polite">
              {total} track{total === 1 ? "" : "s"}
              {q && ` matching “${q}”`}
            </p>
            <PlayAllButton songs={songs} />
          </div>

          {/* Query results read better as a list; unfiltered browsing as a grid. */}
          {q ? <SongList songs={songs} /> : <SongGrid songs={songs} />}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="secondary"
                size="lg"
                loading={loading}
                disabled={loading || !data}
                onClick={loadMore}
              >
                Load more ({total - songs.length} left)
              </Button>
            </div>
          )}

          {error && (
            <ErrorState
              compact
              title="Couldn't load more"
              description={error.message}
              offline={error.isOffline}
              onRetry={refetch}
            />
          )}
        </>
      )}
    </div>
  );
}

function FilterGroup({
  title,
  values,
  labels,
  suffix = "",
  active,
  onSelect,
}: {
  title: string;
  values: readonly string[];
  labels?: Record<string, string>;
  suffix?: string;
  active: string;
  onSelect: (value: string | null) => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-faint">
        {title}
      </h2>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <FilterChip
            key={value}
            label={labels?.[value] ?? `${value}${suffix}`}
            active={active === value}
            // Tapping the active chip clears it — no separate "all" pill needed.
            onClick={() => onSelect(active === value ? null : value)}
          />
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-9 rounded-lg border px-3 text-fluid-sm transition-colors",
        active
          ? "border-accent bg-accent/15 font-medium text-accent-soft"
          : "border-border bg-surface-2 text-muted hover:border-border-strong hover:text-text",
      )}
    >
      {label}
    </button>
  );
}
