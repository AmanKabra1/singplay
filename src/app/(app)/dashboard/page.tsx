import type { Metadata } from "next";
import Link from "next/link";
import { Flame, ListMusic, Mic2, Timer, Trophy } from "lucide-react";

import { PracticeTrendChart } from "@/components/library/PracticeTrendChart";
import { Shelf } from "@/components/song/SongCard";
import { ButtonLink } from "@/components/ui/Button";
import { CoverArt } from "@/components/ui/CoverArt";
import { EmptyState } from "@/components/ui/States";
import { requirePageUser } from "@/lib/auth/page-guard";
import {
  continuePracticing,
  getPracticeStats,
  listFavorites,
  listPlaylists,
  practiceTrend,
  recentlyPlayed,
} from "@/lib/server/library";
import { formatDuration, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your listening, your playlists and your singing practice at a glance.",
};

/** User dashboard (brief §3.6). */
export default async function DashboardPage() {
  const user = await requirePageUser("/dashboard");
  const viewer = { id: user.id, isAuthenticated: true };

  const [recent, favorites, playlists, practice, stats, trend] = await Promise.all([
    recentlyPlayed(viewer, 12),
    listFavorites(viewer, 12),
    listPlaylists(user.id),
    continuePracticing(viewer, 6),
    getPracticeStats(user.id),
    practiceTrend(user.id),
  ]);

  const nothingYet =
    recent.length === 0 && favorites.length === 0 && practice.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-fluid-xl font-bold">
          Hey, {user.displayName.split(" ")[0]}
        </h1>
        <p className="text-fluid-sm text-muted">
          {stats.currentStreak > 0
            ? `You're on a ${stats.currentStreak}-day practice streak — keep it going.`
            : "Sing along to a track today to start a practice streak."}
        </p>
      </header>

      <section aria-label="Practice stats" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={<Flame className="size-4" />}
          label="Current streak"
          value={`${stats.currentStreak}`}
          unit={stats.currentStreak === 1 ? "day" : "days"}
          tone="accent"
        />
        <StatTile
          icon={<Trophy className="size-4" />}
          label="Longest streak"
          value={`${stats.longestStreak}`}
          unit={stats.longestStreak === 1 ? "day" : "days"}
        />
        <StatTile
          icon={<Mic2 className="size-4" />}
          label="Songs practised"
          value={`${stats.songsPracticed}`}
          unit={stats.songsPracticed === 1 ? "song" : "songs"}
        />
        <StatTile
          icon={<Timer className="size-4" />}
          label="Time singing"
          value={formatDuration(stats.totalPracticeSec)}
          unit={`${stats.totalSessions} session${stats.totalSessions === 1 ? "" : "s"}`}
        />
      </section>

      {nothingYet ? (
        <EmptyState
          icon={<Mic2 className="size-9" />}
          title="Your dashboard fills up as you listen"
          description="Play a few tracks, save the ones you like, and try sing-along mode — everything you do shows up here."
          action={<ButtonLink href="/search">Find something to sing</ButtonLink>}
        />
      ) : (
        <>
          <section aria-labelledby="trend-heading">
            <h2 id="trend-heading" className="mb-3 text-fluid-lg font-bold">
              Practice this week
            </h2>
            <PracticeTrendChart data={trend} />
          </section>

          {practice.length > 0 && (
            <section aria-labelledby="continue-heading">
              <div className="mb-3 flex items-end justify-between gap-3">
                <h2 id="continue-heading" className="text-fluid-lg font-bold">
                  Continue practicing
                </h2>
                <Link
                  href="/practice"
                  className="text-fluid-sm font-medium text-muted hover:text-text hover:underline"
                >
                  See all
                </Link>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {practice.map((entry) => (
                  <li key={entry.song.id}>
                    <Link
                      href={`/karaoke/${entry.song.id}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-accent/50"
                    >
                      <CoverArt
                        src={entry.song.coverUrl}
                        alt=""
                        seed={entry.song.title}
                        className="size-12 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-fluid-sm font-medium">
                          {entry.song.title}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {entry.song.artist}
                        </span>
                        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-3">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{
                              width: `${Math.min(
                                100,
                                entry.song.durationSec > 0
                                  ? (entry.lastPositionSec / entry.song.durationSec) * 100
                                  : 0,
                              )}%`,
                            }}
                          />
                        </span>
                        <span className="mt-1 block text-[0.7rem] text-faint">
                          {entry.completed
                            ? "Completed"
                            : `Stopped at ${formatDuration(entry.lastPositionSec)}`}{" "}
                          · {relativeTime(entry.lastPracticedAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {recent.length > 0 && <Shelf title="Recently played" songs={recent} />}

          {favorites.length > 0 && (
            <Shelf
              title="Your favorites"
              songs={favorites}
              action={
                <Link
                  href="/library"
                  className="shrink-0 text-fluid-sm font-medium text-muted hover:text-text hover:underline"
                >
                  See all
                </Link>
              }
            />
          )}

          {playlists.length > 0 && (
            <section aria-labelledby="playlists-heading">
              <div className="mb-3 flex items-end justify-between gap-3">
                <h2 id="playlists-heading" className="text-fluid-lg font-bold">
                  Your playlists
                </h2>
                <Link
                  href="/playlists"
                  className="text-fluid-sm font-medium text-muted hover:text-text hover:underline"
                >
                  See all
                </Link>
              </div>
              <ul className="flex flex-wrap gap-2">
                {playlists.slice(0, 8).map((playlist) => (
                  <li key={playlist.id}>
                    <Link
                      href={`/playlists/${playlist.id}`}
                      className="tap inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 text-fluid-sm transition-colors hover:border-accent"
                    >
                      <ListMusic className="size-4 text-accent-soft" aria-hidden="true" />
                      {playlist.name}
                      <span className="text-xs text-faint">{playlist.songCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  unit,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  tone?: "default" | "accent";
}) {
  return (
    <div
      className={
        tone === "accent"
          ? "rounded-xl border border-accent/35 bg-accent/10 p-4"
          : "rounded-xl border border-border bg-surface p-4"
      }
    >
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-faint">
        <span aria-hidden="true">{icon}</span>
        {label}
      </p>
      <p className="mt-1.5 text-fluid-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{unit}</p>
    </div>
  );
}
