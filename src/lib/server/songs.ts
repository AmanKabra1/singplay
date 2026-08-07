import "server-only";

import {
  and,
  desc,
  eq,
  gte,
  inArray,
  lt,
  or,
  sql,
  type Column,
  type SQL,
} from "drizzle-orm";

import { favorites, getDb, lyrics, songs } from "@/db";
import { ApiError } from "@/lib/api/http";
import type { BrowseSection, LyricsDTO, Paginated, SongDTO } from "@/lib/types";

/**
 * Read side of the catalog.
 *
 * Every query funnels through `selectSongs` so the DTO shape — including the
 * "does this track have synced lyrics" and "has this user favourited it" flags —
 * is produced in exactly one place. Both flags come from LEFT JOINs rather than
 * follow-up queries, which keeps a 24-card grid at a single round trip.
 */

/** `userId` is joined against even for guests; "" simply matches no rows. */
const NO_USER = "";

const projection = {
  id: songs.id,
  title: songs.title,
  artist: songs.artist,
  album: songs.album,
  genre: songs.genre,
  mood: songs.mood,
  language: songs.language,
  releaseYear: songs.releaseYear,
  decade: songs.decade,
  durationSec: songs.durationSec,
  coverUrl: songs.coverUrl,
  audioUrl: songs.audioUrl,
  previewUrl: songs.previewUrl,
  source: songs.source,
  bpm: songs.bpm,
  musicalKey: songs.musicalKey,
  notes: songs.notes,
  credits: songs.credits,
  licenseNote: songs.licenseNote,
  playCount: songs.playCount,
  isPublished: songs.isPublished,
  createdAt: songs.createdAt,
  lyricFormat: lyrics.format,
  favoriteId: favorites.id,
} as const;

/** The exact row shape `baseQuery` yields — kept in sync by inference, not by hand. */
type Row = Awaited<ReturnType<typeof baseQuery>>[number];

export type SongQuery = {
  q?: string;
  genre?: string;
  mood?: string;
  language?: string;
  decade?: number;
  artist?: string;
  album?: string;
  /** Restricts a text search to one field. `lyrics` searches the lyric body. */
  scope?: "all" | "title" | "artist" | "lyrics";
  sort?: "new" | "popular" | "title" | "artist";
  limit?: number;
  offset?: number;
  /** Admin listings pass false to see drafts too. */
  publishedOnly?: boolean;
  ids?: string[];
};

/** `%` and `_` are LIKE wildcards — a user typing them means the literal char. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Case-insensitive "contains" match.
 *
 * TiDB defaults to the `utf8mb4_bin` collation, which makes `LIKE`
 * case-sensitive — unlike MySQL's own default. Without folding case on both
 * sides, searching "midnight" would silently fail to find "Midnight Signal",
 * and lowercase queries would only ever match lowercase text. A `%term%`
 * pattern can't use an index either way, so `lower()` costs nothing here.
 */
function contains(column: Column, term: string) {
  return sql`lower(${column}) like ${`%${escapeLike(term.toLowerCase())}%`}`;
}

function conditions(query: SongQuery): SQL[] {
  const where: SQL[] = [];

  if (query.publishedOnly !== false) where.push(eq(songs.isPublished, true));
  if (query.genre) where.push(eq(songs.genre, query.genre));
  if (query.mood) where.push(eq(songs.mood, query.mood));
  if (query.language) where.push(eq(songs.language, query.language));
  if (query.artist) where.push(eq(songs.artist, query.artist));
  if (query.album) where.push(eq(songs.album, query.album));
  if (query.ids?.length) where.push(inArray(songs.id, query.ids));

  if (query.decade != null) {
    // "Old classics" is everything before the 1970s, expressed as decade 0.
    if (query.decade === 0) where.push(lt(songs.decade, 1970));
    else where.push(eq(songs.decade, query.decade));
  }

  const term = query.q?.trim();
  if (term) {
    const scope = query.scope ?? "all";
    if (scope === "title") where.push(contains(songs.title, term));
    else if (scope === "artist") where.push(contains(songs.artist, term));
    else if (scope === "lyrics") where.push(contains(lyrics.plainText, term));
    else {
      where.push(
        or(
          contains(songs.title, term),
          contains(songs.artist, term),
          contains(songs.album, term),
          contains(lyrics.plainText, term),
        )!,
      );
    }
  }

  return where;
}

function ordering(sort: SongQuery["sort"]) {
  switch (sort) {
    case "popular":
      return [desc(songs.playCount), desc(songs.createdAt)];
    case "title":
      return [songs.title];
    case "artist":
      return [songs.artist, songs.title];
    default:
      return [desc(songs.createdAt)];
  }
}

