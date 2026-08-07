import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getDb, songs } from "@/db";
import { jsonOk, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Imports full-length CC-licensed songs from Openverse (api.openverse.org).
 * Openverse is the WordPress Foundation's open-content search engine — it
 * aggregates Jamendo, Wikimedia, FreeSound and more into one API.
 * No API key required for up to 100 requests/day (anonymous tier).
 * The `url` field is a DIRECT full-length audio stream — no redirect.
 */

const BASE = "https://api.openverse.org/v1/audio";

// Licenses that are safe to use freely
const OPEN_LICENSES = "by,by-sa,cc0,by-nc,by-nd,by-nc-sa,by-nc-nd,pdm";

const QUERIES: { q: string; lang: string; genre: string }[] = [
  { q: "hindi song", lang: "Hindi", genre: "World" },
  { q: "bhajan", lang: "Hindi", genre: "Devotional" },
  { q: "indian classical", lang: "Hindi", genre: "Classical" },
  { q: "bollywood", lang: "Hindi", genre: "Bollywood" },
  { q: "punjabi folk", lang: "Punjabi", genre: "Folk" },
  { q: "rajasthani folk", lang: "Rajasthani", genre: "Folk" },
  { q: "world music", lang: "English", genre: "World" },
  { q: "pop", lang: "English", genre: "Pop" },
  { q: "jazz", lang: "English", genre: "Jazz" },
  { q: "electronic", lang: "English", genre: "Electronic" },
];

type OpenverseTrack = {
  id: string;
  title: string;
  creator?: string;
  url: string;
  thumbnail?: string;
  duration?: number;
  license?: string;
  license_url?: string;
  source?: string;
  genres?: string[];
  tags?: { name: string }[];
};

async function searchOpenverse(q: string): Promise<OpenverseTrack[]> {
  const url =
    `${BASE}/?q=${encodeURIComponent(q)}&page_size=20&license=${OPEN_LICENSES}` +
    `&mature=false&unstable__include_sensitive_results=false`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: "application/json",
        "User-Agent": "SingPlay/1.0 (+https://singplay.app)",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: OpenverseTrack[] };
    // Only keep tracks with a real audio URL (not empty or placeholder)
    return (data.results ?? []).filter(
      (t) => t.url && t.url.startsWith("http") && (t.duration ?? 0) > 30_000,
    );
  } catch {
    return [];
  }
}

export const POST = route(async () => {
  const admin = await requireAdmin();

  // 1. Gather tracks, deduplicate by Openverse UUID.
  const seen = new Map<string, { track: OpenverseTrack; lang: string; genre: string }>();
  for (const { q, lang, genre } of QUERIES) {
    const tracks = await searchOpenverse(q);
    for (const t of tracks) {
      if (!seen.has(t.id)) seen.set(t.id, { track: t, lang, genre });
    }
  }

  if (seen.size === 0) {
    return jsonOk({ total: 0, imported: 0, skipped: 0, failed: 0 });
  }

  // 2. Skip already-imported.
  const db = getDb();
  const externalIds = Array.from(seen.keys()).map((id) => `openverse-${id}`);
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

  for (const [ovId, { track, lang, genre }] of seen) {
    const externalId = `openverse-${ovId}`;
    if (existing.has(externalId)) continue;

    // Duration from Openverse is in milliseconds
    const durationSec = track.duration ? Math.round(track.duration / 1000) : 0;
    const trackGenre = track.genres?.[0] ?? genre;

    try {
      await db.insert(songs).values({
        id: newId(),
        title: track.title.slice(0, 255),
        artist: (track.creator ?? "Unknown").slice(0, 255),
        album: null,
        genre: trackGenre,
        mood: null,
        language: lang,
        releaseYear: null,
        decade: null,
        durationSec,
        coverUrl: track.thumbnail ?? null,
        audioUrl: track.url,
        previewUrl: null,
        source: "jamendo",   // Openverse aggregates CC music — same license class as Jamendo
        externalId: externalId.slice(0, 64),
        licenseNote: `CC · Openverse${track.source ? ` via ${track.source}` : ""} · ${track.license ?? "open"}`,
        isPublished: true,
        createdBy: admin.id,
      });
      imported++;
    } catch (err) {
      console.error("[openverse/import] insert failed", externalId, err);
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
