"use client";

import { ListPlus, Plus } from "lucide-react";
import { useState } from "react";

import { useIsAuthenticated } from "@/components/providers/SessionProvider";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { clearFetchCache, useFetch } from "@/lib/hooks/useFetch";
import type { PlaylistDTO, SongDTO } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { toast, useUiStore } from "@/store/ui";

/** "Add to playlist" — picker plus an inline "new playlist" escape hatch. */
export function AddToPlaylistButton({
  song,
  size = "sm",
}: {
  song: SongDTO;
  size?: "sm" | "icon";
}) {
  const isAuthenticated = useIsAuthenticated();
  const promptSignup = useUiStore((s) => s.promptSignup);
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        label={`Add ${song.title} to a playlist`}
        size={size === "icon" ? "icon" : "sm"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!isAuthenticated) {
            promptSignup("playlist");
            return;
          }
          setOpen(true);
        }}
      >
        <ListPlus className="size-[1.15rem]" aria-hidden="true" />
      </IconButton>

      {open && <PlaylistPicker song={song} onClose={() => setOpen(false)} />}
    </>
  );
}

function PlaylistPicker({ song, onClose }: { song: SongDTO; onClose: () => void }) {
  const { data, loading, error, refetch } = useFetch<{ items: PlaylistDTO[] }>(
    "/api/playlists",
  );
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function addTo(playlist: PlaylistDTO) {
    setBusyId(playlist.id);
    try {
      const result = await apiFetch<{ added: boolean; message: string }>(
        `/api/playlists/${playlist.id}/items`,
        { method: "POST", body: { songId: song.id } },
      );
      clearFetchCache("/api/playlists");
      if (result.added) toast.success("Added", `“${song.title}” → ${playlist.name}`);
      else toast.info("Already there", result.message);
      onClose();
    } catch (cause) {
      toast.error("Couldn't add that", errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function createAndAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setFormError("Give the playlist a name.");
      return;
    }

    setCreating(true);
    setFormError(null);
    try {
      await apiFetch("/api/playlists", {
        method: "POST",
        body: { name: name.trim(), songIds: [song.id] },
      });
      clearFetchCache("/api/playlists");
      toast.success("Playlist created", `“${song.title}” is the first track.`);
      onClose();
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add to playlist"
      description={`${song.title} — ${song.artist}`}
    >
      <form onSubmit={createAndAdd} className="mb-5 flex flex-col gap-3">
        <Field label="New playlist" error={formError ?? undefined}>
          {(props) => (
            <div className="flex gap-2">
              <TextInput
                {...props}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Late night practice"
                maxLength={120}
              />
              <Button type="submit" loading={creating} className="shrink-0">
                <Plus className="size-4" aria-hidden="true" />
                Create
              </Button>
            </div>
          )}
        </Field>
      </form>

      {loading && <LoadingState label="Loading your playlists" />}

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
          icon={<ListPlus className="size-8" />}
          title="No playlists yet"
          description="Create your first one above — this track will be added to it."
        />
      )}

      {data && data.items.length > 0 && (
        <ul className="-mx-2 flex flex-col">
          {data.items.map((playlist) => (
            <li key={playlist.id}>
              <button
                type="button"
                onClick={() => addTo(playlist)}
                disabled={busyId !== null}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-3 text-accent-soft">
                  <ListPlus className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-fluid-sm font-medium">
                    {playlist.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {playlist.songCount} track{playlist.songCount === 1 ? "" : "s"}
                    {playlist.durationSec > 0 &&
                      ` · ${formatDuration(playlist.durationSec)}`}
                  </span>
                </span>
                {busyId === playlist.id && (
                  <span className="text-xs text-faint">Adding…</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
