import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getDb, songs } from "@/db";
import { jsonOk, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { normaliseItunesTrack, type ItunesTrack } from "@/lib/itunes";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Imports trending songs from the iTunes top-charts RSS feeds across 12
 * countries.
 *
 * RSS feeds carry no preview URL, so a second pass through the iTunes Lookup
 * API (batched at 100 IDs per request, run in parallel) fills in the
 * previewUrl and full metadata. Entries without a playable preview are
 * discarded. Already-imported records are skipped via the externalId unique
 * index.
 */

// ---------------------------------------------------------------------------
// Country list
// ---------------------------------------------------------------------------

const CHART_COUNTRIES = ["us", "in", "gb", "kr", "br", "au", "ca", "mx", "ng", "de", "fr", "jp"];

// Map country code → likely chart language, used to tag inserted rows.
const COUNTRY_LANGUAGE: Record<string, string> = {
  us: "English",
  in: "Hindi",
  gb: "English",
  kr: "Korean",
  br: "Portuguese",
  au: "English",
  ca: "English",
  mx: "Spanish",
  ng: "English",
  de: "German",
  fr: "French",
  jp: "Japanese",
};

// ---------------------------------------------------------------------------
// RSS feed types
// ---------------------------------------------------------------------------

type RssImage = {
  label?: string;
  attributes?: { height?: string };
};

type RssEntry = {
  "im:name"?: { label?: string };
  "im:artist"?: { label?: string };
  "im:image"?: RssImage[];
  "im:releaseDate"?: { label?: string };
  category?: { attributes?: { term?: string } };
  id?: { attributes?: { "im:id"?: string } };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EntryMeta = {
  language: string;
  genre: string | null;
  /** 500×500 cover art from the RSS feed, or null if unavailable. */
  coverUrl: string | null;
};

async function fetchChartEntries(
  country: string,
): Promise<{ id: string; meta: EntryMeta }[]> {
  const url = `https://itunes.apple.com/${country}/rss/topsongs/limit=100/json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      console.warn(`[itunes/trending] RSS ${country} → HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { feed?: { entry?: RssEntry[] } };
    const entries = data.feed?.entry ?? [];
    const language = COUNTRY_LANGUAGE[country] ?? "Unknown";

    return entries.flatMap((e) => {
      const trackId = e.id?.attributes?.["im:id"];
      if (!trackId) return [];

      const genre = e.category?.attributes?.term ?? null;

      // The last im:image entry is the largest (typically 170×170). Upgrade it
      // to 500×500 using the same Apple CDN path substitution.
      const images = e["im:image"] ?? [];
      const rawCover = images[images.length - 1]?.label ?? null;
      const coverUrl = rawCover
        ? rawCover.replace("170x170bb", "500x500bb")
        : null;

      return [{ id: trackId, meta: { language, genre, coverUrl } }];
    });
  } catch (err) {
    console.warn(`[itunes/trending] RSS ${country} failed:`, err);
    return [];
  }
}

async function lookupBatch(ids: string[]): Promise<ItunesTrack[]> {
  if (ids.length === 0) return [];
  const url = `https://itunes.apple.com/lookup?id=${ids.join(",")}&entity=song&country=us`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      console.warn(`[itunes/trending] lookup batch → HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { results?: ItunesTrack[] };
    return (data.results ?? []).filter(
      (r) => r.wrapperType === "track" && r.kind === "song" && Boolean(r.previewUrl),
    );
  } catch (err) {
    console.warn("[itunes/trending] lookup batch failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const POST = route(async () => {
  const admin = await requireAdmin();

  // 1. Fetch all 12 RSS feeds in parallel.
  const feedResults = await Promise.allSettled(
    CHART_COUNTRIES.map((country) => fetchChartEntries(country)),
  );

  // 2. Deduplicate by iTunes track ID across all countries (first-seen wins).
  const idToMeta = new Map<string, EntryMeta>();
  for (const result of feedResults) {
    if (result.status === "rejected") continue;
    for (const { id, meta } of result.value) {
      if (!idToMeta.has(id)) idToMeta.set(id, meta);
    }
  }

  if (idToMeta.size === 0) {
    return jsonOk({ total: 0, imported: 0, skipped: 0, failed: 0 });
  }

  // 3. Batch-resolve preview URLs via iTunes Lookup (100 IDs per call, parallel).
  const allIds = Array.from(idToMeta.keys());
  const batches: string[][] = [];
  for (let i = 0; i < allIds.length; i += 100) batches.push(allIds.slice(i, i + 100));

  const lookupResults = await Promise.allSettled(batches.map(lookupBatch));

  const itunesTracks: ItunesTrack[] = lookupResults.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  );

  if (itunesTracks.length === 0) {
    return jsonOk({ total: 0, imported: 0, skipped: 0, failed: 0 });
  }

  // 4. Find already-imported externalIds in one DB query.
  const db = getDb();
  const externalIds = itunesTracks.map((t) => `itunes-${t.trackId}`);

  const existing = await db
    .select({ externalId: songs.externalId })
    .from(songs)
    .where(and(eq(songs.source, "itunes"), inArray(songs.externalId, externalIds)));

  const alreadyIn = new Set(existing.map((r) => r.externalId));

  // 5. Insert new tracks one-by-one so a single failure does not abort the
  //    whole import — chart sync is best-effort.
  let imported = 0;
  let failed = 0;

  for (const track of itunesTracks) {
    const externalId = `itunes-${track.trackId}`;
    if (alreadyIn.has(externalId)) continue;

    const meta = idToMeta.get(String(track.trackId));
    const norm = normaliseItunesTrack(track);

    // Prefer the RSS feed cover (already upgraded to 500×500) when available;
    // fall back to the lookup artworkUrl100 (normaliseItunesTrack upgrades that
    // from 100×100 to 500×500 internally).
    const coverUrl = meta?.coverUrl ?? norm.coverUrl;

    try {
      await db.insert(songs).values({
        id: newId(),
        title: norm.title,
        artist: norm.artist,
        album: norm.album,
        genre: meta?.genre ?? norm.genre,
        mood: null,
        language: meta?.language ?? null,
        releaseYear: norm.releaseYear,
        decade: norm.decade,
        durationSec: norm.durationSec,
        coverUrl,
        audioUrl: norm.audioUrl,
        previewUrl: norm.audioUrl,
        source: "itunes",
        externalId,
        licenseNote: "30-second preview · iTunes Top Charts",
        isPublished: true,
        createdBy: admin.id,
      });
      imported++;
    } catch (err) {
      console.error("[itunes/trending] insert failed", externalId, err);
      failed++;
    }
  }

  // 6. Return summary.
  return jsonOk({
    total: itunesTracks.length,
    imported,
    skipped: itunesTracks.length - imported - failed,
    failed,
  });
});
