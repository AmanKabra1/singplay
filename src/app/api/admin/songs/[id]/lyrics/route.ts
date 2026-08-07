import { eq } from "drizzle-orm";

import { getDb, lyrics, songs, type SyncedLyrics } from "@/db";
import { ApiError, jsonOk, readJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { parseLrc } from "@/lib/lrc";
import { LIMITS, limit } from "@/lib/rate-limit";
import { newId } from "@/lib/utils";
import { lyricsInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Upsert of a track's lyrics. LRC is parsed here rather than in the browser so
 * the stored timing map is canonical, and the parser's warnings are handed back
 * so an admin can see exactly which lines it couldn't read (brief §3.7).
 */
export const PUT = route<Ctx>(async (request, { params }) => {
  limit(request, "write", LIMITS.write);
  const admin = await requireAdmin();
  const { id: songId } = await params;

  const [song] = await getDb()
    .select({ id: songs.id })
    .from(songs)
    .where(eq(songs.id, songId))
    .limit(1);
  if (!song) throw ApiError.notFound("That track doesn't exist.");

  const body = lyricsInputSchema.parse(await readJson(request));

  let synced: SyncedLyrics | null = null;
  let plainText = body.plainText?.trim() || null;
  let format: "lrc" | "json" | "none" = "none";
  let warnings: string[] = [];

  if (body.lrc?.trim()) {
    const parsed = parseLrc(body.lrc);
    warnings = parsed.warnings;

    if (parsed.lines.length === 0) {
      throw ApiError.badRequest(
        "No timestamped lines found. LRC lines look like “[00:12.50]lyric text”.",
      );
    }
    synced = { lines: parsed.lines };
    plainText = plainText ?? parsed.plainText;
    format = "lrc";
  } else if (plainText) {
    format = "none";
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: lyrics.id })
    .from(lyrics)
    .where(eq(lyrics.songId, songId))
    .limit(1);

  if (existing) {
    await db
      .update(lyrics)
      .set({ plainText, synced, format, updatedBy: admin.id })
      .where(eq(lyrics.id, existing.id));
  } else {
    await db.insert(lyrics).values({
      id: newId(),
      songId,
      plainText,
      synced,
      format,
      updatedBy: admin.id,
    });
  }

  return jsonOk({
    ok: true,
    format,
    lineCount: synced?.lines.length ?? 0,
    warnings,
  });
});

export const DELETE = route<Ctx>(async (request, { params }) => {
  limit(request, "write", LIMITS.write);
  await requireAdmin();
  const { id: songId } = await params;

  await getDb().delete(lyrics).where(eq(lyrics.songId, songId));
  return jsonOk({ ok: true });
});
