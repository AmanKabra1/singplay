/**
 * TiDB (MySQL-compatible) schema for SingPlay.
 *
 * Note on foreign keys: this schema deliberately declares *no* FK constraints.
 * TiDB is a distributed database where FK enforcement adds cross-node cost, and
 * FK support has varied across serverless cluster versions — a missing FK never
 * breaks anyone's setup, whereas an unsupported one breaks the very first
 * migration. Referential integrity is enforced in the data layer instead (see
 * `src/db/cascade.ts`), and Drizzle `relations()` below still gives us typed
 * joins because those are purely logical.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** A single timed lyric line. `t` is seconds from the start of the track. */
export type LyricLine = {
  t: number;
  text: string;
  /** Optional per-word timings for karaoke-ball style highlighting. */
  words?: { t: number; w: string }[];
};

export type SyncedLyrics = { lines: LyricLine[] };

export const USER_ROLES = ["user", "admin"] as const;
export const USER_STATUSES = ["active", "suspended"] as const;
export const SONG_SOURCES = ["local", "jamendo", "itunes", "archive", "audius"] as const;
export const LYRIC_FORMATS = ["lrc", "json", "none"] as const;
export const PLAY_MODES = ["player", "karaoke", "dj"] as const;
export const TOKEN_TYPES = ["verify_email", "reset_password"] as const;

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    /** Null for accounts created purely through Google OAuth. */
    passwordHash: varchar("password_hash", { length: 255 }),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    avatarUrl: varchar("avatar_url", { length: 512 }),
    role: mysqlEnum("role", USER_ROLES).notNull().default("user"),
    status: mysqlEnum("status", USER_STATUSES).notNull().default("active"),
    emailVerifiedAt: timestamp("email_verified_at"),
    googleId: varchar("google_id", { length: 64 }),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .onUpdateNow(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    index("users_google_id_idx").on(t.googleId),
  ],
);

/** Single-use tokens for email verification and password resets. */
export const authTokens = mysqlTable(
  "auth_tokens",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    type: mysqlEnum("type", TOKEN_TYPES).notNull(),
    /** SHA-256 of the token; the raw value only ever lives in the email link. */
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("auth_tokens_hash_idx").on(t.tokenHash),
    index("auth_tokens_user_idx").on(t.userId, t.type),
  ],
);

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const songs = mysqlTable(
  "songs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    artist: varchar("artist", { length: 255 }).notNull(),
    album: varchar("album", { length: 255 }),
    genre: varchar("genre", { length: 64 }),
    mood: varchar("mood", { length: 64 }),
    releaseYear: int("release_year"),
    /** Denormalised from releaseYear so "Old Classics" browsing stays cheap. */
    decade: int("decade"),
    durationSec: int("duration_sec").notNull().default(0),
    coverUrl: varchar("cover_url", { length: 512 }),
    audioUrl: varchar("audio_url", { length: 1024 }).notNull(),
    /** 30-second clip guests are allowed to hear. Falls back to audioUrl. */
    previewUrl: varchar("preview_url", { length: 1024 }),
    source: mysqlEnum("source", SONG_SOURCES).notNull().default("local"),
    /** Jamendo track id, when source = 'jamendo'. */
    externalId: varchar("external_id", { length: 64 }),
    bpm: int("bpm"),
    musicalKey: varchar("musical_key", { length: 16 }),
    /** Admin-written trivia / background shown on the song detail page. */
    notes: text("notes"),
    credits: text("credits"),
    /** e.g. "CC BY-SA 3.0 — Jamendo". Shown in the UI for attribution. */
    licenseNote: varchar("license_note", { length: 255 }),
    /** Natural language of the lyrics, e.g. "Hindi", "Tamil", "English". */
    language: varchar("language", { length: 64 }),
    isPublished: boolean("is_published").notNull().default(true),
    playCount: int("play_count").notNull().default(0),
    createdBy: varchar("created_by", { length: 36 }),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .onUpdateNow(),
  },
  (t) => [
    index("songs_title_idx").on(t.title),
    index("songs_artist_idx").on(t.artist),
    index("songs_genre_idx").on(t.genre),
    index("songs_mood_idx").on(t.mood),
    index("songs_decade_idx").on(t.decade),
    index("songs_language_idx").on(t.language),
    index("songs_play_count_idx").on(t.playCount),
    index("songs_created_at_idx").on(t.createdAt),
    uniqueIndex("songs_source_external_idx").on(t.source, t.externalId),
  ],
);

export const lyrics = mysqlTable(
  "lyrics",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    songId: varchar("song_id", { length: 36 }).notNull(),
    /** Always populated when we have any lyrics at all — used for static view. */
    plainText: text("plain_text"),
    /** Timed lines. Null means "sync not available for this track yet". */
    synced: json("synced").$type<SyncedLyrics | null>(),
    format: mysqlEnum("format", LYRIC_FORMATS).notNull().default("none"),
    updatedBy: varchar("updated_by", { length: 36 }),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .onUpdateNow(),
  },
  (t) => [uniqueIndex("lyrics_song_idx").on(t.songId)],
);

