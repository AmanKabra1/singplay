import "server-only";

import { decadeOf } from "@/lib/utils";

/**
 * iTunes Search API — completely free, no API key, covers Bollywood, Hollywood,
 * Punjabi, Tamil, Telugu, K-Pop, and every other major catalog.
 *
 * Each track comes with a 30-second preview URL (M4A) that is legal to stream
 * for discovery purposes, exactly the same as Spotify / Apple Music previews.
 * Cover art is sourced at 500×500 from Apple's CDN.
 *
 * Rate limit: ~20 requests/minute (well within what the bulk-sync calls need).
 */

const BASE = "https://itunes.apple.com";

export type ItunesTrack = {
  wrapperType: string;
  kind: string;
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
};

export type NormalisedItunesTrack = {
  externalId: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  releaseYear: number | null;
  decade: number | null;
  durationSec: number;
  audioUrl: string;
  coverUrl: string | null;
  licenseNote: string;
};

export function normaliseItunesTrack(track: ItunesTrack): NormalisedItunesTrack {
  const year = track.releaseDate ? Number(track.releaseDate.slice(0, 4)) : null;

  // Apple CDN supports arbitrary sizes — 500×500 is perfect for album art.
  const coverUrl = track.artworkUrl100
    ? track.artworkUrl100.replace("100x100bb", "500x500bb")
    : null;

  return {
    externalId: `itunes-${track.trackId}`,
    title: track.trackName,
    artist: track.artistName,
    album: track.collectionName ?? null,
    genre: track.primaryGenreName ?? null,
    releaseYear: Number.isFinite(year) ? year : null,
    decade: decadeOf(year),
    durationSec: track.trackTimeMillis ? Math.round(track.trackTimeMillis / 1000) : 30,
    audioUrl: track.previewUrl!, // 30-sec M4A — always present (filtered before calling this)
    coverUrl,
    licenseNote: "30-second preview · iTunes Store",
  };
}

/**
 * Searches the iTunes catalog and returns normalised tracks that have a
 * playable preview URL.
 *
 * @param query  iTunes search string, e.g. "bollywood hits"
 * @param country  Two-letter store country code.  Use "in" for Bollywood/Indian
 *                 stores (larger Hindi catalog) and "us" for Hollywood/English.
 * @param limit  Max results per request (iTunes caps at 200).
 */
export async function searchItunes({
  query,
  country = "in",
  limit = 50,
}: {
  query: string;
  country?: string;
  limit?: number;
}): Promise<NormalisedItunesTrack[]> {
  const url = new URL(`${BASE}/search`);
  url.searchParams.set("term", query);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("country", country);
  url.searchParams.set("limit", String(Math.min(limit, 200)));

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    console.warn("[itunes] request timed out or failed for query:", query);
    return [];
  }

  if (!response.ok) {
    console.warn("[itunes] non-OK response", response.status, "for query:", query);
    return [];
  }

  const data = (await response.json()) as { results?: ItunesTrack[] };

  return (data.results ?? [])
    .filter(
      (track) =>
        track.wrapperType === "track" &&
        track.kind === "song" &&
        Boolean(track.previewUrl), // only tracks that actually have audio
    )
    .map(normaliseItunesTrack);
}
