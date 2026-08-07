"use client";

import { ArrowDown, ArrowUp, ListMusic, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PlayAllButton } from "@/components/song/PlayAllButton";
import { SongRow } from "@/components/song/SongRow";
import { Button, ButtonLink, IconButton } from "@/components/ui/Button";
import { Field, FormError, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Skeleton, SongListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { clearFetchCache, useFetch } from "@/lib/hooks/useFetch";
import type { SongDTO } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { toast } from "@/store/ui";

type PlaylistResponse = {
  playlist: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    isOwner: boolean;
    songCount: number;
    durationSec: number;
    updatedAt: string;
  };
  songs: SongDTO[];
};

/**
 * Playlist detail with reordering.
 *
 * Reordering is move-up/move-down rather than drag-and-drop: the buttons work
 * with a keyboard and on a touch screen without a gesture library, which the
 * brief's accessibility and responsiveness requirements both point at.
 */
export function PlaylistDetail({ playlistId }: { playlistId: string }) {
  const router = useRouter();
  const url = `/api/playlists/${playlistId}`;
  const { data, loading, error, refetch, setData } = useFetch<PlaylistResponse>(url);

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  /**
   * Local reordering is held as an override tagged with the exact response it was
   * derived from. A refetch produces a new response object, which invalidates the
   * override automatically — so the server's order always wins after a reload,
   * with no effect syncing the two.
   */
  const [override, setOverride] = useState<{
    source: PlaylistResponse;
    songs: SongDTO[];
  } | null>(null);

  const songs =
    override !== null && override.source === data
      ? override.songs
      : (data?.songs ?? []);
  const setSongs = (next: SongDTO[]) => {
    if (data) setOverride({ source: data, songs: next });
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <SongListSkeleton count={8} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title={error.status === 404 ? "Playlist not found" : "Couldn't load this playlist"}
        description={error.message}
        offline={error.isOffline}
        onRetry={error.status === 404 ? undefined : refetch}
      />
    );
  }

  if (!data) return null;

  const { playlist } = data;

  async function persistOrder(next: SongDTO[]) {
    setSavingOrder(true);
    try {
      await apiFetch(`${url}/items`, {
        method: "PUT",
        body: { songIds: next.map((song) => song.id) },
      });
      clearFetchCache("/api/playlists");
    } catch (cause) {
      toast.error("Couldn't save the new order", errorMessage(cause));
      // Drop the local override so the server's order shows through again.
      setOverride(null);
    } finally {
      setSavingOrder(false);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= songs.length) return;
    const next = [...songs];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setSongs(next);
    void persistOrder(next);
  }

  async function remove(song: SongDTO) {
    // Optimistic removal, then the cached response is trimmed to match so the
    // row doesn't reappear if the user navigates back to this playlist.
    setSongs(songs.filter((item) => item.id !== song.id));
    try {
      await apiFetch(`${url}/items?songId=${encodeURIComponent(song.id)}`, {
        method: "DELETE",
      });
      clearFetchCache("/api/playlists");
      setData((current) => {
        const base = current ?? data!;
        return {
          ...base,
          songs: base.songs.filter((item) => item.id !== song.id),
        };
      });
      setOverride(null);
      toast.success("Removed", `“${song.title}” is no longer in this playlist.`);
    } catch (cause) {
      setOverride(null);
      toast.error("Couldn't remove that", errorMessage(cause));
    }
  }

  async function deletePlaylist() {
    try {
      await apiFetch(url, { method: "DELETE" });
      clearFetchCache("/api/playlists");
      toast.success("Playlist deleted", playlist.name);
      router.push("/playlists");
    } catch (cause) {
      toast.error("Couldn't delete that", errorMessage(cause));
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-linear-to-br from-accent-dim/30 via-surface to-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.14em] text-faint">
              Playlist{playlist.isPublic ? " · public" : ""}
            </p>
            <h1 className="mt-1 text-fluid-2xl font-bold leading-tight">{playlist.name}</h1>
            {playlist.description && (
              <p className="mt-1.5 max-w-2xl text-fluid-sm leading-relaxed text-muted">
                {playlist.description}
              </p>
            )}
            <p className="mt-1.5 text-fluid-sm text-faint">
              {songs.length} track{songs.length === 1 ? "" : "s"}
              {playlist.durationSec > 0 && ` · ${formatDuration(playlist.durationSec)}`}
              {savingOrder && " · saving order…"}
            </p>
          </div>

          {playlist.isOwner && (
            <div className="flex shrink-0 items-center gap-1">
              <IconButton label="Rename this playlist" onClick={() => setEditing(true)}>
                <Pencil className="size-[1.15rem]" aria-hidden="true" />
              </IconButton>
              <IconButton
                label="Delete this playlist"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="size-[1.15rem]" aria-hidden="true" />
              </IconButton>
            </div>
          )}
        </div>

        <PlayAllButton songs={songs} />
      </header>

      {songs.length === 0 ? (
        <EmptyState
          icon={<ListMusic className="size-8" />}
          title="This playlist is empty"
          description="Find a track you like and use the “Add to playlist” button on it."
          action={<ButtonLink href="/search">Browse the catalog</ButtonLink>}
        />
      ) : (
        <ol className="flex flex-col">
          {songs.map((song, index) => (
            <li key={song.id} className="flex items-center gap-1">
              {playlist.isOwner && (
                <div className="flex shrink-0 flex-col">
                  <IconButton
                    label={`Move ${song.title} up`}
                    size="sm"
                    className="h-6 min-h-0 w-7"
                    disabled={index === 0 || savingOrder}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Move ${song.title} down`}
                    size="sm"
                    className="h-6 min-h-0 w-7"
                    disabled={index === songs.length - 1 || savingOrder}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                  </IconButton>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <SongRow
                  song={song}
                  queue={songs}
                  index={index}
                  showIndex
                  onRemove={playlist.isOwner ? remove : undefined}
                  removeLabel="Remove from playlist:"
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      {!playlist.isOwner && (
        <p className="text-center text-fluid-sm text-faint">
          Shared with you ·{" "}
          <Link href="/playlists" className="underline hover:text-muted">
            your own playlists
          </Link>
        </p>
      )}

      {editing && (
        <EditPlaylistModal
          url={url}
          initial={playlist}
          onClose={() => setEditing(false)}
          onSaved={() => {
            clearFetchCache("/api/playlists");
            refetch();
            setEditing(false);
          }}
        />
      )}

      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete this playlist?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={deletePlaylist}>
              Delete playlist
            </Button>
          </>
        }
      >
        <p className="text-fluid-sm leading-relaxed text-muted">
          “{playlist.name}” and its ordering will be removed. The tracks
          themselves stay in the catalog, and any favourites are untouched.
        </p>
      </Modal>
    </div>
  );
}

function EditPlaylistModal({
  url,
  initial,
  onClose,
  onSaved,
}: {
  url: string;
  initial: { name: string; description: string | null; isPublic: boolean };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await apiFetch(url, {
        method: "PATCH",
        body: { name: name.trim(), description: description.trim(), isPublic },
      });
      toast.success("Playlist updated");
      onSaved();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit playlist"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-playlist" loading={busy}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-playlist" onSubmit={submit} className="flex flex-col gap-4">
        <FormError message={formError} />
        <Field label="Name" required>
          {(props) => (
            <TextInput
              {...props}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
            />
          )}
        </Field>
        <Field label="Description">
          {(props) => (
            <TextArea
              {...props}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
            />
          )}
        </Field>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-surface-2 p-3">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
            className="mt-0.5 size-4 accent-accent"
          />
          <span className="text-fluid-sm">
            Share with a link
            <span className="block text-xs text-muted">
              Anyone with the URL can view and play this playlist.
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
}
