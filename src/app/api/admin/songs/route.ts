import { getDb, songs } from "@/db";
import { jsonOk, readJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { LIMITS, limit } from "@/lib/rate-limit";
import { listSongs, type SongQuery } from "@/lib/server/songs";
import { decadeOf, newId } from "@/lib/utils";
import { readPagination, songInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  await requireAdmin();

  const url = new URL(request.url);
  const { limit: take, offset } = readPagination(url, 25, 100);

  const query: SongQuery = {
    q: url.searchParams.get("q") ?? undefined,
    genre: url.searchParams.get("genre") ?? undefined,
    sort: (url.searchParams.get("sort") as SongQuery["sort"]) ?? "new",
    // Admins manage drafts as well as published tracks.
    publishedOnly: false,
    limit: take,
    offset,
  };

  return jsonOk(await listSongs(query, { id: null, isAuthenticated: true }));
});

export const POST = route(async (request) => {
  limit(request, "write", LIMITS.write);
  const admin = await requireAdmin();
  const body = songInputSchema.parse(await readJson(request));

  const id = newId();
  await getDb()
    .insert(songs)
    .values({
      ...body,
      id,
      // Kept consistent with releaseYear so "Old classics" browsing stays a
      // simple indexed lookup rather than an expression over release_year.
      decade: decadeOf(body.releaseYear ?? null),
      createdBy: admin.id,
    });

  return jsonOk({ id }, { status: 201 });
});
