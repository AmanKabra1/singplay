import "server-only";

import { eq, inArray } from "drizzle-orm";

import {
  authTokens,
  djSessions,
  favorites,
  getDb,
  karaokeProgress,
  lyrics,
  playHistory,
  playlistItems,
  playlists,
  practiceStats,
  searchLog,
  songs,
  users,
} from "@/db";

/**
 * Application-level cascades.
 *
 * The schema declares no foreign keys (see `schema.ts` header), so deletions
 * clean up their dependents here. Kept in one file so it is obvious what must
 * be extended whenever a new table references a user or a song.
 */

export async function deleteSongCascade(songId: string) {
  const db = getDb();
  await Promise.all([
    db.delete(lyrics).where(eq(lyrics.songId, songId)),
    db.delete(playlistItems).where(eq(playlistItems.songId, songId)),
    db.delete(favorites).where(eq(favorites.songId, songId)),
    db.delete(playHistory).where(eq(playHistory.songId, songId)),
    db.delete(karaokeProgress).where(eq(karaokeProgress.songId, songId)),
  ]);
  await db.delete(songs).where(eq(songs.id, songId));
}

export async function deletePlaylistCascade(playlistId: string) {
  const db = getDb();
  await db.delete(playlistItems).where(eq(playlistItems.playlistId, playlistId));
  await db.delete(playlists).where(eq(playlists.id, playlistId));
}

export async function deleteUserCascade(userId: string) {
  const db = getDb();

  const owned = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(eq(playlists.userId, userId));

  if (owned.length > 0) {
    await db.delete(playlistItems).where(
      inArray(
        playlistItems.playlistId,
        owned.map((p) => p.id),
      ),
    );
  }

  await Promise.all([
    db.delete(playlists).where(eq(playlists.userId, userId)),
    db.delete(favorites).where(eq(favorites.userId, userId)),
    db.delete(playHistory).where(eq(playHistory.userId, userId)),
    db.delete(karaokeProgress).where(eq(karaokeProgress.userId, userId)),
    db.delete(practiceStats).where(eq(practiceStats.userId, userId)),
    db.delete(authTokens).where(eq(authTokens.userId, userId)),
    db.delete(djSessions).where(eq(djSessions.userId, userId)),
    db.delete(searchLog).where(eq(searchLog.userId, userId)),
  ]);

  await db.delete(users).where(eq(users.id, userId));
}
