import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getDb, songs } from "@/db";
import { jsonOk, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Imports CC-licensed audio from Openverse.
 * Openverse indexes ~2M CC audio files from multiple platforms.
 * https://openverse.org/
 */

const BASE = "https://api.openverse.org/v1/audio";

const SEARCHES = [
  "music indie",
  "music ambient",
  "music electronic",
  "music folk",
  "music jazz",
  "music world",
  "music classical",
  "music pop",
  "music rock",
  "music hip hop",
];

type OpenverseAudio = {
  id: string;
  title: string;
  creator: string;
  duration: number | null;
  url?: string;
  download_url?: string;
  thumbnail?: string;
  license: string;
  license_url?: string;
};

async function searchOpenverse(query: string): Promise<OpenverseAudio[]> {
  const params = new URLSearchParams({
    q: query,
    filter_dead: "true",
    license_type: "commercial,modification",
    sort_by: "recency",
    page_size: "50",
  });

  const url = `${BASE}?${params.toString()}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: OpenverseAudio[] };
    return (data.results ?? []).filter(
      (a) =>
        a.download_url &&
        (a.duration === null || a.duration === 0 || a.duration > 30) &&
        a.title &&
        a.creator,
    );
  } catch {
    return [];
  }
}

export const POST = route(async () => {
  const admin = await requireAdmin();

  // 1. Gather tracks from all searches, deduplicate by Openverse ID.
  const seen = new Map<string, OpenverseAudio>();
  for (const query of SEARCHES) {
    const tracks = await searchOpenverse(query);
    for (const t of tracks) {
      if (!seen.has(t.id)) seen.set(t.id, t);
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
          eq(songs.source, "archive"),
          inArray(songs.externalId, externalIds.slice(i, i + 500)),
        ),
      );
    for (const r of rows) if (r.externalId) existing.add(r.externalId);
  }

  // 3. Insert.
  let imported = 0;
  let failed = 0;

  for (const [ovId, track] of seen) {
    const externalId = `openverse-${ovId}`;
    if (existing.has(externalId)) continue;

    try {
      await db.insert(songs).values({
        id: newId(),
        title: (track.title ?? "Untitled").slice(0, 255),
        artist: (track.creator ?? "Unknown").slice(0, 255),
        album: null,
        genre: "Indie",
        mood: null,
        language: "English",
        releaseYear: null,
        decade: null,
        durationSec: track.duration ?? 0,
        coverUrl: track.thumbnail ?? null,
        audioUrl: track.download_url ?? "",
        previewUrl: null,
        source: "archive",
        externalId: externalId.slice(0, 64),
        licenseNote: `CC · Openverse · ${track.license}`,
        isPublished: true,
        createdBy: admin.id,
      });
      imported++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("1062") || msg.includes("Duplicate entry")) continue;
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
