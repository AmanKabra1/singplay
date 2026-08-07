"use client";

import { Check, ListEnd, Mic2, Pause, Play, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useIsAuthenticated } from "@/components/providers/SessionProvider";
import { Button } from "@/components/ui/Button";
import type { SongDTO } from "@/lib/types";
import { usePlayerStore } from "@/store/player";
import { toast, useUiStore } from "@/store/ui";
import { AddToPlaylistButton } from "./AddToPlaylistButton";
import { FavoriteButton } from "./FavoriteButton";

/** The action bar on a song detail page (brief §3.2). */
export function SongDetailActions({
  song,
  hasLyrics,
}: {
  song: SongDTO;
  hasLyrics: boolean;
}) {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const promptSignup = useUiStore((s) => s.promptSignup);
  const playSong = usePlayerStore((s) => s.playSong);
  const toggle = usePlayerStore((s) => s.toggle);
  const enqueue = usePlayerStore((s) => s.enqueue);
  const isCurrent = usePlayerStore((s) => s.queue[s.index]?.id === song.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const [shared, setShared] = useState(false);

  const showPause = isCurrent && isPlaying;

  async function share() {
    const url = `${window.location.origin}/song/${song.id}`;
    const payload = {
      title: song.title,
      text: `${song.title} — ${song.artist} on SingPlay`,
      url,
    };

    // Native share sheet where there is one; clipboard everywhere else.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
        return;
      } catch {
        // A cancelled share sheet is not an error — fall through to copying.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      toast.success("Link copied", "Paste it anywhere to share this track.");
      setTimeout(() => setShared(false), 2500);
    } catch {
      toast.error("Couldn't copy the link", "Copy it from the address bar instead.");
    }
  }

  function singAlong() {
    if (!isAuthenticated) {
      promptSignup("karaoke");
      return;
    }
    router.push(`/karaoke/${song.id}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="lg" onClick={() => (isCurrent ? toggle() : playSong(song))}>
        {showPause ? (
          <Pause className="size-4 fill-current" aria-hidden="true" />
        ) : (
          <Play className="size-4 fill-current" aria-hidden="true" />
        )}
        {showPause ? "Pause" : "Play"}
      </Button>

      {hasLyrics && (
        <Button variant="outline" size="lg" onClick={singAlong}>
          <Mic2 className="size-4" aria-hidden="true" />
          Sing along
        </Button>
      )}

      <Button
        variant="ghost"
        size="lg"
        onClick={() => {
          enqueue(song, "end");
          toast.success("Added to queue", song.title);
        }}
      >
        <ListEnd className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Queue</span>
      </Button>

      <FavoriteButton song={song} size="lg" />
      <AddToPlaylistButton song={song} size="icon" />

      <Button variant="ghost" size="icon" aria-label="Share this track" onClick={share}>
        {shared ? (
          <Check className="size-[1.15rem] text-success" aria-hidden="true" />
        ) : (
          <Share2 className="size-[1.15rem]" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
