import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Mic2 } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";
import { CoverArt } from "@/components/ui/CoverArt";
import { EmptyState } from "@/components/ui/States";
import { requirePageUser } from "@/lib/auth/page-guard";
import { continuePracticing, getPracticeStats } from "@/lib/server/library";
import { formatDuration, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Practice",
  description: "Pick up the songs you've been practising where you left off.",
};

export default async function PracticePage() {
  const user = await requirePageUser("/practice");

  const [entries, stats] = await Promise.all([
    continuePracticing({ id: user.id, isAuthenticated: true }, 50),
    getPracticeStats(user.id),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-fluid-xl font-bold">Practice</h1>
        <p className="text-fluid-sm text-muted">
          {stats.songsPracticed > 0
            ? `${stats.songsPracticed} song${stats.songsPracticed === 1 ? "" : "s"} practised · ${formatDuration(stats.totalPracticeSec)} of singing so far`
            : "Everything you sing along to gets saved here."}
        </p>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          icon={<Mic2 className="size-8" />}
          title="Nothing in progress"
          description="Open a track with synced lyrics and hit “Sing along”. We'll remember where you stopped."
          action={<ButtonLink href="/search">Find a song to sing</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => {
            const progress =
              entry.song.durationSec > 0
                ? Math.min(100, (entry.lastPositionSec / entry.song.durationSec) * 100)
                : 0;

            return (
              <li key={entry.song.id}>
                <Link
                  href={`/karaoke/${entry.song.id}`}
                  className="flex h-full items-start gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-accent/50"
                >
                  <CoverArt
                    src={entry.song.coverUrl}
                    alt=""
                    seed={entry.song.title}
                    className="size-14 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-fluid-sm font-medium">
                      {entry.song.title}
                    </p>
                    <p className="truncate text-xs text-muted">{entry.song.artist}</p>

                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress)}
                      aria-label={`Progress through ${entry.song.title}`}
                    >
                      <div
                        className={
                          entry.completed
                            ? "h-full rounded-full bg-success"
                            : "h-full rounded-full bg-accent"
                        }
                        style={{ width: `${entry.completed ? 100 : progress}%` }}
                      />
                    </div>

                    <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[0.7rem] text-faint">
                      {entry.completed ? (
                        <>
                          <CheckCircle2
                            className="size-3 text-success"
                            aria-hidden="true"
                          />
                          Completed
                        </>
                      ) : (
                        <>Stopped at {formatDuration(entry.lastPositionSec)}</>
                      )}
                      <span aria-hidden="true">·</span>
                      {entry.sessions} session{entry.sessions === 1 ? "" : "s"}
                      <span aria-hidden="true">·</span>
                      {relativeTime(entry.lastPracticedAt)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
