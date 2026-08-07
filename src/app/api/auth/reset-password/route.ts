import { eq } from "drizzle-orm";

import { getDb, users } from "@/db";
import { ApiError, jsonOk, readJson, route } from "@/lib/api/http";
import { findUserById, signIn } from "@/lib/auth/account";
import { hashPassword, passwordSchema } from "@/lib/auth/password";
import { consumeToken } from "@/lib/auth/tokens";
import { LIMITS, limit } from "@/lib/rate-limit";
import { resetPasswordSchema } from "@/lib/validation";

export const POST = route(async (request) => {
  limit(request, "passwordReset", LIMITS.passwordReset);

  const body = resetPasswordSchema.parse(await readJson(request));
  const password = passwordSchema.parse(body.password);

  const userId = await consumeToken(body.token, "reset_password");
  if (!userId) {
    throw ApiError.badRequest(
      "This reset link has expired or has already been used. Request a new one.",
    );
  }

  const user = await findUserById(userId);
  if (!user) throw ApiError.badRequest("That account no longer exists.");

  await getDb()
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      // Completing a reset proves control of the mailbox, so it also verifies.
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    })
    .where(eq(users.id, user.id));

  const refreshed = await findUserById(user.id);
  return jsonOk({ user: await signIn(refreshed!, false) });
});
