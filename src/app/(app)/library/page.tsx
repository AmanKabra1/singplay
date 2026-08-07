import type { Metadata } from "next";
import { Heart } from "lucide-react";

import { PlayAllButton } from "@/components/song/PlayAllButton";
import { SongList } from "@/components/song/SongRow";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { requirePageUser } from "@/lib/auth/page-guard";
import { listFavorites } from "@/lib/server/library";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Favorites",
  description: "The tracks you've saved on SingPlay.",
};

export default async function LibraryPage() {
  const user = await requirePageUser("/library");
  const songs = await listFavorites({ id: user.id, isAuthenticated: true });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-fluid-xl font-bold">Favorites</h1>
          <p className="text-fluid-sm text-muted">
            {songs.length} saved track{songs.length === 1 ? "" : "s"}
          </p>
        </div>
        <PlayAllButton songs={songs} />
      </header>

      {songs.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-8" />}
          title="Nothing saved yet"
          description="Tap the heart on any track and it'll show up here, on every device you sign in on."
          action={<ButtonLink href="/search">Find something to listen to</ButtonLink>}
        />
      ) : (
        <SongList songs={songs} />
      )}
    </div>
  );
}
