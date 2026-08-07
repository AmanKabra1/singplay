import "server-only";

import { ApiError } from "@/lib/api/http";
import { env } from "@/lib/env";
import { decadeOf } from "@/lib/utils";

/**
 * Jamendo v3 API — a catalog of Creative Commons licensed music that is legal
 * to stream and to redistribute under each track's licence. This is the
 * "Option A" source from the brief; commercial chart music would need a
 * licensed provider such as the Spotify Web Playback SDK instead.
 */

const BASE = "https://api.jamendo.com/v3.0";

export type JamendoTrack = {
  id: string;
  name: string;
  artist_name: string;
  album_name?: string;
  duration: number;
  releasedate?: string;
  audio: string;
  audiodownload?: string;
  image?: string;
  album_image?: string;
  license_ccurl?: string;
  musicinfo?: { tags?: { genres?: string[]; vartags?: string[] } };
};

export type NormalisedTrack = {
  externalId: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  mood: string | null;
  releaseYear: number | null;
  decade: number | null;
  durationSec: number;
  audioUrl: string;
  coverUrl: string | null;
  licenseNote: string;
};

export function jamendoEnabled() {
  return Boolean(env.jamendo.clientId);
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function normaliseTrack(track: JamendoTrack): NormalisedTrack {
  const year = track.releasedate ? Number(track.releasedate.slice(0, 4)) : null;
  const genres = track.musicinfo?.tags?.genres ?? [];
  const vartags = track.musicinfo?.tags?.vartags ?? [];

  return {
    externalId: String(track.id),
    title: track.name,
    artist: track.artist_name,
    album: track.album_name || null,
    genre: genres[0] ? titleCase(genres[0]) : null,
    mood: vartags[0] ? titleCase(vartags[0]) : null,
    releaseYear: Number.isFinite(year) ? year : null,
    decade: decadeOf(year),
    durationSec: Math.round(track.duration || 0),
    audioUrl: track.audio,
    coverUrl: track.album_image || track.image || null,
    licenseNote: track.license_ccurl
      ? `Creative Commons — ${track.license_ccurl}`
      : "Creative Commons (Jamendo)",
  };
}

type SearchParams = {
  query?: string;
  tag?: string;
  order?: "popularity_total" | "releasedate_desc" | "downloads_total";
  limit?: number;
  offset?: number;
};

async function call(path: string, params: Record<string, string>) {
  if (!env.jamendo.clientId) {
    throw new ApiError(
      501,
      "jamendo_not_configured",
      "The Jamendo catalog isn't connected on this deployment. Add JAMENDO_CLIENT_ID to enable it.",
    );
  }

  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("client_id", env.jamendo.clientId);
  url.searchParams.set("format", "json");
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      // Catalog data changes slowly; an hour of caching keeps us well inside
      // Jamendo's free rate limit.
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(
      504,
      "jamendo_unreachable",
      "Couldn't reach the Jamendo catalog. Try again in a moment.",
    );
  }

  if (!response.ok) {
    throw new ApiError(
      502,
      "jamendo_error",
      `The Jamendo catalog returned an error (${response.status}).`,
    );
  }

  const body = (await response.json()) as {
    headers?: { status?: string; error_message?: string };
    results?: JamendoTrack[];
  };

  if (body.headers?.status === "failed") {
    throw new ApiError(
      502,
      "jamendo_error",
      body.headers.error_message || "The Jamendo catalog rejected that request.",
    );
  }

  return body.results ?? [];
}

export async function searchJamendo({
  query,
  tag,
  order = "popularity_total",
  limit = 24,
  offset = 0,
}: SearchParams) {
  const results = await call("/tracks/", {
    limit: String(Math.min(limit, 200)),
    offset: String(offset),
    order,
    include: "musicinfo+licenses",
    audioformat: "mp32",
    // Instrumental-friendly and streamable only.
    ...(query ? { namesearch: query } : {}),
    ...(tag ? { tags: tag } : {}),
  });
  return results.map(normaliseTrack);
}

export async function getJamendoTrack(id: string) {
  const [track] = await call("/tracks/", {
    id,
    include: "musicinfo+licenses",
    audioformat: "mp32",
  });
  return track ? normaliseTrack(track) : null;
}
