import { eq } from "drizzle-orm";

import { getDb, songs } from "@/db";
import { deleteSongCascade } from "@/db/cascade";
import { ApiError, jsonOk, readJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { LIMITS, limit } from "@/lib/rate-limit";
import { getLyrics } from "@/lib/server/songs";
import { decadeOf } from "@/lib/utils";
import { songPatchSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** The admin view returns the raw row, including unpublished-only fields. */
export const GET = route<Ctx>(async (_request, { params }) => {
  await requireAdmin();
  const { id } = await params;

  const [song] = await getDb().select().from(songs).where(eq(songs.id, id)).limit(1);
  if (!song) throw ApiError.notFound("That track doesn't exist.");

  return jsonOk({ song, lyrics: await getLyrics(id) });
});

export const PATCH = route<Ctx>(async (request, { params }) => {
  limit(request, "write", LIMITS.write);
  await requireAdmin();
  const { id } = await params;

  const body = songPatchSchema.parse(await readJson(request));
  const [existing] = await getDb().select().from(songs).where(eq(songs.id, id)).limit(1);
  if (!existing) throw ApiError.notFound("That track doesn't exist.");

  await getDb()
    .update(songs)
    .set({
      ...body,
      ...(body.releaseYear !== undefined
        ? { decade: decadeOf(body.releaseYear ?? null) }
        : {}),
    })
    .where(eq(songs.id, id));

  return jsonOk({ ok: true });
});

export const DELETE = route<Ctx>(async (request, { params }) => {
  limit(request, "write", LIMITS.write);
  await requireAdmin();
  const { id } = await params;

  // Playlist entries, favourites, history and lyrics go with it — the schema
  // has no FK constraints, so the cascade is explicit (see src/db/cascade.ts).
  await deleteSongCascade(id);
  return jsonOk({ ok: true });
});
