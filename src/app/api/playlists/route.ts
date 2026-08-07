import { getDb, playlistItems, playlists } from "@/db";
import { jsonOk, readJson, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/guards";
import { LIMITS, limit } from "@/lib/rate-limit";
import { listPlaylists } from "@/lib/server/library";
import { newId } from "@/lib/utils";
import { playlistCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  return jsonOk({ items: await listPlaylists(user.id) });
});

export const POST = route(async (request) => {
  limit(request, "write", LIMITS.write);
  const user = await requireUser();
  const body = playlistCreateSchema.parse(await readJson(request));

  const db = getDb();
  const id = newId();

  await db.insert(playlists).values({
    id,
    userId: user.id,
    name: body.name,
    description: body.description,
    isPublic: body.isPublic,
  });

  // "Create playlist from these songs" in one round trip — used by the
  // add-to-playlist menu when the user picks "New playlist".
  const songIds = [...new Set(body.songIds ?? [])];
  if (songIds.length > 0) {
    await db.insert(playlistItems).values(
      songIds.map((songId, position) => ({
        id: newId(),
        playlistId: id,
        songId,
        position,
      })),
    );
  }

  const [created] = (await listPlaylists(user.id)).filter((item) => item.id === id);
  return jsonOk({ playlist: created }, { status: 201 });
});
