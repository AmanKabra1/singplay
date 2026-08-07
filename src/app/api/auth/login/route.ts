import { ApiError, jsonOk, readJson, route } from "@/lib/api/http";
import { findUserByEmail, signIn } from "@/lib/auth/account";
import { verifyPassword } from "@/lib/auth/password";
import { LIMITS, limit, resetLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export const POST = route(async (request) => {
  limit(request, "login", LIMITS.login);

  const body = loginSchema.parse(await readJson(request));
  const user = await findUserByEmail(body.email);

  // Wrong-email and wrong-password produce the same message, so a stranger
  // can't use the login form to discover which addresses have accounts.
  const invalid = () =>
    new ApiError(401, "invalid_credentials", "Incorrect email or password.");

  if (!user || !user.passwordHash) {
    if (user && !user.passwordHash) {
      throw new ApiError(
        409,
        "oauth_account",
        "This account was created with Google. Use “Continue with Google” to sign in.",
      );
    }
    throw invalid();
  }

  if (!(await verifyPassword(body.password, user.passwordHash))) throw invalid();

  if (user.status === "suspended") {
    throw ApiError.forbidden(
      "This account has been suspended. Contact support if you think that's a mistake.",
    );
  }

  resetLimit(request, "login");
  // Always issue a 30-day session — users stay logged in until they explicitly sign out.
  return jsonOk({ user: await signIn(user, true) });
});
