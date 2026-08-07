import { and, eq, inArray } from "drizzle-orm";

import { getDb, songs } from "@/db";
import { jsonOk, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { jamendoEnabled, searchJamendo, type NormalisedTrack } from "@/lib/jamendo";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * One-click catalog population (brief §3.7, Option A).
 *
 * Fetches the top tracks from Jamendo across multiple genres and orderings,
 * deduplicates them, skips anything already imported, and bulk-inserts the rest.
 * A single POST call can seed 200+ real, playable CC-licensed tracks so the home
 * page shelves look like an actual music service rather than a demo with 6 songs.
 */

const GENRE_TAGS = [
  "electronic",
  "jazz",
  "folk",
  "soul",
  "rock",
  "pop",
  "classical",
  "hiphop",
];

export const POST = route(async () => {
  const admin = await requireAdmin();

  if (!jamendoEnabled()) {
    return jsonOk({
      error: "Jamendo not configured — add JAMENDO_CLIENT_ID to .env.local",
      imported: 0,
      skipped: 0,
      failed: 0,
      total: 0,
    });
  }

  // Fetch from multiple sources concurrently: popular overall, newest releases,
  // and top tracks per genre. Each call returns up to 200 tracks from one API
  // request — far faster than calling getJamendoTrack() per-song.
  const batches = await Promise.allSettled([
    searchJamendo({ order: "popularity_total", limit: 50 }),
    searchJamendo({ order: "releasedate_desc", limit: 50 }),
    ...GENRE_TAGS.map((tag) => searchJamendo({ tag, order: "popularity_total", limit: 25 })),
  ]);

  // Collect all tracks, deduplicate by Jamendo externalId.
  const seen = new Set<string>();
  const tracks: NormalisedTrack[] = [];
  for (const result of batches) {
    if (result.status === "rejected") continue;
    for (const track of result.value) {
      if (track.durationSec < 30) continue; // skip jingles / intros
      if (!seen.has(track.externalId)) {
        seen.add(track.externalId);
        tracks.push(track);
      }
    }
  }

  if (tracks.length === 0) {
    return jsonOk({ imported: 0, skipped: 0, failed: 0, total: 0 });
  }

  // Single query to find which externalIds are already in the DB.
  const db = getDb();
  const existing = await db
    .select({ externalId: songs.externalId })
    .from(songs)
    .where(
      and(
        eq(songs.source, "jamendo"),
        inArray(
          songs.externalId,
          tracks.map((t) => t.externalId),
        ),
      ),
    );

  const alreadyIn = new Set(existing.map((row) => row.externalId));

  const toInsert = tracks.filter((t) => !alreadyIn.has(t.externalId));
  const skipped = tracks.length - toInsert.length;

  let imported = 0;
  let failed = 0;

  for (const track of toInsert) {
    try {
      await db.insert(songs).values({
        id: newId(),
        title: track.title,
        artist: track.artist,
        album: track.album,
        genre: track.genre,
        mood: track.mood,
        releaseYear: track.releaseYear,
        decade: track.decade,
        durationSec: track.durationSec,
        coverUrl: track.coverUrl,
        audioUrl: track.audioUrl,
        previewUrl: null,
        source: "jamendo",
        externalId: track.externalId,
        licenseNote: track.licenseNote,
        isPublished: true,
        createdBy: admin.id,
      });
      imported++;
    } catch (error) {
      console.error("[bulk-sync] insert failed", track.externalId, error);
      failed++;
    }
  }

  return jsonOk({
    total: tracks.length,
    imported,
    skipped,
    failed,
  });
});
