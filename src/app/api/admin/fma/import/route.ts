import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getDb, songs } from "@/db";
import { jsonOk, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Imports full-length CC-licensed music from Free Music Archive (FMA).
 * FMA has ~100k tracks across indie, folk, electronic, jazz, world music.
 * No API key needed for read access.
 * https://freemusicarchive.org/
 */

const BASE = "https://freemusicarchive.org/api/get";

// FMA genre IDs (curated for quality + variety)
const GENRE_IDS = [
  "Indie Pop",
  "Electronic",
  "Ambient",
  "Lo-Fi",
  "Hip-Hop",
  "Folk",
  "World",
  "Jazz",
  "Pop",
  "Rock",
];

type FmaTrack = {
  track_id: string;
  track_title: string;
  artist_name?: string;
  track_duration?: number;
  track_file?: string;
  track_image_file?: string;
  license_title?: string;
};

type FmaResponse = {
  dataset?: FmaTrack[];
};

async function searchFma(genre: string): Promise<FmaTrack[]> {
  const url =
    `${BASE}/songs.json?limit=30&sort=date_created&` +
    `genre_tag=${encodeURIComponent(genre)}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as FmaResponse;
    return (data.dataset ?? []).filter(
      (t) => t.track_file && (t.track_duration ?? 0) > 30,
    );
  } catch {
    return [];
  }
}

export const POST = route(async () => {
  const admin = await requireAdmin();

  // 1. Gather tracks from all genres, deduplicate by FMA ID.
  const seen = new Map<string, { track: FmaTrack; genre: string }>();
  for (const genre of GENRE_IDS) {
    const tracks = await searchFma(genre);
    for (const t of tracks) {
      if (!seen.has(t.track_id)) seen.set(t.track_id, { track: t, genre });
    }
  }

  if (seen.size === 0) {
    return jsonOk({ total: 0, imported: 0, skipped: 0, failed: 0 });
  }

  // 2. Skip already-imported.
  const db = getDb();
  const externalIds = Array.from(seen.keys()).map((id) => `fma-${id}`);
  const existing = new Set<string>();
  for (let i = 0; i < externalIds.length; i += 500) {
    const rows = await db
      .select({ externalId: songs.externalId })
      .from(songs)
      .where(
        and(
          eq(songs.source, "jamendo"),
          inArray(songs.externalId, externalIds.slice(i, i + 500)),
        ),
      );
    for (const r of rows) if (r.externalId) existing.add(r.externalId);
  }

  // 3. Insert.
  let imported = 0;
  let failed = 0;

  for (const [fmaId, { track, genre }] of seen) {
    const externalId = `fma-${fmaId}`;
    if (existing.has(externalId)) continue;

    const durationSec = track.track_duration ?? 0;

    try {
      await db.insert(songs).values({
        id: newId(),
        title: track.track_title.slice(0, 255),
        artist: (track.artist_name ?? "Free Music Archive").slice(0, 255),
        album: null,
        genre,
        mood: null,
        language: "English",
        releaseYear: null,
        decade: null,
        durationSec,
        coverUrl: track.track_image_file ?? null,
        audioUrl: track.track_file,
        previewUrl: null,
        source: "jamendo",
        externalId: externalId.slice(0, 64),
        licenseNote: `CC · Free Music Archive · ${track.license_title ?? "Creative Commons"}`,
        isPublished: true,
        createdBy: admin.id,
      });
      imported++;
    } catch (err) {
      console.error("[fma/import] insert failed", externalId, err);
      failed++;
    }
  }

  return jsonOk({
    total: seen.size,
    imported,
    skipped: seen.size - imported - failed,
    failed,
  });
});