export function toSongDTO(row: Row, isAuthenticated: boolean): SongDTO {
  // Guests are only ever handed the preview source. The client caps playback at
  // 30 seconds as well, but the URL itself is the boundary that actually matters.
  const preview = row.previewUrl ?? row.audioUrl;
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    genre: row.genre,
    mood: row.mood,
    releaseYear: row.releaseYear,
    decade: row.decade,
    durationSec: row.durationSec,
    coverUrl: row.coverUrl,
    audioUrl: isAuthenticated ? row.audioUrl : preview,
    previewUrl: preview,
    source: row.source,
    bpm: row.bpm,
    musicalKey: row.musicalKey,
    notes: row.notes,
    credits: row.credits,
    licenseNote: row.licenseNote,
    language: row.language ?? null,
    playCount: row.playCount,
    hasSyncedLyrics: row.lyricFormat === "lrc" || row.lyricFormat === "json",
    isPublished: row.isPublished,
    isFavorite: row.favoriteId != null,
  };
}

function baseQuery(userId: string | null) {
  return getDb()
    .select(projection)
    .from(songs)
    .leftJoin(lyrics, eq(lyrics.songId, songs.id))
    .leftJoin(
      favorites,
      and(eq(favorites.songId, songs.id), eq(favorites.userId, userId ?? NO_USER)),
    );
}

