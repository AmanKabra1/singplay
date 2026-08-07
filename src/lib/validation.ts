import { z } from "zod";

import { LYRIC_FORMATS, PLAY_MODES, SONG_SOURCES } from "@/db/schema";

/**
 * Request schemas shared by the route handlers.
 *
 * Messages are written for the person reading them in the form, not for a log
 * file — `jsonError` flattens Zod issues into `{ field: message }` and the forms
 * render them inline (brief §4.2).
 */

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters.")
  .max(80, "That name is too long.");

export const signupSchema = z.object({
  displayName: displayNameSchema,
  email: z.string(),
  password: z.string(),
  remember: z.boolean().optional().default(true),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address."),
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address."),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "This reset link is incomplete."),
  password: z.string(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z.string(),
});

export const profileSchema = z.object({
  displayName: displayNameSchema.optional(),
  avatarUrl: z.union([z.string().url("Enter a valid image URL."), z.literal("")]).optional(),
});

// --- Catalog ---------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

export const songInputSchema = z.object({
  title: z.string().trim().min(1, "A title is required.").max(255),
  artist: z.string().trim().min(1, "An artist is required.").max(255),
  album: optionalText(255),
  genre: optionalText(64),
  mood: optionalText(64),
  releaseYear: z
    .number()
    .int()
    .min(1900, "Use a year from 1900 onwards.")
    .max(new Date().getFullYear() + 1, "That year is in the future.")
    .nullable()
    .optional(),
  durationSec: z.number().int().min(0).max(24 * 3600).optional().default(0),
  coverUrl: optionalText(512),
  audioUrl: z.string().trim().min(1, "An audio file or URL is required.").max(1024),
  previewUrl: optionalText(1024),
  source: z.enum(SONG_SOURCES).optional().default("local"),
  externalId: optionalText(64),
  bpm: z.number().int().min(20).max(300).nullable().optional(),
  musicalKey: optionalText(16),
  notes: optionalText(20_000),
  credits: optionalText(5_000),
  licenseNote: optionalText(255),
  isPublished: z.boolean().optional().default(true),
});

export const songPatchSchema = songInputSchema.partial();

export const lyricsInputSchema = z
  .object({
    /** Raw LRC text. Parsed server-side into the timing map. */
    lrc: z.string().max(200_000).optional(),
    /** Untimed lyrics, used when no LRC is available. */
    plainText: z.string().max(100_000).optional(),
    format: z.enum(LYRIC_FORMATS).optional(),
  })
  .refine(
    (value) => Boolean(value.lrc?.trim() || value.plainText?.trim()),
    "Provide either timed LRC lyrics or a plain lyric sheet.",
  );

// --- Library ---------------------------------------------------------------

export const playlistCreateSchema = z.object({
  name: z.string().trim().min(1, "Give the playlist a name.").max(120),
  description: optionalText(500),
  isPublic: z.boolean().optional().default(false),
  songIds: z.array(z.string()).max(500).optional(),
});

export const playlistUpdateSchema = z.object({
  name: z.string().trim().min(1, "Give the playlist a name.").max(120).optional(),
  description: optionalText(500),
  isPublic: z.boolean().optional(),
});

export const playlistItemSchema = z.object({
  songId: z.string().min(1),
});

export const playlistReorderSchema = z.object({
  songIds: z.array(z.string().min(1)).max(1000),
});

export const favoriteSchema = z.object({
  songId: z.string().min(1),
});

export const historySchema = z.object({
  songId: z.string().min(1),
  mode: z.enum(PLAY_MODES).optional().default("player"),
  msPlayed: z.number().int().min(0).max(6 * 3600_000).optional().default(0),
});

export const karaokeProgressSchema = z.object({
  songId: z.string().min(1),
  lastPositionSec: z.number().min(0).max(24 * 3600),
  completed: z.boolean().optional().default(false),
});

export const djSessionSchema = z.object({
  deckASongId: z.string().nullable().optional(),
  deckBSongId: z.string().nullable().optional(),
  durationSec: z.number().int().min(0).max(24 * 3600).optional().default(0),
});

// --- Admin -----------------------------------------------------------------

export const userAdminPatchSchema = z.object({
  role: z.enum(["user", "admin"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

export const uploadTargetSchema = z.object({
  kind: z.enum(["audio", "cover"]),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
  size: z.number().int().min(1).optional(),
});

export const jamendoImportSchema = z.object({
  externalIds: z.array(z.string().min(1)).min(1).max(50),
  publish: z.boolean().optional().default(true),
});

/** Parses `?limit=&offset=` with sane bounds, so a hostile value can't OOM us. */
export function readPagination(url: URL, defaultLimit = 24, maxLimit = 100) {
  const limit = Number(url.searchParams.get("limit") ?? defaultLimit);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  return {
    limit: Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), maxLimit) : defaultLimit,
    offset: Number.isFinite(offset) ? Math.max(Math.trunc(offset), 0) : 0,
  };
}
