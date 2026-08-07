import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getDb, songs } from "@/db";
import { jsonOk, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Imports FULL-LENGTH songs from the Internet Archive.
 * Great for bhajans, kirtan, Indian classical, ghazals, qawwali, and old
 * pre-1970s Bollywood recordings whose copyright has lapsed.
 * All content is free/CC-licensed.
 */

// ---------------------------------------------------------------------------
// Search queries
// ---------------------------------------------------------------------------

const SEARCHES: { q: string; lang: string; genre: string }[] = [
  // Devotional / spiritual
  { q: "subject:bhajan mediatype:audio -collection:opensource_audio", lang: "Hindi", genre: "Devotional" },
  { q: "subject:kirtan mediatype:audio", lang: "Hindi", genre: "Devotional" },
  { q: "subject:aarti mediatype:audio", lang: "Hindi", genre: "Devotional" },
  // Classical
  { q: "subject:(Indian classical music) mediatype:audio", lang: "Hindi", genre: "Classical" },
  { q: "subject:(carnatic music) mediatype:audio", lang: "Tamil", genre: "Classical" },
  { q: "subject:(hindustani music) mediatype:audio", lang: "Hindi", genre: "Classical" },
  // Old Bollywood legends
  { q: "creator:(Mohammed Rafi) mediatype:audio", lang: "Hindi", genre: "Bollywood" },
  { q: "creator:(Lata Mangeshkar) mediatype:audio", lang: "Hindi", genre: "Bollywood" },
  { q: "creator:(Kishore Kumar) mediatype:audio", lang: "Hindi", genre: "Bollywood" },
  { q: "creator:(Mukesh) mediatype:audio", lang: "Hindi", genre: "Bollywood" },
  // Ghazals & Qawwali
  { q: "subject:ghazal mediatype:audio", lang: "Hindi", genre: "Ghazal" },
  { q: "subject:qawwali mediatype:audio", lang: "Punjabi", genre: "Qawwali" },
  // Regional folk
  { q: "subject:(Rajasthani folk) mediatype:audio", lang: "Rajasthani", genre: "Folk" },
  { q: "subject:(Gujarati folk) mediatype:audio", lang: "Gujarati", genre: "Folk" },
  { q: "subject:(Bengali folk) mediatype:audio", lang: "Bengali", genre: "Folk" },
];

// ---------------------------------------------------------------------------
// Archive.org types
// ---------------------------------------------------------------------------

type ArchiveFile = {
  name: string;
  format?: string;
  title?: string;
  creator?: string;
  length?: string;
  track?: string;
  album?: string;
  size?: string;
};

type ArchiveMeta = {
  metadata?: {
    title?: string | string[];
    creator?: string | string[];
    year?: string | string[];
    album?: string | string[];
  };
  files?: ArchiveFile[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function first(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function parseDurationStr(len: string | undefined): number {
  if (!len) return 0;
  const ci = len.indexOf(":");
  if (ci >= 0) {
    const mins = parseInt(len.slice(0, ci), 10);
    const secs = parseFloat(len.slice(ci + 1));
    return Math.round(mins * 60 + secs);
  }
  return Math.round(parseFloat(len)) || 0;
}

async function searchArchive(q: string): Promise<string[]> {
  const url =
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}` +
    `&output=json&fl[]=identifier&rows=20&sort[]=downloads+desc`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { response?: { docs?: { identifier: string }[] } };
    return (data.response?.docs ?? []).map((d) => d.identifier);
  } catch {
    return [];
  }
}

async function fetchItemMeta(id: string): Promise<ArchiveMeta | null> {
  try {
    const res = await fetch(`https://archive.org/metadata/${id}`, {
      signal: AbortSignal.timeout(12_000),
    });
    return res.ok ? ((await res.json()) as ArchiveMeta) : null;
  } catch {
    return null;
  }
}

type TrackCandidate = {
  externalId: string;
  title: string;
  artist: string;
  album: string | null;
  year: number | null;
  durationSec: number;
  audioUrl: string;
  coverUrl: string;
  language: string;
  genre: string;
};

