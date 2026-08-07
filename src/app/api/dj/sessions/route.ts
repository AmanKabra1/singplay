import { jsonOk, readJson, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/guards";
import { LIMITS, limit } from "@/lib/rate-limit";
import { logDjSession } from "@/lib/server/analytics";
import { djSessionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Records a finished mix so the admin dashboard can report DJ panel usage. */
export const POST = route(async (request) => {
  limit(request, "write", LIMITS.write);
  const user = await requireUser();
  const body = djSessionSchema.parse(await readJson(request));

  await logDjSession(
    user.id,
    body.deckASongId ?? null,
    body.deckBSongId ?? null,
    body.durationSec,
  );
  return jsonOk({ ok: true });
});
