import type { LyricLine, PlayMode, SyncedLyrics, UserRole } from "@/db/schema";

export type { LyricLine, PlayMode, SyncedLyrics, UserRole };

/** The shape of a song as it crosses the wire. Never includes admin-only fields. */
export type SongDTO = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  mood: string | null;
  releaseYear: number | null;
  decade: number | null;
  durationSec: number;
  coverUrl: string | null;
  audioUrl: string;
  previewUrl: string | null;
  source: "local" | "jamendo" | "itunes" | "archive" | "audius";
  bpm: number | null;
  musicalKey: string | null;
  notes: string | null;
  credits: string | null;
  licenseNote: string | null;
  language: string | null;
  playCount: number;
  hasSyncedLyrics: boolean;
  /** False only for admin-visible drafts; listeners never see an unpublished row. */
  isPublished: boolean;
  isFavorite?: boolean;
};

export type LyricsDTO = {
  songId: string;
  plainText: string | null;
  synced: SyncedLyrics | null;
  format: "lrc" | "json" | "none";
};

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  verified: boolean;
};

export type PlaylistDTO = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  songCount: number;
  durationSec: number;
  coverUrls: string[];
  updatedAt: string;
};

export type PracticeStatsDTO = {
  currentStreak: number;
  longestStreak: number;
  songsPracticed: number;
  totalSessions: number;
  totalPracticeSec: number;
  lastPracticeDate: string | null;
};

export type KaraokeProgressDTO = {
  song: SongDTO;
  lastPositionSec: number;
  sessions: number;
  completed: boolean;
  lastPracticedAt: string;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type BrowseSection = {
  key: string;
  title: string;
  subtitle?: string;
  songs: SongDTO[];
};
