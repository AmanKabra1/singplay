import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { KaraokeScreen } from "@/components/karaoke/KaraokeScreen";
import { requireSession } from "@/lib/auth/guards";
import { getSession } from "@/lib/auth/session";
import { getLyrics, getSong } from "@/lib/server/songs";
import { currentViewer } from "@/lib/server/viewer";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const song = await getSong(id, { id: null, isAuthenticated: false });
  return {
    title: song ? `Sing along · ${song.title}` : "Sing along",
    description: song
      ? `Practise ${song.title} by ${song.artist} with lyrics that scroll in time.`
      : undefined,
  };
}

/**
 * Karaoke / sing-along (brief §3.4).
 *
 * Gated server-side: karaoke tracks a practice streak and a resume position, so
 * it genuinely needs an account. Guests are sent to sign-in with a `next` hop
 * rather than shown a broken page.
 */
export default async function KaraokePage({ params }: Props) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/karaoke/${id}`)}`);
  await requireSession();

  const { viewer } = await currentViewer();
  const song = await getSong(id, viewer);
  if (!song) notFound();

  const lyrics = await getLyrics(id);

  return <KaraokeScreen song={song} lyrics={lyrics} />;
}
