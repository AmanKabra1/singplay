import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, users } from "@/db";
import { ApiError, jsonOk, readJson, route } from "@/lib/api/http";
import { findUserById, signIn } from "@/lib/auth/account";
import { consumeToken } from "@/lib/auth/tokens";

const schema = z.object({ token: z.string().min(1, "This link is incomplete.") });

export const POST = route(async (request) => {
  const { token } = schema.parse(await readJson(request));

  const userId = await consumeToken(token, "verify_email");
  if (!userId) {
    throw ApiError.badRequest(
      "This confirmation link has expired or has already been used. Sign in and request a new one.",
    );
  }

  const user = await findUserById(userId);
  if (!user) throw ApiError.badRequest("That account no longer exists.");

  if (!user.emailVerifiedAt) {
    await getDb()
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  // Re-issue the cookie so the `verified` claim in the JWT is current, which is
  // what the "verify your email" banner reads.
  const refreshed = await findUserById(user.id);
  return jsonOk({ user: await signIn(refreshed!, false) });
});
