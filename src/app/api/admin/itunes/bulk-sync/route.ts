import { and, eq, inArray } from "drizzle-orm";

import { getDb, songs } from "@/db";
import { jsonOk, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { searchItunes, type NormalisedItunesTrack } from "@/lib/itunes";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Bulk-imports Indian and International songs from the iTunes Search API.
 *
 * iTunes Search is free, requires no API key, and covers the full commercial
 * catalog — Bollywood, Hollywood, Punjabi, Tamil, K-Pop, and more. Every track
 * ships with a 30-second M4A preview URL (same as what Spotify gives free
 * users) and 500×500 cover art from Apple's CDN.
 *
 * Searches run in parallel across ~12 curated queries. Results are deduplicated
 * by iTunes track ID, already-imported rows are skipped, and the rest are
 * inserted in one pass.
 */

// Each entry is [query, country, limit, language].
// "in" = Indian iTunes store. "us" = US. "kr" = Korea. "mx" = Mexico etc.
const QUERIES: [string, string, number, string][] = [
  // Hindi / Bollywood
  ["bollywood hits", "in", 50, "Hindi"],
  ["bollywood 2024", "in", 50, "Hindi"],
  ["arijit singh best", "in", 50, "Hindi"],
  ["atif aslam top songs", "in", 50, "Hindi"],
  ["shreya ghoshal hits", "in", 50, "Hindi"],
  ["hindi romantic songs", "in", 50, "Hindi"],
  ["neha kakkar hits", "in", 40, "Hindi"],
  ["kumar sanu hits", "in", 30, "Hindi"],
  // Punjabi
  ["punjabi top songs", "in", 50, "Punjabi"],
  ["ap dhillon hits", "in", 30, "Punjabi"],
  ["diljit dosanjh songs", "in", 40, "Punjabi"],
  ["sidhu moosewala", "in", 30, "Punjabi"],
  // Tamil
  ["ar rahman hits", "in", 50, "Tamil"],
  ["tamil hits 2024", "in", 40, "Tamil"],
  ["vijay sethupathi songs", "in", 30, "Tamil"],
  // Telugu
  ["telugu hits", "in", 40, "Telugu"],
  ["telugu 2024 songs", "in", 40, "Telugu"],
  ["ss rajamouli songs", "in", 30, "Telugu"],
  // Gujarati
  ["gujarati garba songs", "in", 40, "Gujarati"],
  ["falguni pathak songs", "in", 30, "Gujarati"],
  ["gujarati folk songs", "in", 30, "Gujarati"],
  // Rajasthani
  ["rajasthani folk songs", "in", 40, "Rajasthani"],
  ["rajasthani hit songs", "in", 30, "Rajasthani"],
  ["mame khan songs", "in", 20, "Rajasthani"],
  // Marathi
  ["marathi songs 2024", "in", 40, "Marathi"],
  ["marathi hit songs", "in", 30, "Marathi"],
  // Bengali
  ["bengali songs hits", "in", 40, "Bengali"],
  ["rabindra sangeet", "in", 30, "Bengali"],
  // Kannada
  ["kannada hits songs", "in", 40, "Kannada"],
  // Malayalam
  ["malayalam film songs", "in", 40, "Malayalam"],
  ["kerala hits 2024", "in", 30, "Malayalam"],
  // English — Hollywood / Global Pop
  ["hollywood movie soundtrack", "us", 40, "English"],
  ["pop hits 2024", "us", 50, "English"],
  ["the weeknd hits", "us", 30, "English"],
  ["taylor swift", "us", 30, "English"],
  ["drake hits", "us", 30, "English"],
  ["billie eilish songs", "us", 30, "English"],
  ["ed sheeran hits", "gb", 30, "English"],
  // Korean
  ["kpop hits 2024", "kr", 40, "Korean"],
  ["bts songs", "kr", 30, "Korean"],
  ["blackpink hits", "kr", 30, "Korean"],
  // Spanish / Latin
  ["reggaeton hits 2024", "mx", 40, "Spanish"],
  ["bad bunny songs", "us", 30, "Spanish"],
  ["j balvin hits", "co", 30, "Spanish"],
  // Portuguese
  ["sertanejo hits 2024", "br", 40, "Portuguese"],
];

export const POST = route(async () => {
  const admin = await requireAdmin();

  // Fire all searches in parallel — each one is an independent HTTP request.
  const batches = await Promise.allSettled(
    QUERIES.map(([query, country, limit]) => searchItunes({ query, country, limit })),
  );

  // Deduplicate across all batches by externalId, carrying the language tag.
  const seen = new Set<string>();
  const tracks: (NormalisedItunesTrack & { language: string })[] = [];
  for (let i = 0; i < batches.length; i++) {
    const result = batches[i];
    const lang = QUERIES[i][3];
    if (result.status === "rejected") continue;
    for (const track of result.value) {
      if (!seen.has(track.externalId) && track.durationSec >= 20) {
        seen.add(track.externalId);
        tracks.push({ ...track, language: lang });
      }
    }
  }

  if (tracks.length === 0) {
    return jsonOk({ total: 0, imported: 0, skipped: 0, failed: 0 });
  }

  // One DB query to find which externalIds are already present.
  const db = getDb();
  const existing = await db
    .select({ externalId: songs.externalId })
    .from(songs)
    .where(
      and(
        eq(songs.source, "itunes"),
        inArray(
          songs.externalId,
          tracks.map((t) => t.externalId),
        ),
      ),
    );

  const alreadyIn = new Set(existing.map((row) => row.externalId));
  const toInsert = tracks.filter((t) => !alreadyIn.has(t.externalId));

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
        mood: null,
        language: track.language,
        releaseYear: track.releaseYear,
        decade: track.decade,
        durationSec: track.durationSec,
        coverUrl: track.coverUrl,
        audioUrl: track.audioUrl,
        previewUrl: track.audioUrl,
        source: "itunes",
        externalId: track.externalId,
        licenseNote: track.licenseNote,
        isPublished: true,
        createdBy: admin.id,
      });
      imported++;
    } catch (error) {
      console.error("[itunes] insert failed", track.externalId, error);
      failed++;
    }
  }

  return jsonOk({
    total: tracks.length,
    imported,
    skipped: tracks.length - toInsert.length,
    failed,
  });
});
