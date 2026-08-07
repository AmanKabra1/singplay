import { eq } from "drizzle-orm";

import { getDb, playlists } from "@/db";
import { deletePlaylistCascade } from "@/db/cascade";
import { jsonOk, readJson, route } from "@/lib/api/http";
import { optionalUser, requireUser } from "@/lib/auth/guards";
import { LIMITS, limit } from "@/lib/rate-limit";
import { getPlaylist, playlistSongs, requireOwnedPlaylist } from "@/lib/server/library";
import { playlistUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_request, { params }) => {
  const { id } = await params;
  const viewer = await optionalUser();
  const playlist = await getPlaylist(id, viewer?.id ?? null);

  const songs = await playlistSongs(id, {
    id: viewer?.id ?? null,
    isAuthenticated: viewer !== null,
  });

  return jsonOk({
    playlist: {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      isPublic: playlist.isPublic,
      isOwner: playlist.userId === viewer?.id,
      songCount: songs.length,
      durationSec: songs.reduce((total, song) => total + song.durationSec, 0),
      updatedAt: playlist.updatedAt.toISOString(),
    },
    songs,
  });
});

export const PATCH = route<Ctx>(async (request, { params }) => {
  limit(request, "write", LIMITS.write);
  const { id } = await params;
  const user = await requireUser();
  await requireOwnedPlaylist(id, user.id);

  const body = playlistUpdateSchema.parse(await readJson(request));
  await getDb()
    .update(playlists)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
      updatedAt: new Date(),
    })
    .where(eq(playlists.id, id));

  return jsonOk({ ok: true });
});

export const DELETE = route<Ctx>(async (request, { params }) => {
  limit(request, "write", LIMITS.write);
  const { id } = await params;
  const user = await requireUser();
  await requireOwnedPlaylist(id, user.id);

  await deletePlaylistCascade(id);
  return jsonOk({ ok: true });
});
