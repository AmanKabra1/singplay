import { jsonOk, readJson, route } from "@/lib/api/http";
import { findUserByEmail } from "@/lib/auth/account";
import { emailSchema } from "@/lib/auth/password";
import { issueToken } from "@/lib/auth/tokens";
import { sendPasswordResetEmail } from "@/lib/mail";
import { LIMITS, limit } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/validation";

export const POST = route(async (request) => {
  limit(request, "passwordReset", LIMITS.passwordReset);

  const body = forgotPasswordSchema.parse(await readJson(request));
  const email = emailSchema.parse(body.email);
  const user = await findUserByEmail(email);

  // Always the same response, whether or not the address exists — a password
  // reset form must not double as a "does this person have an account" lookup.
  if (user?.passwordHash) {
    const token = await issueToken(user.id, "reset_password");
    await sendPasswordResetEmail(user.email, token);
  }

  return jsonOk({
    ok: true,
    message: "If that email has an account, a reset link is on its way.",
  });
});
