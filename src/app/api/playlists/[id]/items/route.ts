import { jsonOk, readJson, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/guards";
import { LIMITS, limit } from "@/lib/rate-limit";
import {
  addToPlaylist,
  removeFromPlaylist,
  reorderPlaylist,
  requireOwnedPlaylist,
} from "@/lib/server/library";
import { requireSong } from "@/lib/server/songs";
import { playlistItemSchema, playlistReorderSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (request, { params }) => {
  limit(request, "write", LIMITS.write);
  const { id } = await params;
  const user = await requireUser();
  await requireOwnedPlaylist(id, user.id);

  const { songId } = playlistItemSchema.parse(await readJson(request));
  await requireSong(songId, { id: user.id, isAuthenticated: true });

  const { added } = await addToPlaylist(id, songId);
  return jsonOk({
    ok: true,
    added,
    message: added ? "Added to the playlist." : "That track is already in this playlist.",
  });
});

/** Full reorder — the client sends the complete order after a drag. */
export const PUT = route<Ctx>(async (request, { params }) => {
  limit(request, "write", LIMITS.write);
  const { id } = await params;
  const user = await requireUser();
  await requireOwnedPlaylist(id, user.id);

  const { songIds } = playlistReorderSchema.parse(await readJson(request));
  await reorderPlaylist(id, songIds);
  return jsonOk({ ok: true });
});

export const DELETE = route<Ctx>(async (request, { params }) => {
  limit(request, "write", LIMITS.write);
  const { id } = await params;
  const user = await requireUser();
  await requireOwnedPlaylist(id, user.id);

  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("songId");
  const songId = fromQuery ?? playlistItemSchema.parse(await readJson(request)).songId;

  await removeFromPlaylist(id, songId);
  return jsonOk({ ok: true });
});
