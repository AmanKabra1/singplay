import "server-only";

import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";

import {
  djSessions,
  getDb,
  playHistory,
  searchLog,
  songs,
  users,
} from "@/db";
import { isoDate, newId } from "@/lib/utils";

/** Admin dashboard aggregates (brief §3.7). */

export type AdminOverview = {
  totals: {
    songs: number;
    publishedSongs: number;
    users: number;
    activeUsers7d: number;
    plays7d: number;
    djSessions7d: number;
  };
  playsPerDay: { date: string; label: string; plays: number }[];
  topSongs: { id: string; title: string; artist: string; plays: number }[];
  topSearches: { query: string; count: number; avgResults: number }[];
  modeSplit: { mode: string; plays: number }[];
};

export async function logSearch(
  userId: string | null,
  query: string,
  resultCount: number,
) {
  const trimmed = query.trim().slice(0, 255);
  if (!trimmed) return;
  try {
    await getDb().insert(searchLog).values({
      id: newId(),
      userId,
      query: trimmed,
      resultCount,
    });
  } catch (error) {
    // Analytics is never worth failing a user-facing search over.
    console.error("[analytics] failed to log search", error);
  }
}

export async function logDjSession(
  userId: string,
  deckASongId: string | null,
  deckBSongId: string | null,
  durationSec: number,
) {
  await getDb().insert(djSessions).values({
    id: newId(),
    userId,
    deckASongId,
    deckBSongId,
    durationSec: Math.max(0, Math.round(durationSec)),
  });
}

export async function adminOverview(): Promise<AdminOverview> {
  const db = getDb();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const fortnight = new Date(Date.now() - 14 * 86_400_000);

  /**
   * `date_format` rather than `date()`: the latter can come back as a Date object
   * depending on the driver, which would never match the ISO keys used to fill the
   * series below and would silently flatten the chart to zero.
   *
   * The column is written out rather than interpolated as `${playHistory.playedAt}`
   * because Drizzle renders a column reference *unqualified* in a MySQL select
   * list but *qualified* in GROUP BY. TiDB runs with `only_full_group_by`, which
   * then rejects the query — the two expressions have to be textually identical.
   */
  const playedDay = sql<string>`date_format(play_history.played_at, '%Y-%m-%d')`;

  const [
    songTotals,
    userTotals,
    activeUsers,
    weekPlays,
    weekDj,
    perDay,
    top,
    searches,
    modes,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        published: sql<number>`sum(case when ${songs.isPublished} then 1 else 0 end)`,
      })
      .from(songs),
    db.select({ total: sql<number>`count(*)` }).from(users),
    db
      .select({ total: sql<number>`count(distinct ${playHistory.userId})` })
      .from(playHistory)
      .where(gt(playHistory.playedAt, weekAgo)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(playHistory)
      .where(gt(playHistory.playedAt, weekAgo)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(djSessions)
      .where(gt(djSessions.startedAt, weekAgo)),
    db
      .select({ day: playedDay, plays: sql<number>`count(*)` })
      .from(playHistory)
      .where(gt(playHistory.playedAt, fortnight))
      .groupBy(playedDay),
    db
      .select({
        id: songs.id,
        title: songs.title,
        artist: songs.artist,
        plays: sql<number>`count(${playHistory.id})`,
      })
      .from(playHistory)
      .innerJoin(songs, eq(songs.id, playHistory.songId))
      .where(gt(playHistory.playedAt, fortnight))
      .groupBy(songs.id, songs.title, songs.artist)
      .orderBy(desc(sql`count(${playHistory.id})`))
      .limit(10),
    db
      .select({
        query: searchLog.query,
        count: sql<number>`count(*)`,
        avgResults: sql<number>`avg(${searchLog.resultCount})`,
      })
      .from(searchLog)
      .where(gt(searchLog.createdAt, fortnight))
      .groupBy(searchLog.query)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    db
      .select({ mode: playHistory.mode, plays: sql<number>`count(*)` })
      .from(playHistory)
      .where(gt(playHistory.playedAt, fortnight))
      .groupBy(playHistory.mode),
  ]);

  const playsByDay = new Map(perDay.map((row) => [String(row.day), Number(row.plays)]));

  return {
    totals: {
      songs: Number(songTotals[0]?.total ?? 0),
      publishedSongs: Number(songTotals[0]?.published ?? 0),
      users: Number(userTotals[0]?.total ?? 0),
      activeUsers7d: Number(activeUsers[0]?.total ?? 0),
      plays7d: Number(weekPlays[0]?.total ?? 0),
      djSessions7d: Number(weekDj[0]?.total ?? 0),
    },
    playsPerDay: Array.from({ length: 14 }, (_, offset) => {
      const date = new Date(Date.now() - (13 - offset) * 86_400_000);
      const key = isoDate(date);
      return {
        date: key,
        label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        plays: playsByDay.get(key) ?? 0,
      };
    }),
    topSongs: top.map((row) => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      plays: Number(row.plays),
    })),
    topSearches: searches.map((row) => ({
      query: row.query,
      count: Number(row.count),
      avgResults: Math.round(Number(row.avgResults ?? 0)),
    })),
    modeSplit: modes.map((row) => ({ mode: row.mode, plays: Number(row.plays) })),
  };
}

/** Per-user counts for the admin user table. */
export async function userActivity(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, number>();
  const rows = await getDb()
    .select({ userId: playHistory.userId, plays: sql<number>`count(*)` })
    .from(playHistory)
    .where(
      and(
        gt(playHistory.playedAt, new Date(Date.now() - 30 * 86_400_000)),
        inArray(playHistory.userId, userIds),
      ),
    )
    .groupBy(playHistory.userId);

  return new Map(rows.map((row) => [row.userId, Number(row.plays)]));
}
