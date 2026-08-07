"use client";

import { Play, Shuffle } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { PlayMode, SongDTO } from "@/lib/types";
import { usePlayerStore } from "@/store/player";

/** "Play all" / "Shuffle" pair used at the top of any collection of tracks. */
export function PlayAllButton({
  songs,
  mode = "player",
  label = "Play all",
}: {
  songs: SongDTO[];
  mode?: PlayMode;
  label?: string;
}) {
  const playQueue = usePlayerStore((s) => s.playQueue);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);

  if (songs.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="lg" onClick={() => playQueue(songs, 0, mode)}>
        <Play className="size-4 fill-current" aria-hidden="true" />
        {label}
      </Button>
      <Button
        variant="outline"
        size="lg"
        onClick={() => {
          // Turn shuffle on if it isn't already, then start — otherwise
          // "Shuffle" would silently play in order.
          if (!shuffle) toggleShuffle();
          playQueue(songs, Math.floor(Math.random() * songs.length), mode);
        }}
      >
        <Shuffle className="size-4" aria-hidden="true" />
        Shuffle
      </Button>
    </div>
  );
}
