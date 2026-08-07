import "server-only";

import { and, eq, isNull, or } from "drizzle-orm";

import { getDb, lyrics, songs } from "@/db";
import { jsonOk, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { parseLrc } from "@/lib/lrc";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Auto-fetches synced LRC lyrics from LRCLIB (https://lrclib.net) for every
 * published song that does not yet have synced lyrics.
 *
 * LRCLIB is a free, community-driven LRC lyrics database — no API key needed.
 * It covers most popular songs across Bollywood, Hollywood, K-pop and more.
 *
 * Processes up to 150 songs per call to stay within the 60-second Vercel
 * timeout. Run it multiple times to cover the full catalog.
 */

const BATCH_SIZE = 150;
const LRCLIB_BASE = "https://lrclib.net/api";

type LrclibResult = {
  id?: number;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  instrumental?: boolean;
};

async function fetchLrclib(
  artist: string,
  title: string,
  duration: number,
): Promise<LrclibResult | null> {
  const params = new URLSearchParams({
    artist_name: artist,
    track_name: title,
    ...(duration > 0 ? { duration: String(Math.round(duration)) } : {}),
  });
  try {
    const res = await fetch(`${LRCLIB_BASE}/get?${params}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { "Lrclib-Client": "SingPlay/1.0 (https://github.com/singplay)" },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as LrclibResult;
  } catch {
    return null;
  }
}

export const POST = route(async () => {
  const admin = await requireAdmin();
  const db = getDb();

  // Songs with no lyrics row yet, or a lyrics row whose synced column is NULL.
  const targets = await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      durationSec: songs.durationSec,
      lyricsId: lyrics.id,
    })
    .from(songs)
    .leftJoin(lyrics, eq(lyrics.songId, songs.id))
    .where(
      and(
        eq(songs.isPublished, true),
        or(isNull(lyrics.id), isNull(lyrics.synced)),
      ),
    )
    .limit(BATCH_SIZE);

  if (targets.length === 0) {
    return jsonOk({ processed: 0, synced: 0, plainOnly: 0, notFound: 0 });
  }

  let synced = 0;
  let plainOnly = 0;
  let notFound = 0;

  for (const song of targets) {
    const result = await fetchLrclib(song.artist, song.title, song.durationSec);

    if (!result || result.instrumental) {
      notFound++;
      // If instrumental was previously fetched and returned plain lyrics, keep it.
      continue;
    }

    const plain = result.plainLyrics?.trim() || null;
    let syncedLyrics = null;
    let format: "lrc" | "none" = "none";

    if (result.syncedLyrics?.trim()) {
      const parsed = parseLrc(result.syncedLyrics);
      if (parsed.lines.length > 0) {
        syncedLyrics = { lines: parsed.lines };
        format = "lrc";
        synced++;
      } else if (plain) {
        plainOnly++;
      } else {
        notFound++;
        continue;
      }
    } else if (plain) {
      plainOnly++;
    } else {
      notFound++;
      continue;
    }

    // Upsert into the lyrics table.
    if (song.lyricsId) {
      await db
        .update(lyrics)
        .set({ plainText: plain, synced: syncedLyrics, format, updatedBy: admin.id })
        .where(eq(lyrics.id, song.lyricsId));
    } else {
      await db.insert(lyrics).values({
        id: newId(),
        songId: song.id,
        plainText: plain,
        synced: syncedLyrics,
        format,
        updatedBy: admin.id,
      });
    }
  }

  return jsonOk({
    processed: targets.length,
    synced,
    plainOnly,
    notFound,
    message:
      targets.length === BATCH_SIZE
        ? `Processed ${BATCH_SIZE} songs — run again to continue with the rest.`
        : `All done — ${synced} synced, ${plainOnly} plain-only, ${notFound} not found.`,
  });
});
