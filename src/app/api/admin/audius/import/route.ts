import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getDb, songs } from "@/db";
import { jsonOk, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Imports FULL-LENGTH songs from Audius (https://audius.co).
 * Audius is a decentralised music platform — artists upload directly.
 * The API is free, no key needed.  Content includes Hindi/Bollywood covers,
 * mashups, and independent artists from India and worldwide.
 *
 * Stream URL format: https://api.audius.co/v1/tracks/{id}/stream?app_name=SingPlay
 * The browser follows the redirect to the actual CDN audio file.
 */

const APP = "SingPlay";
const BASE = "https://api.audius.co/v1";

const QUERIES: { q: string; lang: string; genre: string }[] = [
  { q: "hindi songs", lang: "Hindi", genre: "Bollywood" },
  { q: "bollywood hits", lang: "Hindi", genre: "Bollywood" },
  { q: "arijit singh", lang: "Hindi", genre: "Bollywood" },
  { q: "romantic hindi", lang: "Hindi", genre: "Bollywood" },
  { q: "bhajan devotional hindi", lang: "Hindi", genre: "Devotional" },
  { q: "punjabi songs", lang: "Punjabi", genre: "Punjabi" },
  { q: "tamil songs", lang: "Tamil", genre: "Tamil" },
  { q: "indian classical music", lang: "Hindi", genre: "Classical" },
  { q: "kpop", lang: "Korean", genre: "K-Pop" },
  { q: "pop 2024", lang: "English", genre: "Pop" },
  { q: "hip hop", lang: "English", genre: "Hip Hop" },
  { q: "lofi chill", lang: "English", genre: "Electronic" },
];

type AudiusTrack = {
  id: string;
  title: string;
  duration: number;
  genre?: string;
  is_streamable?: boolean;
  is_delete?: boolean;
  user?: { name?: string; handle?: string };
  artwork?: { "480x480"?: string; "150x150"?: string };
  license?: string;
  release_date?: string;
};

async function searchAudius(query: string): Promise<AudiusTrack[]> {
  const url = `${BASE}/tracks/search?query=${encodeURIComponent(query)}&limit=20&app_name=${APP}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: AudiusTrack[] };
    return (data.data ?? []).filter(
      (t) => !t.is_delete && t.is_streamable !== false && t.duration > 30,
    );
  } catch {
    return [];
  }
}

export const POST = route(async () => {
  const admin = await requireAdmin();

  // 1. Collect all tracks across queries, deduplicate by Audius ID.
  const seen = new Map<string, { track: AudiusTrack; lang: string; genre: string }>();
  for (const { q, lang, genre } of QUERIES) {
    const tracks = await searchAudius(q);
    for (const t of tracks) {
      if (!seen.has(t.id)) seen.set(t.id, { track: t, lang, genre });
    }
  }

  if (seen.size === 0) {
    return jsonOk({ total: 0, imported: 0, skipped: 0, failed: 0 });
  }

  // 2. Skip already-imported tracks.
  const db = getDb();
  const externalIds = Array.from(seen.keys()).map((id) => `audius-${id}`);
  const existing = new Set<string>();
  for (let i = 0; i < externalIds.length; i += 500) {
    const rows = await db
      .select({ externalId: songs.externalId })
      .from(songs)
      .where(and(eq(songs.source, "audius"), inArray(songs.externalId, externalIds.slice(i, i + 500))));
    for (const r of rows) if (r.externalId) existing.add(r.externalId);
  }

  // 3. Insert new tracks.
  let imported = 0;
  let failed = 0;

  for (const [audiusId, { track, lang, genre }] of seen) {
    const externalId = `audius-${audiusId}`;
    if (existing.has(externalId)) continue;

    const artist = track.user?.name ?? track.user?.handle ?? "Unknown";
    const coverUrl = track.artwork?.["480x480"] ?? track.artwork?.["150x150"] ?? null;
    const audioUrl = `${BASE}/tracks/${audiusId}/stream?app_name=${APP}`;
    const year = track.release_date ? parseInt(track.release_date.slice(0, 4), 10) || null : null;

    try {
      await db.insert(songs).values({
        id: newId(),
        title: track.title.slice(0, 255),
        artist: artist.slice(0, 255),
        album: null,
        genre: track.genre ?? genre,
        mood: null,
        language: lang,
        releaseYear: year,
        decade: year ? Math.floor(year / 10) * 10 : null,
        durationSec: Math.round(track.duration),
        coverUrl,
        audioUrl,
        previewUrl: null,
        source: "audius",
        externalId: externalId.slice(0, 64),
        licenseNote: `Free stream · Audius · ${track.license ?? "artist-set license"}`,
        isPublished: true,
        createdBy: admin.id,
      });
      imported++;
    } catch (err) {
      console.error("[audius/import] insert failed", externalId, err);
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
