import type { Metadata } from "next";

import { PlaylistDetail } from "@/components/library/PlaylistDetail";
import { optionalUser } from "@/lib/auth/guards";
import { getPlaylist } from "@/lib/server/library";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const viewer = await optionalUser();
  try {
    const playlist = await getPlaylist(id, viewer?.id ?? null);
    return { title: playlist.name, description: playlist.description ?? undefined };
  } catch {
    // A private or missing playlist shouldn't leak its existence via the title.
    return { title: "Playlist" };
  }
}

export default async function PlaylistPage({ params }: Props) {
  const { id } = await params;
  return <PlaylistDetail playlistId={id} />;
}
