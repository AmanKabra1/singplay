import { eq } from "drizzle-orm";

import { getDb, users } from "@/db";
import { ApiError, jsonOk, readJson, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/guards";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/auth/password";
import { LIMITS, limit } from "@/lib/rate-limit";
import { changePasswordSchema } from "@/lib/validation";

export const POST = route(async (request) => {
  limit(request, "passwordReset", LIMITS.passwordReset);
  const user = await requireUser();
  const body = changePasswordSchema.parse(await readJson(request));

  if (!user.passwordHash) {
    throw ApiError.badRequest(
      "This account signs in with Google, so there's no password to change.",
    );
  }
  if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
    throw new ApiError(
      422,
      "validation_failed",
      "Please check the highlighted fields.",
      { currentPassword: "That's not your current password." },
    );
  }

  const next = passwordSchema.parse(body.newPassword);
  await getDb()
    .update(users)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(users.id, user.id));

  return jsonOk({ ok: true, message: "Your password has been updated." });
});
