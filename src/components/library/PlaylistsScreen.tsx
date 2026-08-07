"use client";

import { ListMusic, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { CoverArt } from "@/components/ui/CoverArt";
import { Field, FormError, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { apiFetch, errorMessage, RequestError } from "@/lib/api/client";
import { clearFetchCache, useFetch } from "@/lib/hooks/useFetch";
import type { PlaylistDTO } from "@/lib/types";
import { formatDuration, relativeTime } from "@/lib/utils";
import { toast } from "@/store/ui";

export function PlaylistsScreen() {
  const { data, loading, error, refetch } = useFetch<{ items: PlaylistDTO[] }>(
    "/api/playlists",
  );
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-fluid-xl font-bold">Playlists</h1>
          <p className="text-fluid-sm text-muted">
            {data ? `${data.items.length} playlist${data.items.length === 1 ? "" : "s"}` : "Your collections"}
          </p>
        </div>
        <Button size="lg" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          New playlist
        </Button>
      </header>

      {loading && !data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="aspect-square w-full rounded-card" />
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <ErrorState
          description={error.message}
          offline={error.isOffline}
          onRetry={refetch}
        />
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          icon={<ListMusic className="size-8" />}
          title="No playlists yet"
          description="Group tracks by mood, by set, or by whatever you're practising this week."
          action={<Button onClick={() => setCreating(true)}>Create your first one</Button>}
        />
      )}

      {data && data.items.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.items.map((playlist) => (
            <li key={playlist.id}>
              <Link href={`/playlists/${playlist.id}`} className="group flex flex-col gap-2.5">
                <PlaylistMosaic playlist={playlist} />
                <div className="min-w-0">
                  <p className="truncate text-fluid-sm font-medium group-hover:underline">
                    {playlist.name}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {playlist.songCount} track{playlist.songCount === 1 ? "" : "s"}
                    {playlist.durationSec > 0 && ` · ${formatDuration(playlist.durationSec)}`}
                  </p>
                  <p className="truncate text-xs text-faint">
                    Updated {relativeTime(playlist.updatedAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <CreatePlaylistModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            clearFetchCache("/api/playlists");
            refetch();
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

/** Up to four covers in a 2×2 grid, the way most players show a collection. */
function PlaylistMosaic({ playlist }: { playlist: PlaylistDTO }) {
  if (playlist.coverUrls.length === 0) {
    return (
      <div className="grid aspect-square w-full place-items-center rounded-card bg-surface-2 text-faint">
        <ListMusic className="size-8" aria-hidden="true" />
      </div>
    );
  }

  if (playlist.coverUrls.length < 4) {
    return (
      <CoverArt
        src={playlist.coverUrls[0]}
        alt=""
        seed={playlist.name}
        rounded="rounded-card"
        className="aspect-square w-full"
      />
    );
  }

  return (
    <div className="grid aspect-square w-full grid-cols-2 grid-rows-2 overflow-hidden rounded-card">
      {playlist.coverUrls.slice(0, 4).map((url, index) => (
        <CoverArt
          key={`${url}-${index}`}
          src={url}
          alt=""
          seed={`${playlist.name}-${index}`}
          rounded="rounded-none"
          className="size-full"
        />
      ))}
    </div>
  );
}

function CreatePlaylistModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setFieldErrors({});

    try {
      await apiFetch("/api/playlists", {
        method: "POST",
        body: { name: name.trim(), description: description.trim() || undefined },
      });
      toast.success("Playlist created", name.trim());
      onCreated();
    } catch (error) {
      if (error instanceof RequestError) setFieldErrors(error.fieldErrors);
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New playlist"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-playlist" loading={busy}>
            Create
          </Button>
        </>
      }
    >
      <form id="create-playlist" onSubmit={submit} className="flex flex-col gap-4">
        <FormError message={formError} />
        <Field label="Name" required error={fieldErrors.name}>
          {(props) => (
            <TextInput
              {...props}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Warm-ups"
              maxLength={120}
              autoFocus
            />
          )}
        </Field>
        <Field label="Description" hint="Optional — a note to your future self.">
          {(props) => (
            <TextArea
              {...props}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
