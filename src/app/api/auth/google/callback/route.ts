import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb, users } from "@/db";
import { route } from "@/lib/api/http";
import { createUser, findUserByEmail, signIn } from "@/lib/auth/account";
import { exchangeGoogleCode } from "@/lib/auth/google";
import { env } from "@/lib/env";
import { OAUTH_STATE_COOKIE } from "../route";

/**
 * OAuth failures redirect back to the sign-in page carrying a readable message
 * rather than rendering raw JSON at a URL the user can't do anything with.
 */
function fail(message: string) {
  const url = new URL("/login", env.appUrl);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export const GET = route(async (request) => {
  const url = new URL(request.url);
  const store = await cookies();

  const expectedNonce = store.get(OAUTH_STATE_COOKIE)?.value;
  store.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });

  if (url.searchParams.get("error")) {
    return fail("Google sign-in was cancelled.");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const [nonce, encodedNext] = state.split(".");

  if (!code) return fail("Google didn't return an authorisation code.");
  if (!expectedNonce || nonce !== expectedNonce) {
    return fail("That sign-in link expired. Please try again.");
  }

  const next = encodedNext
    ? Buffer.from(encodedNext, "base64url").toString("utf8")
    : "/";
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  let profile;
  try {
    profile = await exchangeGoogleCode(code);
  } catch {
    return fail("Google sign-in failed. Try again, or use your email and password.");
  }

  const db = getDb();
  let user = await findUserByEmail(profile.email);

  if (user) {
    if (user.status === "suspended") {
      return fail("This account has been suspended.");
    }
    // Link the Google identity to the existing email account on first use, and
    // trust Google's verification so the user isn't asked to confirm twice.
    if (!user.googleId || (!user.emailVerifiedAt && profile.emailVerified)) {
      await db
        .update(users)
        .set({
          googleId: user.googleId ?? profile.sub,
          avatarUrl: user.avatarUrl ?? profile.picture ?? null,
          emailVerifiedAt:
            user.emailVerifiedAt ?? (profile.emailVerified ? new Date() : null),
        })
        .where(eq(users.id, user.id));
      user = await findUserByEmail(profile.email);
    }
  } else {
    user = await createUser({
      email: profile.email,
      displayName: profile.name,
      googleId: profile.sub,
      avatarUrl: profile.picture ?? null,
      emailVerified: profile.emailVerified,
    });
  }

  await signIn(user!, true);
  return NextResponse.redirect(new URL(destination, env.appUrl));
});
