import "server-only";

import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";

import {
  favorites,
  getDb,
  karaokeProgress,
  playHistory,
  playlistItems,
  playlists,
  practiceStats,
  songs,
} from "@/db";
import { ApiError } from "@/lib/api/http";
import type {
  KaraokeProgressDTO,
  PlayMode,
  PlaylistDTO,
  PracticeStatsDTO,
  SongDTO,
} from "@/lib/types";
import { daysBetween, isoDate, newId } from "@/lib/utils";
import { getSongsByIds } from "./songs";

type Viewer = { id: string; isAuthenticated: boolean };

// ---------------------------------------------------------------------------
// Favourites
// ---------------------------------------------------------------------------

export async function listFavorites(viewer: Viewer, limit = 200) {
  const rows = await getDb()
    .select({ songId: favorites.songId })
    .from(favorites)
    .where(eq(favorites.userId, viewer.id))
    .orderBy(desc(favorites.createdAt))
    .limit(limit);

  return getSongsByIds(
    rows.map((row) => row.songId),
    viewer,
  );
}

/** Idempotent: favouriting twice is a no-op rather than a duplicate-key 500. */
export async function addFavorite(userId: string, songId: string) {
  const db = getDb();
  const [existing] = await db
    .select({ id: favorites.id })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.songId, songId)))
    .limit(1);

  if (existing) return { added: false };
  await db.insert(favorites).values({ id: newId(), userId, songId });
  return { added: true };
}

export async function removeFavorite(userId: string, songId: string) {
  await getDb()
    .delete(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.songId, songId)));
}

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

/**
 * Playlist summaries with their track count, total runtime and up to four
 * covers for the mosaic thumbnail — all from two queries rather than N+1.
 */
export async function listPlaylists(userId: string): Promise<PlaylistDTO[]> {
  const db = getDb();
  const owned = await db
    .select()
    .from(playlists)
    .where(eq(playlists.userId, userId))
    .orderBy(desc(playlists.updatedAt));

  if (owned.length === 0) return [];

  const items = await db
    .select({
      playlistId: playlistItems.playlistId,
      position: playlistItems.position,
      durationSec: songs.durationSec,
      coverUrl: songs.coverUrl,
    })
    .from(playlistItems)
    .innerJoin(songs, eq(songs.id, playlistItems.songId))
    .where(
      inArray(
        playlistItems.playlistId,
        owned.map((playlist) => playlist.id),
      ),
    )
    .orderBy(playlistItems.position);

  const grouped = new Map<string, { count: number; duration: number; covers: string[] }>();
  for (const item of items) {
    const entry = grouped.get(item.playlistId) ?? { count: 0, duration: 0, covers: [] };
    entry.count += 1;
    entry.duration += item.durationSec;
    if (item.coverUrl && entry.covers.length < 4) entry.covers.push(item.coverUrl);
    grouped.set(item.playlistId, entry);
  }

  return owned.map((playlist) => {
    const stats = grouped.get(playlist.id);
    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      isPublic: playlist.isPublic,
      songCount: stats?.count ?? 0,
      durationSec: stats?.duration ?? 0,
      coverUrls: stats?.covers ?? [],
      updatedAt: playlist.updatedAt.toISOString(),
    };
  });
}

/** Loads a playlist the viewer is allowed to see, or throws 404/403. */
export async function getPlaylist(playlistId: string, viewerId: string | null) {
  const [playlist] = await getDb()
    .select()
    .from(playlists)
    .where(eq(playlists.id, playlistId))
    .limit(1);

  if (!playlist) throw ApiError.notFound("That playlist doesn't exist.");
  if (playlist.userId !== viewerId && !playlist.isPublic) {
    throw ApiError.forbidden("This playlist is private.");
  }
  return playlist;
}

export async function requireOwnedPlaylist(playlistId: string, userId: string) {
  const playlist = await getPlaylist(playlistId, userId);
  if (playlist.userId !== userId) {
    throw ApiError.forbidden("You can only change your own playlists.");
  }
  return playlist;
}

export async function playlistSongs(
  playlistId: string,
  viewer: { id: string | null; isAuthenticated: boolean },
): Promise<SongDTO[]> {
  const rows = await getDb()
    .select({ songId: playlistItems.songId })
    .from(playlistItems)
    .where(eq(playlistItems.playlistId, playlistId))
    .orderBy(playlistItems.position);

  return getSongsByIds(
    rows.map((row) => row.songId),
    viewer,
  );
}

async function nextPosition(playlistId: string) {
  const [row] = await getDb()
    .select({ max: sql<number | null>`max(${playlistItems.position})` })
    .from(playlistItems)
    .where(eq(playlistItems.playlistId, playlistId));
  return Number(row?.max ?? -1) + 1;
}

