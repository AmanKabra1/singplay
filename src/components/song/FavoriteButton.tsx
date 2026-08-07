"use client";

import { Heart } from "lucide-react";
import { useState } from "react";

import { useIsAuthenticated } from "@/components/providers/SessionProvider";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { clearFetchCache } from "@/lib/hooks/useFetch";
import type { SongDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast, useUiStore } from "@/store/ui";

/**
 * Optimistic favourite toggle. The heart flips immediately and rolls back if the
 * request fails, so the control never feels laggy on a slow connection but also
 * never lies about what was saved (brief §4.2).
 */
export function FavoriteButton({
  song,
  size = "md",
  className,
  onChange,
}: {
  song: SongDTO;
  size?: "sm" | "md" | "lg";
  className?: string;
  onChange?: (isFavorite: boolean) => void;
}) {
  const isAuthenticated = useIsAuthenticated();
  const promptSignup = useUiStore((s) => s.promptSignup);
  const [pending, setPending] = useState(false);

  /**
   * Only the local *override* is stored, tagged with the song it applies to.
   * The server's value is the default, so a re-fetched list or a recycled card
   * corrects itself with no prop-to-state syncing.
   */
  const [override, setOverride] = useState<{ songId: string; value: boolean } | null>(
    null,
  );
  const isFavorite =
    override?.songId === song.id ? override.value : Boolean(song.isFavorite);

  function setIsFavorite(value: boolean) {
    setOverride({ songId: song.id, value });
  }

  const iconSize = { sm: "size-4", md: "size-[1.15rem]", lg: "size-6" }[size];
  const boxSize = { sm: "size-8", md: "size-10", lg: "size-12" }[size];

  async function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      promptSignup("favorite");
      return;
    }

    const next = !isFavorite;
    setIsFavorite(next);
    setPending(true);
    onChange?.(next);

    try {
      if (next) {
        await apiFetch("/api/favorites", { method: "POST", body: { songId: song.id } });
      } else {
        await apiFetch(`/api/favorites?songId=${encodeURIComponent(song.id)}`, {
          method: "DELETE",
        });
      }
      // The library and dashboard read from the same cache; drop it so they
      // don't show a stale favourites list on the next visit.
      clearFetchCache("/api/favorites");
      clearFetchCache("/api/dashboard");
    } catch (error) {
      setIsFavorite(!next);
      onChange?.(!next);
      toast.error("Couldn't save that", errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={isFavorite}
      aria-label={
        isFavorite ? `Remove ${song.title} from favourites` : `Save ${song.title} to favourites`
      }
      title={isFavorite ? "In your favourites" : "Save to favourites"}
      className={cn(
        "grid shrink-0 place-items-center rounded-full transition-colors disabled:opacity-60",
        boxSize,
        isFavorite ? "text-danger" : "text-muted hover:text-text",
        className,
      )}
    >
      <Heart className={cn(iconSize, isFavorite && "fill-current")} aria-hidden="true" />
    </button>
  );
}
