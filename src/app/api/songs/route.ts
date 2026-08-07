import { jsonOk, route } from "@/lib/api/http";
import { LIMITS, limit } from "@/lib/rate-limit";
import { listSongs, type SongQuery } from "@/lib/server/songs";
import { currentViewer } from "@/lib/server/viewer";
import { readPagination } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  limit(request, "search", LIMITS.search);

  const url = new URL(request.url);
  const { limit: take, offset } = readPagination(url);
  const { viewer } = await currentViewer();

  const decadeParam = url.searchParams.get("decade");
  const decade = decadeParam === null ? undefined : Number(decadeParam);

  const query: SongQuery = {
    q: url.searchParams.get("q") ?? undefined,
    genre: url.searchParams.get("genre") ?? undefined,
    mood: url.searchParams.get("mood") ?? undefined,
    language: url.searchParams.get("language") ?? undefined,
    artist: url.searchParams.get("artist") ?? undefined,
    album: url.searchParams.get("album") ?? undefined,
    decade: Number.isFinite(decade) ? decade : undefined,
    scope: (url.searchParams.get("scope") as SongQuery["scope"]) ?? "all",
    sort: (url.searchParams.get("sort") as SongQuery["sort"]) ?? "new",
    limit: take,
    offset,
  };

  return jsonOk(await listSongs(query, viewer));
});
