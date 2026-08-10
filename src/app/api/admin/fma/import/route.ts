import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getDb, songs } from "@/db";
import { jsonOk, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Imports full-length CC-licensed tracks from Free Music Archive via Archive.org.
 * FMA hosts ~100k indie, folk, electronic, jazz, and world music tracks.
 * We reach them through the Archive.org API (no FMA API key needed).
 */

const SEARCHES: { q: string; genre: string; lang: string }[] = [
  { q: "collection:freemusicarchive subject:Electronic", genre: "Electronic", lang: "English" },
  { q: "collection:freemusicarchive subject:Folk", genre: "Folk", lang: "English" },
  { q: "collection:freemusicarchive subject:Jazz", genre: "Jazz", lang: "English" },
  { q: "collection:freemusicarchive subject:Pop", genre: "Pop", lang: "English" },
  { q: "collection:freemusicarchive subject:Rock", genre: "Rock", lang: "English" },
  { q: "collection:freemusicarchive subject:Hip-Hop", genre: "Hip Hop", lang: "English" },
  { q: "collection:freemusicarchive subject:Ambient", genre: "Ambient", lang: "English" },
  { q: "collection:freemusicarchive subject:World", genre: "World", lang: "English" },
  { q: "collection:freemusicarchive subject:Classical", genre: "Classical", lang: "English" },
  { q: "collection:freemusicarchive subject:Indie", genre: "Indie", lang: "English" },
];

type ArchiveFile = {
  name: string;
  format?: string;
  title?: string;
  creator?: string;
  length?: string;
  album?: string;
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

function first(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function parseDuration(len: string | undefined): number {
  if (!len) return 0;
  const ci = len.indexOf(":");
  if (ci >= 0) {
    const mins = parseInt(len.slice(0, ci), 10);
    const secs = parseFloat(len.slice(ci + 1));
    return Math.round(mins * 60 + secs);
  }
  return Math.round(parseFloat(len)) || 0;
}

function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, "0");
}

async function searchArchive(q: string): Promise<string[]> {
  const url =
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}` +
    `+mediatype:audio&output=json&fl[]=identifier&rows=15&sort[]=downloads+desc`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { response?: { docs?: { identifier: string }[] } };
    return (data.response?.docs ?? []).map((d) => d.identifier);
  } catch {
    return [];
  }
}

async function fetchMeta(id: string): Promise<ArchiveMeta | null> {
  try {
    const res = await fetch(`https://archive.org/metadata/${id}`, {
      signal: AbortSignal.timeout(12_000),
    });
    return res.ok ? ((await res.json()) as ArchiveMeta) : null;
  } catch {
    return null;
  }
}

export const POST = route(async () => {
  const admin = await requireAdmin();

  // 1. Collect identifiers from all genre searches.
  const identifierSet = new Set<string>();
  const identifierMeta = new Map<string, { genre: string; lang: string }>();

  for (const { q, genre, lang } of SEARCHES) {
    const ids = await searchArchive(q);
    for (const id of ids) {
      if (!identifierSet.has(id)) {
        identifierSet.add(id);
        identifierMeta.set(id, { genre, lang });
      }
    }
  }

  // 2. Fetch metadata + extract MP3 tracks.
  type Candidate = {
    externalId: string;
    title: string;
    artist: string;
    durationSec: number;
    audioUrl: string;
    coverUrl: string;
    genre: string;
    lang: string;
    year: number | null;
  };

  const candidates: Candidate[] = [];

  for (const identifier of identifierSet) {
    const { genre, lang } = identifierMeta.get(identifier)!;
    const meta = await fetchMeta(identifier);
    if (!meta) continue;

    const itemTitle = first(meta.metadata?.title) ?? identifier;
    const itemArtist = first(meta.metadata?.creator) ?? "Unknown";
    const itemYear = parseInt(first(meta.metadata?.year) ?? "", 10) || null;
    const coverUrl = `https://archive.org/services/img/${identifier}`;

    const mp3s = (meta.files ?? []).filter(
      (f) =>
        (f.format === "VBR MP3" || f.format === "MP3" || f.name.toLowerCase().endsWith(".mp3")) &&
        !f.name.includes("_64kb") &&
        !f.name.includes("_128kb") &&
        (parseDuration(f.length) === 0 || parseDuration(f.length) > 30),
    );

    for (const f of mp3s.slice(0, 6)) {
      candidates.push({
        externalId: `fma-${identifier.slice(0, 25)}-${shortHash(f.name)}`,
        title: (f.title ?? itemTitle).slice(0, 255),
        artist: (f.creator ?? itemArtist).slice(0, 255),
        durationSec: parseDuration(f.length),
        audioUrl: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`,
        coverUrl,
        genre,
        lang,
        year: itemYear,
      });
    }
  }

  if (candidates.length === 0) {
    return jsonOk({ total: 0, imported: 0, skipped: 0, failed: 0 });
  }

  // 3. Skip already-imported.
  const db = getDb();
  const externalIds = candidates.map((c) => c.externalId);
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

  // 4. Insert.
  let imported = 0;
  let failed = 0;

  for (const c of candidates) {
    if (existing.has(c.externalId)) continue;
    try {
      await db.insert(songs).values({
        id: newId(),
        title: c.title,
        artist: c.artist,
        album: null,
        genre: c.genre,
        mood: null,
        language: c.lang,
        releaseYear: c.year,
        decade: c.year ? Math.floor(c.year / 10) * 10 : null,
        durationSec: c.durationSec,
        coverUrl: c.coverUrl,
        audioUrl: c.audioUrl,
        previewUrl: null,
        source: "archive",
        externalId: c.externalId,
        licenseNote: "CC · Free Music Archive via Internet Archive",
        isPublished: true,
        createdBy: admin.id,
      });
      imported++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("1062") || msg.includes("Duplicate entry")) continue;
      console.error("[fma/import] insert failed", c.externalId, err);
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
