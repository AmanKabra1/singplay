import { jsonOk, route } from "@/lib/api/http";
import { optionalUser, requireUser } from "@/lib/auth/guards";
import { recentlyPlayed, recordPlay } from "@/lib/server/library";
import { historySchema, readPagination } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const user = await requireUser();
  const { limit } = readPagination(new URL(request.url), 24, 60);
  return jsonOk({
    items: await recentlyPlayed({ id: user.id, isAuthenticated: true }, limit),
  });
});

/**
 * Called from the player with `keepalive`, including as the tab closes.
 *
 * Guests are accepted and silently ignored rather than 401'd: the player fires
 * this for everyone, and a red error in the console every time a guest finishes
 * a preview would be noise, not information.
 */
export const POST = route(async (request) => {
  const user = await optionalUser();
  const body = historySchema.parse(await request.json().catch(() => ({})));

  if (!user) return jsonOk({ recorded: false });

  await recordPlay(user.id, body.songId, body.mode, body.msPlayed);
  return jsonOk({ recorded: true });
});
