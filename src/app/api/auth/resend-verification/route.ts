import { jsonOk, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/guards";
import { issueToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/mail";
import { LIMITS, limit } from "@/lib/rate-limit";

export const POST = route(async (request) => {
  limit(request, "passwordReset", LIMITS.passwordReset);

  const user = await requireUser();
  if (user.emailVerifiedAt) {
    return jsonOk({ ok: true, message: "Your email is already confirmed." });
  }

  const token = await issueToken(user.id, "verify_email");
  const { delivered } = await sendVerificationEmail(user.email, token);

  return jsonOk({
    ok: true,
    delivered,
    message: delivered
      ? `We've sent a new link to ${user.email}.`
      : "Email delivery isn't configured on this deployment — check the server log for the link.",
  });
});
