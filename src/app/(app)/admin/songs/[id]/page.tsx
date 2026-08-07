import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { LyricsEditor } from "@/components/admin/LyricsEditor";
import { SongForm, type SongFormValues } from "@/components/admin/SongForm";
import { getDb, songs } from "@/db";
import { getLyrics } from "@/lib/server/songs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit track",
  robots: { index: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function EditSongPage({ params }: Props) {
  const { id } = await params;

  // Read the raw row, not the listener DTO: the form edits fields (draft state,
  // external id, preview URL) that the public shape deliberately doesn't carry.
  const [song] = await getDb().select().from(songs).where(eq(songs.id, id)).limit(1);
  if (!song) notFound();

  const lyrics = await getLyrics(id);

  const initial: SongFormValues = {
    title: song.title,
    artist: song.artist,
    album: song.album ?? "",
    genre: song.genre ?? "",
    mood: song.mood ?? "",
    releaseYear: song.releaseYear ? String(song.releaseYear) : "",
    durationSec: song.durationSec ? String(song.durationSec) : "",
    bpm: song.bpm ? String(song.bpm) : "",
    musicalKey: song.musicalKey ?? "",
    coverUrl: song.coverUrl ?? "",
    audioUrl: song.audioUrl,
    previewUrl: song.previewUrl ?? "",
    notes: song.notes ?? "",
    credits: song.credits ?? "",
    licenseNote: song.licenseNote ?? "",
    isPublished: song.isPublished,
  };

  return (
    <div className="flex flex-col gap-7">
      <div>
        <Link
          href="/admin/songs"
          className="inline-flex items-center gap-1.5 text-fluid-sm text-muted transition-colors hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to songs
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-fluid-xl font-bold">{song.title}</h1>
            <p className="truncate text-fluid-sm text-muted">
              {song.artist}
              {song.source === "jamendo" && " · imported from Jamendo"}
              {!song.isPublished && " · draft"}
            </p>
          </div>
          <Link
            href={`/song/${song.id}`}
            className="inline-flex shrink-0 items-center gap-1.5 text-fluid-sm font-medium text-accent-soft hover:underline"
          >
            View as a listener
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <section aria-labelledby="details-heading" className="max-w-4xl">
        <h2 id="details-heading" className="sr-only">
          Track details
        </h2>
        <SongForm songId={song.id} initial={initial} />
      </section>

      <section aria-labelledby="lyrics-heading">
        <h2 id="lyrics-heading" className="text-fluid-xl font-bold">
          Lyrics & timing
        </h2>
        <p className="mb-4 text-fluid-sm text-muted">
          Timed LRC lyrics are what make sing-along mode work for this track.
          Without them, listeners get the plain lyric sheet and a note saying sync
          isn&apos;t available yet.
        </p>
        <LyricsEditor
          songId={song.id}
          initial={lyrics}
          durationSec={song.durationSec}
        />
      </section>
    </div>
  );
}