export async function addToPlaylist(playlistId: string, songId: string) {
  const db = getDb();
  const [existing] = await db
    .select({ id: playlistItems.id })
    .from(playlistItems)
    .where(
      and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.songId, songId)),
    )
    .limit(1);

  if (existing) return { added: false };

  await db.insert(playlistItems).values({
    id: newId(),
    playlistId,
    songId,
    position: await nextPosition(playlistId),
  });
  await touchPlaylist(playlistId);
  return { added: true };
}

export async function removeFromPlaylist(playlistId: string, songId: string) {
  await getDb()
    .delete(playlistItems)
    .where(
      and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.songId, songId)),
    );
  await touchPlaylist(playlistId);
}

/**
 * Rewrites positions to match `songIds`. Any track not named keeps its relative
 * order after the ones that were, so a partial reorder can't silently drop rows.
 */
export async function reorderPlaylist(playlistId: string, songIds: string[]) {
  const db = getDb();
  const existing = await db
    .select({ songId: playlistItems.songId })
    .from(playlistItems)
    .where(eq(playlistItems.playlistId, playlistId))
    .orderBy(playlistItems.position);

  const known = new Set(existing.map((row) => row.songId));
  const ordered = songIds.filter((id) => known.has(id));
  const remainder = existing
    .map((row) => row.songId)
    .filter((id) => !ordered.includes(id));
  const finalOrder = [...ordered, ...remainder];

  await Promise.all(
    finalOrder.map((songId, position) =>
      db
        .update(playlistItems)
        .set({ position })
        .where(
          and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.songId, songId)),
        ),
    ),
  );
  await touchPlaylist(playlistId);
}

function touchPlaylist(playlistId: string) {
  return getDb()
    .update(playlists)
    .set({ updatedAt: new Date() })
    .where(eq(playlists.id, playlistId));
}

// ---------------------------------------------------------------------------
// History, karaoke progress and practice stats
// ---------------------------------------------------------------------------

export async function recordPlay(
  userId: string,
  songId: string,
  mode: PlayMode,
  msPlayed: number,
) {
  const db = getDb();

  await db.insert(playHistory).values({
    id: newId(),
    userId,
    songId,
    mode,
    msPlayed: Math.max(0, Math.min(msPlayed, 6 * 3600_000)),
  });

  // The catalog-wide counter drives "Popular right now"; it's an increment
  // rather than a COUNT so the home page never has to scan play_history.
  await db
    .update(songs)
    .set({ playCount: sql`${songs.playCount} + 1` })
    .where(eq(songs.id, songId));

  if (mode === "karaoke") {
    await bumpPracticeStats(userId, Math.round(msPlayed / 1000));
  }
}

export async function recentlyPlayed(viewer: Viewer, limit = 12) {
  const rows = await getDb()
    .select({ songId: playHistory.songId })
    .from(playHistory)
    .where(eq(playHistory.userId, viewer.id))
    .orderBy(desc(playHistory.playedAt))
    .limit(limit * 4);

  // Collapse repeats — "recently played" means distinct tracks, newest first.
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of rows) {
    if (seen.has(row.songId)) continue;
    seen.add(row.songId);
    ids.push(row.songId);
    if (ids.length >= limit) break;
  }
  return getSongsByIds(ids, viewer);
}

export async function saveKaraokeProgress(
  userId: string,
  songId: string,
  lastPositionSec: number,
  completed: boolean,
) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(karaokeProgress)
    .where(and(eq(karaokeProgress.userId, userId), eq(karaokeProgress.songId, songId)))
    .limit(1);

  if (existing) {
    await db
      .update(karaokeProgress)
      .set({
        lastPositionSec: Math.max(0, Math.round(lastPositionSec)),
        sessions: existing.sessions + 1,
        completed: existing.completed || completed,
        lastPracticedAt: new Date(),
      })
      .where(eq(karaokeProgress.id, existing.id));
    return;
  }

  await db.insert(karaokeProgress).values({
    id: newId(),
    userId,
    songId,
    lastPositionSec: Math.max(0, Math.round(lastPositionSec)),
    sessions: 1,
    completed,
  });
}

export async function continuePracticing(
  viewer: Viewer,
  limit = 8,
): Promise<KaraokeProgressDTO[]> {
  const rows = await getDb()
    .select()
    .from(karaokeProgress)
    .where(eq(karaokeProgress.userId, viewer.id))
    .orderBy(desc(karaokeProgress.lastPracticedAt))
    .limit(limit);

  const songsById = new Map(
    (await getSongsByIds(rows.map((row) => row.songId), viewer)).map((song) => [
      song.id,
      song,
    ]),
  );

  return rows
    .map((row) => {
      const song = songsById.get(row.songId);
      if (!song) return null;
      return {
        song,
        lastPositionSec: row.lastPositionSec,
        sessions: row.sessions,
        completed: row.completed,
        lastPracticedAt: row.lastPracticedAt.toISOString(),
      } satisfies KaraokeProgressDTO;
    })
    .filter((row): row is KaraokeProgressDTO => row !== null);
}