export async function listSongs(
  query: SongQuery,
  viewer: { id: string | null; isAuthenticated: boolean },
): Promise<Paginated<SongDTO>> {
  const limit = Math.min(Math.max(query.limit ?? 24, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);
  const where = conditions(query);

  const rows = await baseQuery(viewer.id)
    .where(where.length ? and(...where) : undefined)
    .orderBy(...ordering(query.sort))
    .limit(limit)
    .offset(offset);

  const [counted] = await getDb()
    .select({ total: sql<number>`count(*)` })
    .from(songs)
    .leftJoin(lyrics, eq(lyrics.songId, songs.id))
    .where(where.length ? and(...where) : undefined);

  return {
    items: rows.map((row) => toSongDTO(row as Row, viewer.isAuthenticated)),
    total: Number(counted?.total ?? 0),
    limit,
    offset,
  };
}

export async function getSong(
  id: string,
  viewer: { id: string | null; isAuthenticated: boolean },
): Promise<SongDTO | null> {
  const [row] = await baseQuery(viewer.id).where(eq(songs.id, id)).limit(1);
  if (!row) return null;
  return toSongDTO(row as Row, viewer.isAuthenticated);
}

export async function requireSong(
  id: string,
  viewer: { id: string | null; isAuthenticated: boolean },
) {
  const song = await getSong(id, viewer);
  if (!song) throw ApiError.notFound("That track doesn't exist, or it was removed.");
  return song;
}

/** Ordered exactly as `ids` — used by playlists and queues, where order matters. */
export async function getSongsByIds(
  ids: string[],
  viewer: { id: string | null; isAuthenticated: boolean },
): Promise<SongDTO[]> {
  if (ids.length === 0) return [];
  const rows = await baseQuery(viewer.id).where(inArray(songs.id, ids));
  const byId = new Map(
    rows.map((row) => [row.id, toSongDTO(row as Row, viewer.isAuthenticated)]),
  );
  return ids.map((id) => byId.get(id)).filter((song): song is SongDTO => Boolean(song));
}

export async function getLyrics(songId: string): Promise<LyricsDTO> {
  const [row] = await getDb()
    .select()
    .from(lyrics)
    .where(eq(lyrics.songId, songId))
    .limit(1);

  if (!row) {
    return { songId, plainText: null, synced: null, format: "none" };
  }
  return {
    songId,
    plainText: row.plainText,
    synced: row.synced ?? null,
    format: row.format,
  };
}

/** The home page in one round trip per shelf. */
export async function browseSections(viewer: {
  id: string | null;
  isAuthenticated: boolean;
}): Promise<BrowseSection[]> {
  const db = getDb();
  const currentYear = new Date().getFullYear();

  // Discover which genres and languages have enough tracks to show a shelf.
  const [topGenreRows, topLangRows] = await Promise.all([
    db
      .select({ genre: songs.genre, count: sql<number>`count(*)` })
      .from(songs)
      .where(and(eq(songs.isPublished, true), sql`${songs.genre} is not null`))
      .groupBy(songs.genre)
      .having(sql`count(*) >= 3`)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(5),
    db
      .select({ language: songs.language, count: sql<number>`count(*)` })
      .from(songs)
      .where(and(eq(songs.isPublished, true), sql`${songs.language} is not null`))
      .groupBy(songs.language)
      .having(sql`count(*) >= 3`)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(6),
  ]);

  const topGenres = topGenreRows.map((r) => r.genre!);
  const topLangs = topLangRows.map((r) => r.language!);

  // All shelf queries run in parallel.
  const allRows = await Promise.all([
    baseQuery(viewer.id)
      .where(and(eq(songs.isPublished, true), gte(songs.releaseYear, currentYear - 2)))
      .orderBy(desc(songs.releaseYear), desc(songs.createdAt))
      .limit(12),

    baseQuery(viewer.id)
      .where(eq(songs.isPublished, true))
      .orderBy(desc(songs.playCount), desc(songs.createdAt))
      .limit(12),

    baseQuery(viewer.id)
      .where(and(eq(songs.isPublished, true), lt(songs.decade, 1990)))
      .orderBy(desc(songs.playCount), desc(songs.createdAt))
      .limit(12),

    ...topGenres.map((genre) =>
      baseQuery(viewer.id)
        .where(and(eq(songs.isPublished, true), eq(songs.genre, genre)))
        .orderBy(desc(songs.playCount), desc(songs.createdAt))
        .limit(12),
    ),

    // One shelf per top language — only appears once enough tagged songs exist.
    ...topLangs.map((lang) =>
      baseQuery(viewer.id)
        .where(and(eq(songs.isPublished, true), eq(songs.language, lang)))
        .orderBy(desc(songs.playCount), desc(songs.createdAt))
        .limit(12),
    ),
  ]);

  const fixedCount = 3; // new + popular + classics
  const freshRows   = allRows[0];
  const popularRows = allRows[1];
  const classicsRows = allRows[2];
  const genreRows  = allRows.slice(fixedCount, fixedCount + topGenres.length);
  const langRows   = allRows.slice(fixedCount + topGenres.length);

  const map = (rows: unknown[]) =>
    (rows as Row[]).map((row) => toSongDTO(row, viewer.isAuthenticated));

  const yearLabel =
    currentYear - 2 === currentYear - 1
      ? `${currentYear}`
      : `${currentYear - 1}–${currentYear}`;

  const LANG_FLAG: Record<string, string> = {
    Hindi: "🇮🇳", Tamil: "🎬", Telugu: "🎶", Punjabi: "🥁",
    Gujarati: "🪘", Rajasthani: "🏜️", Marathi: "🎵", Bengali: "🎼",
    Kannada: "🎤", Malayalam: "🌴", Korean: "🇰🇷", English: "🎧",
    Spanish: "💃", Portuguese: "🎸", Arabic: "🌙", French: "🎻",
  };

  const sections: BrowseSection[] = [
    {
      key: "new",
      title: "New releases",
      subtitle: `Fresh from ${yearLabel}`,
      songs: map(freshRows),
    },
    {
      key: "popular",
      title: "Trending",
      subtitle: "What everyone's playing",
      songs: map(popularRows),
    },
    ...topLangs.map((lang, i) => ({
      key: `lang-${lang.toLowerCase().replace(/\s+/g, "-")}`,
      title: `${LANG_FLAG[lang] ?? "♪"} ${lang}`,
      subtitle: `Top ${lang} tracks`,
      songs: map(langRows[i] ?? []),
    })),
    ...topGenres.map((genre, i) => ({
      key: `genre-${genre.toLowerCase().replace(/\s+/g, "-")}`,
      title: genre,
      subtitle: `The best of ${genre.toLowerCase()}`,
      songs: map(genreRows[i] ?? []),
    })),
    {
      key: "classics",
      title: "Old classics",
      subtitle: "Everything before the '90s",
      songs: map(classicsRows),
    },
  ];

  return sections.filter((section) => section.songs.length > 0);
}

/** Distinct genres/artists that actually have published tracks behind them. */
export async function catalogFacets() {
  const db = getDb();
  const [genreRows, artistRows, decadeRows, langRows] = await Promise.all([
    db
      .select({ value: songs.genre, count: sql<number>`count(*)` })
      .from(songs)
      .where(eq(songs.isPublished, true))
      .groupBy(songs.genre)
      .orderBy(desc(sql`count(*)`))
      .limit(24),
    db
      .select({ value: songs.artist, count: sql<number>`count(*)` })
      .from(songs)
      .where(eq(songs.isPublished, true))
      .groupBy(songs.artist)
      .orderBy(desc(sql`count(*)`))
      .limit(24),
    db
      .select({ value: songs.decade, count: sql<number>`count(*)` })
      .from(songs)
      .where(eq(songs.isPublished, true))
      .groupBy(songs.decade)
      .orderBy(desc(songs.decade))
      .limit(12),
    db
      .select({ value: songs.language, count: sql<number>`count(*)` })
      .from(songs)
      .where(and(eq(songs.isPublished, true), sql`${songs.language} is not null`))
      .groupBy(songs.language)
      .orderBy(desc(sql`count(*)`))
      .limit(20),
  ]);

  return {
    genres: genreRows
      .filter((row) => row.value)
      .map((row) => ({ value: row.value!, count: Number(row.count) })),
    artists: artistRows
      .filter((row) => row.value)
      .map((row) => ({ value: row.value, count: Number(row.count) })),
    decades: decadeRows
      .filter((row) => row.value != null)
      .map((row) => ({ value: row.value!, count: Number(row.count) })),
    languages: langRows
      .filter((row) => row.value)
      .map((row) => ({ value: row.value!, count: Number(row.count) })),
  };
}
