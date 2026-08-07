import { jsonOk, route } from "@/lib/api/http";
import { LIMITS, limit } from "@/lib/rate-limit";
import { logSearch } from "@/lib/server/analytics";
import { listSongs, type SongQuery } from "@/lib/server/songs";
import { currentViewer } from "@/lib/server/viewer";
import { readPagination } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  limit(request, "search", LIMITS.search);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const { limit: take, offset } = readPagination(url, 30);
  const { user, viewer } = await currentViewer();

  if (!q) {
    return jsonOk({ items: [], total: 0, limit: take, offset, query: q });
  }

  const scope = (url.searchParams.get("scope") as SongQuery["scope"]) ?? "all";
  const results = await listSongs(
    { q, scope, sort: "popular", limit: take, offset },
    viewer,
  );

  // Only the first page is logged — paging through results isn't a new search.
  if (offset === 0) {
    await logSearch(user?.id ?? null, q, results.total);
  }

  return jsonOk({ ...results, query: q });
});
