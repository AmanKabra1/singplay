import { eq } from "drizzle-orm";

import { getDb, users } from "@/db";
import { deleteUserCascade } from "@/db/cascade";
import { jsonOk, readJson, route } from "@/lib/api/http";
import { findUserById, toSessionUser } from "@/lib/auth/account";
import { requireUser } from "@/lib/auth/guards";
import { clearSessionCookie, createSessionCookie } from "@/lib/auth/session";
import { LIMITS, limit } from "@/lib/rate-limit";
import { profileSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const PATCH = route(async (request) => {
  limit(request, "write", LIMITS.write);
  const user = await requireUser();
  const body = profileSchema.parse(await readJson(request));

  await getDb()
    .update(users)
    .set({
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
      ...(body.avatarUrl !== undefined
        ? { avatarUrl: body.avatarUrl === "" ? null : body.avatarUrl }
        : {}),
    })
    .where(eq(users.id, user.id));

  // The display name and avatar live in the session cookie (the top bar reads
  // them without a database hit), so the cookie has to be re-minted here.
  const updated = await findUserById(user.id);
  const sessionUser = toSessionUser(updated!);
  await createSessionCookie(
    {
      sub: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.displayName,
      role: sessionUser.role,
      avatarUrl: sessionUser.avatarUrl,
      verified: sessionUser.verified,
    },
    true,
  );

  return jsonOk({ user: sessionUser });
});

export const DELETE = route(async (request) => {
  limit(request, "write", LIMITS.write);
  const user = await requireUser();

  await deleteUserCascade(user.id);
  await clearSessionCookie();
  return jsonOk({ ok: true });
});
