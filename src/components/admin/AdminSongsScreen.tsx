"use client";

import { CloudDownload, Eye, Globe, Library, Music4, Pencil, Plus, Radio, RefreshCw, Search, Sparkles, Trash2, TrendingUp, Waves } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { JamendoImport } from "@/components/admin/JamendoImport";
import { Button, ButtonLink, IconButton } from "@/components/ui/Button";
import { CoverArt } from "@/components/ui/CoverArt";
import { Modal } from "@/components/ui/Modal";
import { SongListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { clearFetchCache, useFetch } from "@/lib/hooks/useFetch";
import type { Paginated, SongDTO } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { toast } from "@/store/ui";

const PAGE_SIZE = 25;

/** Song management table (brief §3.7). */
export function AdminSongsScreen() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingItunes, setSyncingItunes] = useState(false);
  const [syncingTrending, setSyncingTrending] = useState(false);
  const [syncingArchive, setSyncingArchive] = useState(false);
  const [syncingLyrics, setSyncingLyrics] = useState(false);
  const [syncingAudius, setSyncingAudius] = useState(false);
  const [syncingOpenverse, setSyncingOpenverse] = useState(false);
  const [syncingCcmixter, setSyncingCcmixter] = useState(false);
  const [syncingFma, setSyncingFma] = useState(false);
  const [deleting, setDeleting] = useState<SongDTO | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(draft.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [draft]);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (query) params.set("q", query);
    return `/api/admin/songs?${params}`;
  }, [query, page]);

  const { data, loading, error, refetch } = useFetch<Paginated<SongDTO>>(url);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  async function bulkSyncTrending() {
    setSyncingTrending(true);
    try {
      const result = await apiFetch<{
        total: number;
        imported: number;
        skipped: number;
        failed: number;
      }>("/api/admin/itunes/trending", { method: "POST" });

      clearFetchCache("/api/admin/songs");
      clearFetchCache("/api/songs");
      refetch();
      toast.success(
        `Imported ${result.imported} chart track${result.imported === 1 ? "" : "s"}`,
        result.skipped > 0 ? `${result.skipped} already in catalog` : undefined,
      );
    } catch (cause) {
      toast.error("Trending sync failed", errorMessage(cause));
    } finally {
      setSyncingTrending(false);
    }
  }

  async function bulkSyncItunes() {
    setSyncingItunes(true);
    try {
      const result = await apiFetch<{
        total: number;
        imported: number;
        skipped: number;
        failed: number;
      }>("/api/admin/itunes/bulk-sync", { method: "POST" });

      clearFetchCache("/api/admin/songs");
      clearFetchCache("/api/songs");
      refetch();
      toast.success(
        `Imported ${result.imported} Indian & International track${result.imported === 1 ? "" : "s"}`,
        result.skipped > 0 ? `${result.skipped} already in catalog` : undefined,
      );
    } catch (cause) {
      toast.error("iTunes sync failed", errorMessage(cause));
    } finally {
      setSyncingItunes(false);
    }
  }

  async function bulkSync() {
    setSyncing(true);
    try {
      const result = await apiFetch<{
        total: number;
        imported: number;
        skipped: number;
        failed: number;
        error?: string;
      }>("/api/admin/jamendo/bulk-sync", { method: "POST" });

      if (result.error) {
        toast.error("Sync not available", result.error);
        return;
      }

      clearFetchCache("/api/admin/songs");
      clearFetchCache("/api/songs");
      refetch();
      toast.success(
        `Synced ${result.imported} new track${result.imported === 1 ? "" : "s"}`,
        result.skipped > 0 ? `${result.skipped} already in catalog, ${result.failed} failed` : undefined,
      );
    } catch (cause) {
      toast.error("Bulk sync failed", errorMessage(cause));
    } finally {
      setSyncing(false);
    }
  }

  async function bulkSyncArchive() {
    setSyncingArchive(true);
    try {
      const result = await apiFetch<{
        total: number;
        imported: number;
        skipped: number;
        failed: number;
      }>("/api/admin/archive/import", { method: "POST" });

      clearFetchCache("/api/admin/songs");
      clearFetchCache("/api/songs");
      refetch();
      toast.success(
        `Imported ${result.imported} full-length track${result.imported === 1 ? "" : "s"}`,
        `Bhajans, classical, old Bollywood · ${result.skipped} already in catalog`,
      );
    } catch (cause) {
      toast.error("Archive import failed", errorMessage(cause));
    } finally {
      setSyncingArchive(false);
    }
  }

  async function autoSyncLyrics() {
    setSyncingLyrics(true);
    try {
      const result = await apiFetch<{
        processed: number;
        synced: number;
        plainOnly: number;
        notFound: number;
        message?: string;
      }>("/api/admin/lyrics/auto-sync", { method: "POST" });

      refetch();
      toast.success(
        `Lyrics: ${result.synced} synced, ${result.plainOnly} plain-only`,
        result.message ?? `${result.notFound} not found on LRCLIB`,
      );
    } catch (cause) {
      toast.error("Lyrics sync failed", errorMessage(cause));
    } finally {
      setSyncingLyrics(false);
    }
  }

  async function bulkSyncAudius() {
    setSyncingAudius(true);
    try {
      const result = await apiFetch<{ total: number; imported: number; skipped: number; failed: number }>(
        "/api/admin/audius/import", { method: "POST" },
      );
      clearFetchCache("/api/admin/songs");
      clearFetchCache("/api/songs");
      refetch();
      toast.success(
        `Audius: ${result.imported} full-length track${result.imported === 1 ? "" : "s"} imported`,
        `${result.skipped} already in catalog`,
      );
    } catch (cause) {
      toast.error("Audius import failed", errorMessage(cause));
    } finally {
      setSyncingAudius(false);
    }
  }

  async function bulkSyncOpenverse() {
    setSyncingOpenverse(true);
    try {
      const result = await apiFetch<{ total: number; imported: number; skipped: number; failed: number }>(
        "/api/admin/openverse/import", { method: "POST" },
      );
      clearFetchCache("/api/admin/songs");
      clearFetchCache("/api/songs");
      refetch();
      toast.success(
        `Openverse: ${result.imported} CC full-length track${result.imported === 1 ? "" : "s"} imported`,
        `${result.skipped} already in catalog`,
      );
    } catch (cause) {
      toast.error("Openverse import failed", errorMessage(cause));
    } finally {
      setSyncingOpenverse(false);
    }
  }

  async function bulkSyncCcmixter() {
    setSyncingCcmixter(true);
    try {
      const result = await apiFetch<{ total: number; imported: number; skipped: number; failed: number }>(
        "/api/admin/ccmixter/import", { method: "POST" },
      );
      clearFetchCache("/api/admin/songs");
      clearFetchCache("/api/songs");
      refetch();
      toast.success(
        `ccMixter: ${result.imported} indie/electronic track${result.imported === 1 ? "" : "s"} imported`,
        `${result.skipped} already in catalog`,
      );
    } catch (cause) {
      toast.error("ccMixter import failed", errorMessage(cause));
    } finally {
      setSyncingCcmixter(false);
    }
  }

  async function bulkSyncFma() {
    setSyncingFma(true);
    try {
      const result = await apiFetch<{ total: number; imported: number; skipped: number; failed: number }>(
        "/api/admin/fma/import", { method: "POST" },
      );
      clearFetchCache("/api/admin/songs");
      clearFetchCache("/api/songs");
      refetch();
      toast.success(
        `Free Music Archive: ${result.imported} CC track${result.imported === 1 ? "" : "s"} imported`,
        `${result.skipped} already in catalog`,
      );
    } catch (cause) {
      toast.error("FMA import failed", errorMessage(cause));
    } finally {
      setSyncingFma(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiFetch(`/api/admin/songs/${deleting.id}`, { method: "DELETE" });
      clearFetchCache("/api/admin/songs");
      clearFetchCache("/api/songs");
      toast.success("Track deleted", deleting.title);
      setDeleting(null);
      refetch();
    } catch (cause) {
      toast.error("Couldn't delete that", errorMessage(cause));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-fluid-xl font-bold">Songs</h1>
          <p className="text-fluid-sm text-muted">
            {data ? `${data.total} track${data.total === 1 ? "" : "s"} in the catalog` : "Manage the catalog"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="lg"
            onClick={bulkSyncTrending}
            disabled={syncingTrending}
            title="30-sec previews · Today's top chart songs from US, India, UK, Korea, Brazil and 7 more countries"
          >
            <TrendingUp className={`size-4 ${syncingTrending ? "animate-bounce" : ""}`} aria-hidden="true" />
            {syncingTrending ? "Fetching Charts…" : "Trending Charts ★"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={bulkSyncItunes}
            disabled={syncingItunes}
            title="30-sec previews · Bollywood, Hollywood, Punjabi, Tamil and more from iTunes"
          >
            <Globe className={`size-4 ${syncingItunes ? "animate-spin" : ""}`} aria-hidden="true" />
            {syncingItunes ? "Importing…" : "Indian & International ★"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={bulkSyncArchive}
            disabled={syncingArchive}
            title="FULL songs · Bhajans, kirtan, ghazals, Indian classical, old Bollywood legends from Internet Archive"
          >
            <Library className={`size-4 ${syncingArchive ? "animate-spin" : ""}`} aria-hidden="true" />
            {syncingArchive ? "Importing…" : "Bhajans & Classics 🎵"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={autoSyncLyrics}
            disabled={syncingLyrics}
            title="Auto-fetch synced LRC lyrics from LRCLIB for all songs without karaoke lyrics"
          >
            <Sparkles className={`size-4 ${syncingLyrics ? "animate-spin" : ""}`} aria-hidden="true" />
            {syncingLyrics ? "Syncing Lyrics…" : "Auto-sync Lyrics"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={bulkSyncAudius}
            disabled={syncingAudius}
            title="FULL songs · Hindi, Bollywood covers, K-pop, pop from Audius decentralised platform — free, no key"
          >
            <Radio className={`size-4 ${syncingAudius ? "animate-spin" : ""}`} aria-hidden="true" />
            {syncingAudius ? "Importing…" : "Audius Full Songs"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={bulkSyncOpenverse}
            disabled={syncingOpenverse}
            title="FULL songs · CC-licensed music from Openverse (aggregates Jamendo, Wikimedia + more)"
          >
            <Waves className={`size-4 ${syncingOpenverse ? "animate-spin" : ""}`} aria-hidden="true" />
            {syncingOpenverse ? "Importing…" : "Openverse CC Music"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={bulkSync}
            disabled={syncing}
            title="Fetch ~200 tracks from Jamendo across all genres in one click"
          >
            <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} aria-hidden="true" />
            {syncing ? "Syncing…" : "Bulk Sync Jamendo"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={bulkSyncCcmixter}
            disabled={syncingCcmixter}
            title="FULL songs · ccMixter remixes & originals — indie, electronic, hip-hop, folk"
          >
            <Music4 className={`size-4 ${syncingCcmixter ? "animate-spin" : ""}`} aria-hidden="true" />
            {syncingCcmixter ? "Importing…" : "ccMixter Indie 🎧"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={bulkSyncFma}
            disabled={syncingFma}
            title="FULL songs · Free Music Archive — ~100k indie, folk, electronic, jazz tracks"
          >
            <Music4 className={`size-4 ${syncingFma ? "animate-spin" : ""}`} aria-hidden="true" />
            {syncingFma ? "Importing…" : "Free Music Archive 🎵"}
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setImporting(true)}>
            <CloudDownload className="size-4" aria-hidden="true" />
            Import from Jamendo
          </Button>
          <ButtonLink href="/admin/songs/new" size="lg">
            <Plus className="size-4" aria-hidden="true" />
            Add a track
          </ButtonLink>
        </div>
      </header>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint"
          aria-hidden="true"
        />
        <label htmlFor="admin-song-search" className="sr-only">
          Search the catalog
        </label>
        <input
          id="admin-song-search"
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search by title, artist or album…"
          className="h-11 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 text-fluid-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
        />
      </div>

      {loading && !data && <SongListSkeleton count={10} />}

      {error && (
        <ErrorState
          description={error.message}
          offline={error.isOffline}
          onRetry={refetch}
        />
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          icon={<Music4 className="size-8" />}
          title={query ? "No tracks match that search" : "The catalog is empty"}
          description={
            query
              ? "Try a different term, or clear the search to see everything."
              : "Add a track by hand, or import a batch from the Creative Commons catalog."
          }
          action={
            !query && (
              <Button onClick={() => setImporting(true)}>Import from Jamendo</Button>
            )
          }
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full">
              <caption className="sr-only">
                Catalog tracks with lyric sync status and publication state
              </caption>
              <thead className="bg-surface-2">
                <tr className="text-left text-xs uppercase tracking-widest text-faint">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Track
                  </th>
                  <th scope="col" className="hidden px-4 py-3 font-semibold lg:table-cell">
                    Genre
                  </th>
                  <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">
                    Lyrics
                  </th>
                  <th scope="col" className="hidden px-4 py-3 font-semibold md:table-cell">
                    Plays
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((song) => (
                  <tr key={song.id} className="align-middle hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <CoverArt
                          src={song.coverUrl}
                          alt=""
                          seed={song.title}
                          className="size-10 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-fluid-sm font-medium">
                            <span className="truncate">{song.title}</span>
                            {/* Drafts appear only in this table, so they need a
                                marker — otherwise there's no way to tell why a
                                track isn't showing up for listeners. */}
                            {!song.isPublished && (
                              <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-warning">
                                Draft
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {song.artist}
                            {song.durationSec > 0 &&
                              ` · ${formatDuration(song.durationSec)}`}
                            {song.source === "jamendo" && " · Jamendo"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-fluid-sm text-muted lg:table-cell">
                      {song.genre ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {song.hasSyncedLyrics ? (
                        <span className="inline-flex items-center rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
                          Synced
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-surface-3 px-2.5 py-0.5 text-xs text-muted">
                          Not synced
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-fluid-sm tabular-nums text-muted md:table-cell">
                      {song.playCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/song/${song.id}`}
                          title="View as a listener"
                          className="tap grid w-11 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-3 hover:text-text"
                        >
                          <Eye className="size-4" aria-hidden="true" />
                          <span className="sr-only">View {song.title}</span>
                        </Link>
                        <Link
                          href={`/admin/songs/${song.id}`}
                          title="Edit"
                          className="tap grid w-11 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-3 hover:text-text"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                          <span className="sr-only">Edit {song.title}</span>
                        </Link>
                        <IconButton
                          label={`Delete ${song.title}`}
                          size="sm"
                          onClick={() => setDeleting(song)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                disabled={page === 0 || loading}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                Previous
              </Button>
              <p className="text-fluid-sm text-muted" aria-live="polite">
                Page {page + 1} of {totalPages}
              </p>
              <Button
                variant="secondary"
                disabled={page + 1 >= totalPages || loading}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {importing && (
        <JamendoImport
          onClose={() => setImporting(false)}
          onImported={() => {
            clearFetchCache("/api/admin/songs");
            clearFetchCache("/api/songs");
            refetch();
          }}
        />
      )}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this track?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete track
            </Button>
          </>
        }
      >
        <p className="text-fluid-sm leading-relaxed text-muted">
          “{deleting?.title}” will be removed from the catalog, along with its
          lyrics, and taken out of every playlist, favourites list and listening
          history it appears in. This can&apos;t be undone.
        </p>
      </Modal>
    </div>
  );
}
