"use client";

import { Check, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { CoverArt } from "@/components/ui/CoverArt";
import { Modal } from "@/components/ui/Modal";
import { SongListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { useFetch } from "@/lib/hooks/useFetch";
import { formatDuration } from "@/lib/utils";
import { toast } from "@/store/ui";

type JamendoResult = {
  externalId: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  durationSec: number;
  coverUrl: string | null;
  licenseNote: string;
  imported: boolean;
};

type Response = { configured: boolean; items: JamendoResult[]; message?: string };

/**
 * Bulk import from the Creative Commons catalog (brief §0, Option A).
 *
 * Tracks already in our library are shown but not selectable, so a second pass
 * over the same search doesn't produce duplicates.
 */
export function JamendoImport({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(draft.trim()), 400);
    return () => clearTimeout(timer);
  }, [draft]);

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: "30" });
    if (query) params.set("q", query);
    return `/api/admin/jamendo?${params}`;
  }, [query]);

  const { data, loading, error, refetch } = useFetch<Response>(url, { cached: false });

  function toggle(externalId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(externalId)) next.delete(externalId);
      else next.add(externalId);
      return next;
    });
  }

  async function importSelected() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const result = await apiFetch<{
        imported: number;
        skipped: number;
        failed: number;
      }>("/api/admin/jamendo", {
        method: "POST",
        body: { externalIds: [...selected], publish: true },
      });

      const parts = [`${result.imported} imported`];
      if (result.skipped > 0) parts.push(`${result.skipped} already present`);
      if (result.failed > 0) parts.push(`${result.failed} failed`);

      // A partial success is still reported honestly rather than as a plain win.
      if (result.failed > 0) toast.error("Import finished with problems", parts.join(" · "));
      else toast.success("Import complete", parts.join(" · "));

      setSelected(new Set());
      onImported();
      refetch();
      if (result.failed === 0) onClose();
    } catch (cause) {
      toast.error("Import failed", errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const selectable = data?.items.filter((item) => !item.imported) ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Import from Jamendo"
      description="Creative Commons tracks, free and legal to stream. Licence text is stored with each import."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            loading={busy}
            disabled={selected.size === 0}
            onClick={importSelected}
          >
            Import {selected.size > 0 ? `${selected.size} track${selected.size === 1 ? "" : "s"}` : "selected"}
          </Button>
        </>
      }
    >
      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint"
          aria-hidden="true"
        />
        <label htmlFor="jamendo-search" className="sr-only">
          Search the Jamendo catalog
        </label>
        <input
          id="jamendo-search"
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search Jamendo, or leave blank for what's popular…"
          className="h-11 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 text-fluid-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
        />
      </div>

      {loading && <SongListSkeleton count={6} />}

      {error && (
        <ErrorState
          compact
          title="Couldn't reach Jamendo"
          description={error.message}
          offline={error.isOffline}
          onRetry={refetch}
        />
      )}

      {data && !data.configured && (
        <EmptyState
          title="Jamendo isn't connected"
          description={data.message}
        />
      )}

      {data?.configured && data.items.length === 0 && (
        <EmptyState
          title="No tracks found"
          description="Try a different search term, or clear the box to browse what's popular."
        />
      )}

      {data?.configured && data.items.length > 0 && (
        <>
          {selectable.length > 0 && (
            <div className="mb-2 flex items-center justify-between gap-2 text-fluid-sm">
              <span className="text-muted">
                {selected.size} of {selectable.length} selected
              </span>
              <button
                type="button"
                onClick={() =>
                  setSelected(
                    selected.size === selectable.length
                      ? new Set()
                      : new Set(selectable.map((item) => item.externalId)),
                  )
                }
                className="font-medium text-accent-soft hover:underline"
              >
                {selected.size === selectable.length ? "Clear all" : "Select all"}
              </button>
            </div>
          )}

          <ul className="flex flex-col divide-y divide-border/60">
            {data.items.map((track) => {
              const checked = selected.has(track.externalId);
              return (
                <li key={track.externalId}>
                  <label
                    className={
                      track.imported
                        ? "flex cursor-default items-center gap-3 px-1 py-2.5 opacity-55"
                        : "flex cursor-pointer items-center gap-3 rounded-lg px-1 py-2.5 hover:bg-surface-2"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={track.imported}
                      onChange={() => toggle(track.externalId)}
                      className="size-4 shrink-0 accent-accent"
                    />
                    <CoverArt
                      src={track.coverUrl}
                      alt=""
                      seed={track.title}
                      className="size-10 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-fluid-sm font-medium">
                        {track.title}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {track.artist}
                        {track.genre ? ` · ${track.genre}` : ""}
                      </span>
                      <span className="block truncate text-[0.7rem] text-faint">
                        {track.licenseNote}
                      </span>
                    </span>
                    {track.imported ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-success">
                        <Check className="size-3.5" aria-hidden="true" />
                        In catalog
                      </span>
                    ) : (
                      <span className="shrink-0 font-mono text-xs tabular-nums text-faint">
                        {formatDuration(track.durationSec)}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-muted">
            Imports arrive published and without lyrics. Add timed LRC lyrics from
            each track&apos;s edit page to unlock sing-along mode for it.
          </p>
        </>
      )}
    </Modal>
  );
}
