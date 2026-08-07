import { jsonOk, readJson, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/guards";
import { LIMITS, limit } from "@/lib/rate-limit";
import { continuePracticing, saveKaraokeProgress } from "@/lib/server/library";
import { karaokeProgressSchema, readPagination } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const user = await requireUser();
  const { limit: take } = readPagination(new URL(request.url), 12, 50);
  return jsonOk({
    items: await continuePracticing({ id: user.id, isAuthenticated: true }, take),
  });
});

export const POST = route(async (request) => {
  limit(request, "write", LIMITS.write);
  const user = await requireUser();
  const body = karaokeProgressSchema.parse(await readJson(request));

  await saveKaraokeProgress(
    user.id,
    body.songId,
    body.lastPositionSec,
    body.completed,
  );
  return jsonOk({ ok: true });
});
