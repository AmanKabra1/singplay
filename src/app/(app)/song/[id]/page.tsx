import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Disc3, Gauge, KeyRound, Mic2, Music2 } from "lucide-react";

import { SongDetailActions } from "@/components/song/SongDetailActions";
import { StaticLyrics } from "@/components/karaoke/LyricsScroller";
import { CoverArt } from "@/components/ui/CoverArt";
import { getLyrics, getSong, listSongs } from "@/lib/server/songs";
import { currentViewer } from "@/lib/server/viewer";
import { formatDuration } from "@/lib/utils";
import { Shelf } from "@/components/song/SongCard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const song = await getSong(id, { id: null, isAuthenticated: false });
  if (!song) return { title: "Track not found" };

  return {
    title: `${song.title} — ${song.artist}`,
    description:
      song.notes?.slice(0, 160) ??
      `Listen to ${song.title} by ${song.artist} on SingPlay, with full lyrics and sing-along practice.`,
  };
}

/** Song detail (brief §3.2): notes, lyrics, credits and the actions. */
export default async function SongPage({ params }: Props) {
  const { id } = await params;
  const { viewer } = await currentViewer();

  const song = await getSong(id, viewer);
  if (!song) notFound();

  const [lyrics, more] = await Promise.all([
    getLyrics(song.id),
    listSongs({ artist: song.artist, limit: 12, sort: "popular" }, viewer),
  ]);

  const related = more.items.filter((item) => item.id !== song.id);

  const facts = [
    song.album && { icon: Disc3, label: "Album", value: song.album },
    song.genre && { icon: Music2, label: "Genre", value: song.genre },
    song.releaseYear && {
      icon: Disc3,
      label: "Released",
      value: String(song.releaseYear),
    },
    song.bpm && { icon: Gauge, label: "Tempo", value: `${song.bpm} BPM` },
    song.musicalKey && { icon: KeyRound, label: "Key", value: song.musicalKey },
  ].filter(Boolean) as { icon: typeof Disc3; label: string; value: string }[];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-7">
        <CoverArt
          src={song.coverUrl}
          alt={`Cover art for ${song.title}`}
          seed={song.title}
          eager
          rounded="rounded-2xl"
          className="w-40 shrink-0 shadow-2xl sm:w-52 lg:w-60"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-faint">Song</p>
            <h1 className="mt-1 text-fluid-2xl font-bold leading-tight">{song.title}</h1>
            <p className="mt-1 text-fluid-base text-muted">
              <Link
                href={`/search?artist=${encodeURIComponent(song.artist)}`}
                className="font-medium text-text hover:underline"
              >
                {song.artist}
              </Link>
              {song.album && ` · ${song.album}`}
              {song.releaseYear && ` · ${song.releaseYear}`}
              {song.durationSec > 0 && ` · ${formatDuration(song.durationSec)}`}
            </p>
          </div>

          <SongDetailActions song={song} hasLyrics={Boolean(lyrics.plainText)} />

          {song.licenseNote && (
            <p className="text-xs text-faint">{song.licenseNote}</p>
          )}
        </div>
      </header>

      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="rounded-xl border border-border bg-surface px-4 py-3"
            >
              <dt className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-faint">
                <fact.icon className="size-3.5" aria-hidden="true" />
                {fact.label}
              </dt>
              <dd className="mt-1 truncate text-fluid-sm font-medium">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="lyrics-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="lyrics-heading" className="text-fluid-lg font-bold">
              Lyrics
            </h2>
            {song.hasSyncedLyrics && (
              <Link
                href={`/karaoke/${song.id}`}
                className="inline-flex items-center gap-1.5 text-fluid-sm font-medium text-accent-soft hover:underline"
              >
                <Mic2 className="size-4" aria-hidden="true" />
                Sing along with timing
              </Link>
            )}
          </div>

          {lyrics.plainText ? (
            <>
              {!song.hasSyncedLyrics && (
                <p className="mb-3 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-fluid-sm text-muted">
                  Sync isn&apos;t available for this track yet — the lyrics are
                  here to read, but they won&apos;t scroll in time.
                </p>
              )}
              <StaticLyrics
                text={lyrics.plainText}
                className="rounded-xl border border-border bg-surface px-5 py-4 text-text"
              />
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-fluid-sm text-faint">
              No lyrics have been added for this track yet.
            </p>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          {song.notes && (
            <section aria-labelledby="notes-heading">
              <h2 id="notes-heading" className="mb-2.5 text-fluid-lg font-bold">
                About this track
              </h2>
              <p className="whitespace-pre-wrap rounded-xl border border-border bg-surface px-4 py-3.5 text-fluid-sm leading-relaxed text-muted">
                {song.notes}
              </p>
            </section>
          )}

          {song.credits && (
            <section aria-labelledby="credits-heading">
              <h2 id="credits-heading" className="mb-2.5 text-fluid-lg font-bold">
                Credits
              </h2>
              <p className="whitespace-pre-wrap rounded-xl border border-border bg-surface px-4 py-3.5 text-fluid-sm leading-relaxed text-muted">
                {song.credits}
              </p>
            </section>
          )}

          <section>
            <h2 className="mb-2.5 text-fluid-lg font-bold">Stats</h2>
            <p className="rounded-xl border border-border bg-surface px-4 py-3.5 text-fluid-sm text-muted">
              Played {song.playCount.toLocaleString()} time
              {song.playCount === 1 ? "" : "s"} on SingPlay.
            </p>
          </section>
        </aside>
      </div>

      {related.length > 0 && (
        <Shelf
          title={`More from ${song.artist}`}
          songs={related}
          action={
            <Link
              href={`/search?artist=${encodeURIComponent(song.artist)}`}
              className="shrink-0 text-fluid-sm font-medium text-muted hover:text-text hover:underline"
            >
              See all
            </Link>
          }
        />
      )}
    </div>
  );
}