// ---------------------------------------------------------------------------
// Personal library
// ---------------------------------------------------------------------------

export const playlists = mysqlTable(
  "playlists",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: varchar("description", { length: 500 }),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .onUpdateNow(),
  },
  (t) => [index("playlists_user_idx").on(t.userId)],
);

export const playlistItems = mysqlTable(
  "playlist_items",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    playlistId: varchar("playlist_id", { length: 36 }).notNull(),
    songId: varchar("song_id", { length: 36 }).notNull(),
    position: int("position").notNull().default(0),
    addedAt: timestamp("added_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("playlist_items_playlist_idx").on(t.playlistId, t.position),
    uniqueIndex("playlist_items_unique_idx").on(t.playlistId, t.songId),
  ],
);

export const favorites = mysqlTable(
  "favorites",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    songId: varchar("song_id", { length: 36 }).notNull(),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("favorites_unique_idx").on(t.userId, t.songId)],
);

export const playHistory = mysqlTable(
  "play_history",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    songId: varchar("song_id", { length: 36 }).notNull(),
    mode: mysqlEnum("mode", PLAY_MODES).notNull().default("player"),
    msPlayed: int("ms_played").notNull().default(0),
    playedAt: timestamp("played_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("play_history_user_idx").on(t.userId, t.playedAt),
    index("play_history_song_idx").on(t.songId, t.playedAt),
  ],
);

/** "Continue practicing" — one row per user per karaoke track. */
export const karaokeProgress = mysqlTable(
  "karaoke_progress",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    songId: varchar("song_id", { length: 36 }).notNull(),
    lastPositionSec: int("last_position_sec").notNull().default(0),
    sessions: int("sessions").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    lastPracticedAt: timestamp("last_practiced_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .onUpdateNow(),
  },
  (t) => [
    uniqueIndex("karaoke_progress_unique_idx").on(t.userId, t.songId),
    index("karaoke_progress_recent_idx").on(t.userId, t.lastPracticedAt),
  ],
);

/** Gamification counters, kept as a rollup so the dashboard is a single read. */
export const practiceStats = mysqlTable("practice_stats", {
  userId: varchar("user_id", { length: 36 }).primaryKey(),
  currentStreak: int("current_streak").notNull().default(0),
  longestStreak: int("longest_streak").notNull().default(0),
  /** `mode: "string"` keeps this a plain YYYY-MM-DD, which is all the streak
   *  maths needs — a Date object would drag timezone handling into it. */
  lastPracticeDate: date("last_practice_date", { mode: "string" }),
  totalSessions: int("total_sessions").notNull().default(0),
  totalPracticeSec: int("total_practice_sec").notNull().default(0),
  songsPracticed: int("songs_practiced").notNull().default(0),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .onUpdateNow(),
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export const searchLog = mysqlTable(
  "search_log",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }),
    query: varchar("query", { length: 255 }).notNull(),
    resultCount: int("result_count").notNull().default(0),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("search_log_created_idx").on(t.createdAt)],
);

export const djSessions = mysqlTable(
  "dj_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    deckASongId: varchar("deck_a_song_id", { length: 36 }),
    deckBSongId: varchar("deck_b_song_id", { length: 36 }),
    durationSec: int("duration_sec").notNull().default(0),
    startedAt: timestamp("started_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("dj_sessions_user_idx").on(t.userId, t.startedAt)],
);

// ---------------------------------------------------------------------------
// Logical relations (no FK DDL — see file header)
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many, one }) => ({
  playlists: many(playlists),
  favorites: many(favorites),
  history: many(playHistory),
  stats: one(practiceStats, {
    fields: [users.id],
    references: [practiceStats.userId],
  }),
}));

export const songsRelations = relations(songs, ({ one, many }) => ({
  lyrics: one(lyrics, { fields: [songs.id], references: [lyrics.songId] }),
  playlistItems: many(playlistItems),
}));

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  owner: one(users, { fields: [playlists.userId], references: [users.id] }),
  items: many(playlistItems),
}));

export const playlistItemsRelations = relations(playlistItems, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistItems.playlistId],
    references: [playlists.id],
  }),
  song: one(songs, { fields: [playlistItems.songId], references: [songs.id] }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  song: one(songs, { fields: [favorites.songId], references: [songs.id] }),
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Song = typeof songs.$inferSelect;
export type Lyrics = typeof lyrics.$inferSelect;
export type Playlist = typeof playlists.$inferSelect;
export type PracticeStats = typeof practiceStats.$inferSelect;
export type UserRole = (typeof USER_ROLES)[number];
export type PlayMode = (typeof PLAY_MODES)[number];
