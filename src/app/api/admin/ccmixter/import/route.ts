import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getDb, songs } from "@/db";
import { jsonOk, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Imports full-length CC-licensed music from ccMixter.
 * ccMixter hosts remixes and original compositions — all CC-licensed, no API key needed.
 * https://ccmixter.org/
 */

const BASE = "https://ccmixter.org/api/query";

const QUERIES = [
  { term: "electronic", genre: "Electronic" },
  { term: "ambient", genre: "Ambient" },
  { term: "lo-fi", genre: "Lo-Fi" },
  { term: "indie", genre: "Indie" },
  { term: "hip hop", genre: "Hip Hop" },
  { term: "world music", genre: "World" },
  { term: "folk", genre: "Folk" },
  { term: "jazz", genre: "Jazz" },
  { term: "pop", genre: "Pop" },
  { term: "rock", genre: "Rock" },
];

type CcmixterTrack = {
  upload_id: string;
  name: string;
  artist_name?: string;
  duration?: number;
  download_url?: string;
  image_url?: string;
  license_url?: string;
};

async function searchCcmixter(term: string): Promise<CcmixterTrack[]> {
  const url = `${BASE}?f=json&limit=30&t=download&q=${encodeURIComponent(term)}&sort=created,desc`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { result?: CcmixterTrack[] };
    return (data.result ?? []).filter((t) => t.download_url && (t.duration ?? 0) > 30);
  } catch {
    return [];
  }
}

export const POST = route(async () => {
  const admin = await requireAdmin();

  // 1. Gather tracks from all queries, deduplicate by ccMixter ID.
  const seen = new Map<string, { track: CcmixterTrack; genre: string }>();
  for (const { term, genre } of QUERIES) {
    const tracks = await searchCcmixter(term);
    for (const t of tracks) {
      if (!seen.has(t.upload_id)) seen.set(t.upload_id, { track: t, genre });
    }
  }

  if (seen.size === 0) {
    return jsonOk({ total: 0, imported: 0, skipped: 0, failed: 0 });
  }

  // 2. Skip already-imported.
  const db = getDb();
  const externalIds = Array.from(seen.keys()).map((id) => `ccmixter-${id}`);
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

  for (const [ccId, { track, genre }] of seen) {
    const externalId = `ccmixter-${ccId}`;
    if (existing.has(externalId)) continue;

    const durationSec = track.duration ? Math.round(track.duration / 1000) : 0;

    try {
      await db.insert(songs).values({
        id: newId(),
        title: track.name.slice(0, 255),
        artist: (track.artist_name ?? "ccMixter").slice(0, 255),
        album: null,
        genre,
        mood: null,
        language: "English",
        releaseYear: null,
        decade: null,
        durationSec,
        coverUrl: track.image_url ?? null,
        audioUrl: track.download_url,
        previewUrl: null,
        source: "jamendo",
        externalId: externalId.slice(0, 64),
        licenseNote: `CC · ccMixter · ${track.license_url ? "Licensed" : "Creative Commons"}`,
        isPublished: true,
        createdBy: admin.id,
      });
      imported++;
    } catch (err) {
      console.error("[ccmixter/import] insert failed", externalId, err);
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
