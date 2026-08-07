"use client";

import { ListMusic, Trash2, Volume2 } from "lucide-react";

import { CoverArt } from "@/components/ui/CoverArt";
import { Button, IconButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { formatDuration } from "@/lib/utils";
import { usePlayerStore } from "@/store/player";
import { useUiStore } from "@/store/ui";

export function QueuePanel() {
  const open = useUiStore((s) => s.queueOpen);
  const setOpen = useUiStore((s) => s.setQueueOpen);
  const queue = usePlayerStore((s) => s.queue);
  const index = usePlayerStore((s) => s.index);
  const playAt = usePlayerStore((s) => s.playAt);
  const removeAt = usePlayerStore((s) => s.removeAt);
  const clearQueue = usePlayerStore((s) => s.clearQueue);

  const upNext = queue.length - index - 1;

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Queue"
      description={
        queue.length === 0
          ? undefined
          : `${queue.length} track${queue.length === 1 ? "" : "s"} · ${Math.max(0, upNext)} up next`
      }
      footer={
        queue.length > 0 ? (
          <Button variant="danger" onClick={clearQueue}>
            Clear queue
          </Button>
        ) : undefined
      }
    >
      {queue.length === 0 ? (
        <EmptyState
          icon={<ListMusic className="size-8" />}
          title="Nothing queued yet"
          description="Play a song or an album and the rest of it shows up here."
        />
      ) : (
        <ol className="-mx-2 flex flex-col">
          {queue.map((song, i) => {
            const isCurrent = i === index;
            return (
              <li key={`${song.id}-${i}`} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => playAt(i)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="relative shrink-0">
                    <CoverArt
                      src={song.coverUrl}
                      alt=""
                      seed={song.title}
                      className="size-10"
                    />
                    {isCurrent && (
                      <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/60">
                        <Volume2
                          className="size-4 text-accent-soft"
                          aria-label="Now playing"
                        />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        isCurrent
                          ? "block truncate text-fluid-sm font-semibold text-accent-soft"
                          : "block truncate text-fluid-sm text-text"
                      }
                    >
                      {song.title}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {song.artist}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-faint">
                    {formatDuration(song.durationSec)}
                  </span>
                </button>
                <IconButton
                  label={`Remove ${song.title} from queue`}
                  size="sm"
                  onClick={() => removeAt(i)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </IconButton>
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
