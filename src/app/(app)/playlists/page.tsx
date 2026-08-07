import type { Metadata } from "next";

import { PlaylistsScreen } from "@/components/library/PlaylistsScreen";
import { requirePageUser } from "@/lib/auth/page-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Playlists",
  description: "Your SingPlay playlists.",
};

export default async function PlaylistsPage() {
  await requirePageUser("/playlists");
  return <PlaylistsScreen />;
}
