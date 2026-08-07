import { jsonOk, readJson, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/guards";
import { LIMITS, limit } from "@/lib/rate-limit";
import { addFavorite, listFavorites, removeFavorite } from "@/lib/server/library";
import { requireSong } from "@/lib/server/songs";
import { favoriteSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  return jsonOk({
    items: await listFavorites({ id: user.id, isAuthenticated: true }),
  });
});

export const POST = route(async (request) => {
  limit(request, "write", LIMITS.write);
  const user = await requireUser();
  const { songId } = favoriteSchema.parse(await readJson(request));

  await requireSong(songId, { id: user.id, isAuthenticated: true });
  const { added } = await addFavorite(user.id, songId);

  return jsonOk({ songId, isFavorite: true, added });
});

export const DELETE = route(async (request) => {
  limit(request, "write", LIMITS.write);
  const user = await requireUser();

  // Accepts either ?songId= or a JSON body, so both a link and a fetch work.
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("songId");
  const songId = fromQuery ?? favoriteSchema.parse(await readJson(request)).songId;

  await removeFavorite(user.id, songId);
  return jsonOk({ songId, isFavorite: false });
});
