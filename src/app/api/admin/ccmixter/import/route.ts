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
  { term: "world", genre: "World" },
  { term: "folk", genre: "Folk" },
  { term: "jazz", genre: "Jazz" },
  { term: "pop", genre: "Pop" },
  { term: "rock", genre: "Rock" },
];

type CcmixterFile = {
  file_name: string;
  download_url: string;
  file_format_info?: {
    ps?: string; // Duration in "m:ss" format
  };
};

type CcmixterTrack = {
  upload_id: number | string;
  upload_name: string;
  user_name: string;
  user_real_name?: string;
  files?: CcmixterFile[];
  license_name?: string;
  license_url?: string;
};

function parseDuration(ps: string | undefined): number {
  if (!ps) return 0;
  const [mins, secs] = ps.split(":");
  const m = parseInt(mins, 10) || 0;
  const s = parseFloat(secs) || 0;
  return Math.round(m * 60 + s);
}

async function searchCcmixter(term: string): Promise<CcmixterTrack[]> {
  const url = `${BASE}?f=json&limit=50&q=${encodeURIComponent(term)}&sort=rank,desc`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[ccmixter] search "${term}" failed:`, res.status);
      return [];
    }
    const data = await res.json();
    // ccMixter returns direct array
    const arr: unknown[] = Array.isArray(data) ? data : [];
    const tracks = arr.filter(
      (t): t is CcmixterTrack =>
        typeof t === "object" &&
        t !== null &&
        typeof (t as CcmixterTrack).upload_name === "string" &&
        Array.isArray((t as CcmixterTrack).files) &&
        (t as CcmixterTrack).files!.some((f) =>
          typeof f?.download_url === "string" && parseDuration(f?.file_format_info?.ps) > 30,
        ),
    );
    console.log(`[ccmixter] "${term}": found ${tracks.length} valid tracks out of ${arr.length}`);
    return tracks;
  } catch (err) {
    console.error(`[ccmixter] search "${term}" error:`, err);
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
      const id = String(t.upload_id);
      if (!seen.has(id)) seen.set(id, { track: t, genre });
    }
  }

  if (seen.size === 0) {
    console.log("[ccmixter/import] no tracks found across all genres");
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

    // Find the first MP3 file longer than 30s
    const mp3 = (track.files ?? []).find((f) => parseDuration(f?.file_format_info?.ps) > 30);
    if (!mp3?.download_url) continue;

    const durationSec = parseDuration(mp3.file_format_info?.ps);

    try {
      await db.insert(songs).values({
        id: newId(),
        title: (track.upload_name ?? "Untitled").slice(0, 255),
        artist: (track.user_real_name ?? track.user_name ?? "ccMixter").slice(0, 255),
        album: null,
        genre,
        mood: null,
        language: "English",
        releaseYear: null,
        decade: null,
        durationSec,
        coverUrl: null,
        audioUrl: mp3.download_url,
        previewUrl: null,
        source: "jamendo",
        externalId: externalId.slice(0, 64),
        licenseNote: `CC · ccMixter · ${track.license_name || "Creative Commons"}`,
        isPublished: true,
        createdBy: admin.id,
      });
      imported++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("1062") || msg.includes("Duplicate entry")) continue;
      console.error("[ccmixter/import] insert failed", externalId, err);
      failed++;
    }
  }

  console.log(`[ccmixter/import] imported=${imported}, failed=${failed}, skipped=${seen.size - imported - failed}`);
  return jsonOk({
    total: seen.size,
    imported,
    skipped: seen.size - imported - failed,
    failed,
  });
});