/**
 * Streak maths. A practice session on the same calendar day is a no-op for the
 * streak; the next day extends it; anything longer resets it to 1.
 */
async function bumpPracticeStats(userId: string, seconds: number) {
  const db = getDb();
  const today = isoDate();

  const [existing] = await db
    .select()
    .from(practiceStats)
    .where(eq(practiceStats.userId, userId))
    .limit(1);

  const distinctSongs = await db
    .select({ count: sql<number>`count(distinct ${karaokeProgress.songId})` })
    .from(karaokeProgress)
    .where(eq(karaokeProgress.userId, userId));
  const songsPracticed = Number(distinctSongs[0]?.count ?? 0);

  if (!existing) {
    await db.insert(practiceStats).values({
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastPracticeDate: today,
      totalSessions: 1,
      totalPracticeSec: seconds,
      songsPracticed,
    });
    return;
  }

  const last = existing.lastPracticeDate;
  const gap = last ? daysBetween(last, today) : Number.POSITIVE_INFINITY;
  const currentStreak =
    gap === 0 ? existing.currentStreak : gap === 1 ? existing.currentStreak + 1 : 1;

  await db
    .update(practiceStats)
    .set({
      currentStreak,
      longestStreak: Math.max(existing.longestStreak, currentStreak),
      lastPracticeDate: today,
      totalSessions: existing.totalSessions + 1,
      totalPracticeSec: existing.totalPracticeSec + seconds,
      songsPracticed,
    })
    .where(eq(practiceStats.userId, userId));
}

export async function getPracticeStats(userId: string): Promise<PracticeStatsDTO> {
  const db = getDb();

  // `songsPracticed` is counted here rather than trusted from the rollup: the
  // karaoke screen checkpoints progress and the player reports the play
  // independently, so whichever lands first would otherwise leave the stored
  // count one session behind. It's a single indexed count.
  const [row, practised] = await Promise.all([
    db.select().from(practiceStats).where(eq(practiceStats.userId, userId)).limit(1),
    db
      .select({ count: sql<number>`count(distinct karaoke_progress.song_id)` })
      .from(karaokeProgress)
      .where(eq(karaokeProgress.userId, userId)),
  ]).then(([rows, counted]) => [rows[0], Number(counted[0]?.count ?? 0)] as const);

  if (!row) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      songsPracticed: practised,
      totalSessions: 0,
      totalPracticeSec: 0,
      lastPracticeDate: null,
    };
  }

  // A streak only counts if it was kept up today or yesterday — otherwise the
  // dashboard would proudly display a streak the user has already broken.
  const gap = row.lastPracticeDate ? daysBetween(row.lastPracticeDate, isoDate()) : null;
  const currentStreak = gap == null || gap > 1 ? 0 : row.currentStreak;

  return {
    currentStreak,
    longestStreak: row.longestStreak,
    songsPracticed: practised,
    totalSessions: row.totalSessions,
    totalPracticeSec: row.totalPracticeSec,
    lastPracticeDate: row.lastPracticeDate,
  };
}

/** Rolling 7-day practice minutes, for the dashboard sparkline. */
export async function practiceTrend(userId: string) {
  const since = new Date(Date.now() - 7 * 86_400_000);
  /**
   * `date_format` rather than `date()`: the latter can come back as a Date object
   * depending on the driver, which would never match the ISO keys below and would
   * silently flatten the whole chart to zero.
   *
   * The column is written out rather than interpolated as `${playHistory.playedAt}`
   * because Drizzle renders a column reference *unqualified* in a MySQL select
   * list but *qualified* in GROUP BY. TiDB runs with `only_full_group_by`, which
   * then rejects the query — the two expressions have to be textually identical.
   */
  const day = sql<string>`date_format(play_history.played_at, '%Y-%m-%d')`;

  const rows = await getDb()
    .select({ day, ms: sql<number>`sum(${playHistory.msPlayed})` })
    .from(playHistory)
    .where(
      and(
        eq(playHistory.userId, userId),
        eq(playHistory.mode, "karaoke"),
        gt(playHistory.playedAt, since),
      ),
    )
    .groupBy(day);

  const byDay = new Map(rows.map((row) => [String(row.day), Number(row.ms ?? 0)]));

  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(Date.now() - (6 - offset) * 86_400_000);
    const key = isoDate(date);
    return {
      date: key,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      minutes: Math.round((byDay.get(key) ?? 0) / 60_000),
    };
  });
}
