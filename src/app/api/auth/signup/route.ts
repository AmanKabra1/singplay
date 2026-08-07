import { ApiError, jsonOk, readJson, route } from "@/lib/api/http";
import { createUser, findUserByEmail, signIn } from "@/lib/auth/account";
import { emailSchema, hashPassword, passwordSchema } from "@/lib/auth/password";
import { issueToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/mail";
import { LIMITS, limit } from "@/lib/rate-limit";
import { signupSchema } from "@/lib/validation";

export const POST = route(async (request) => {
  limit(request, "signup", LIMITS.signup);

  const body = signupSchema.parse(await readJson(request));
  const email = emailSchema.parse(body.email);
  const password = passwordSchema.parse(body.password);

  const existing = await findUserByEmail(email);
  if (existing) {
    // Deliberately explicit: the brief asks for "Email already registered"
    // rather than a vague failure. Signup is already rate limited, which keeps
    // this from becoming a practical account-enumeration oracle.
    throw ApiError.conflict(
      "email_taken",
      "That email is already registered. Try signing in instead.",
    );
  }

  const user = await createUser({
    email,
    displayName: body.displayName,
    passwordHash: await hashPassword(password),
  });

  const token = await issueToken(user.id, "verify_email");
  const { delivered } = await sendVerificationEmail(user.email, token);

  // Always issue a 30-day session — users stay logged in until they explicitly sign out.
  const sessionUser = await signIn(user, true);

  return jsonOk({
    user: sessionUser,
    // The account works before verification; the banner just nudges.
    verificationEmailSent: delivered,
  });
});