function extractTracks(
  identifier: string,
  meta: ArchiveMeta,
  lang: string,
  genre: string,
): TrackCandidate[] {
  const files = meta.files ?? [];
  const itemTitle = first(meta.metadata?.title) ?? identifier;
  const itemArtist = first(meta.metadata?.creator) ?? "Unknown";
  const itemAlbum = first(meta.metadata?.album) ?? null;
  const itemYear = parseInt(first(meta.metadata?.year) ?? "", 10) || null;
  const coverUrl = `https://archive.org/services/img/${identifier}`;

  // Accept VBR MP3, MP3, or plain .mp3 suffix. Skip low-bitrate derivatives.
  const mp3s = files.filter(
    (f) =>
      (f.format === "VBR MP3" || f.format === "MP3" || f.name.toLowerCase().endsWith(".mp3")) &&
      !f.name.includes("_64kb") &&
      !f.name.includes("_128kb") &&
      !f.name.endsWith("_files.xml") &&
      (parseDurationStr(f.length) === 0 || parseDurationStr(f.length) > 30),
  );

  return mp3s.slice(0, 8).map((f) => ({
    externalId: `archive-${identifier}-${f.name}`,
    title: f.title ?? itemTitle,
    artist: f.creator ?? itemArtist,
    album: itemAlbum,
    year: itemYear,
    durationSec: parseDurationStr(f.length),
    audioUrl: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`,
    coverUrl,
    language: lang,
    genre,
  }));
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const POST = route(async () => {
  const admin = await requireAdmin();

  // 1. Collect identifiers from all searches sequentially to respect rate limits.
  const idLang = new Map<string, { lang: string; genre: string }>();
  for (const { q, lang, genre } of SEARCHES) {
    const ids = await searchArchive(q);
    for (const id of ids) {
      if (!idLang.has(id)) idLang.set(id, { lang, genre });
    }
  }

  if (idLang.size === 0) {
    return jsonOk({ total: 0, imported: 0, skipped: 0, failed: 0 });
  }

  // 2. Fetch item metadata and collect track candidates.
  const candidates: TrackCandidate[] = [];
  for (const [identifier, { lang, genre }] of idLang) {
    const meta = await fetchItemMeta(identifier);
    if (!meta) continue;
    candidates.push(...extractTracks(identifier, meta, lang, genre));
  }

  if (candidates.length === 0) {
    return jsonOk({ total: 0, imported: 0, skipped: 0, failed: 0 });
  }

  // 3. Check which externalIds already exist.
  const db = getDb();
  const allExternalIds = candidates.map((c) => c.externalId);
  const existing = new Set<string>();
  for (let i = 0; i < allExternalIds.length; i += 500) {
    const batch = allExternalIds.slice(i, i + 500);
    const rows = await db
      .select({ externalId: songs.externalId })
      .from(songs)
      .where(and(eq(songs.source, "archive"), inArray(songs.externalId, batch)));
    for (const r of rows) if (r.externalId) existing.add(r.externalId);
  }

  // 4. Insert new tracks.
  let imported = 0;
  let failed = 0;

  for (const c of candidates) {
    if (existing.has(c.externalId)) continue;
    try {
      await db.insert(songs).values({
        id: newId(),
        title: c.title.slice(0, 255),
        artist: c.artist.slice(0, 255),
        album: c.album?.slice(0, 255) ?? null,
        genre: c.genre,
        mood: null,
        language: c.language,
        releaseYear: c.year,
        decade: c.year ? Math.floor(c.year / 10) * 10 : null,
        durationSec: c.durationSec,
        coverUrl: c.coverUrl,
        audioUrl: c.audioUrl,
        previewUrl: null,
        source: "archive",
        externalId: c.externalId.slice(0, 64),
        licenseNote: "CC · Internet Archive",
        isPublished: true,
        createdBy: admin.id,
      });
      imported++;
    } catch (err) {
      console.error("[archive/import] insert failed", c.externalId, err);
      failed++;
    }
  }

  return jsonOk({
    total: candidates.length,
    imported,
    skipped: candidates.length - imported - failed,
    failed,
  });
});
