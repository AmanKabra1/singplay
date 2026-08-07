import "server-only";

import { ApiError } from "@/lib/api/http";
import { env } from "@/lib/env";

/**
 * Google OAuth 2.0 authorisation-code flow.
 *
 * Hand-rolled rather than pulled from a library: we only need one provider,
 * and this keeps full control over how the role claim and account linking work.
 *
 * Apple Sign In is intentionally not implemented — it requires a paid Apple
 * Developer membership, which does not fit the "free resources" constraint.
 * The UI hides the Apple button unless APPLE_CLIENT_ID is ever added.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export function googleRedirectUri() {
  return `${env.appUrl}/api/auth/google/callback`;
}

export function googleAuthUrl(state: string) {
  if (!env.google.configured) {
    throw new ApiError(
      501,
      "oauth_not_configured",
      "Google sign-in isn't set up on this deployment yet.",
    );
  }
  const params = new URLSearchParams({
    client_id: env.google.clientId!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
};

export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.google.clientId!,
      client_secret: env.google.clientSecret!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    throw new ApiError(
      502,
      "oauth_exchange_failed",
      "Google sign-in failed. Please try again or use your email and password.",
    );
  }

  const { access_token: accessToken } = (await tokenResponse.json()) as {
    access_token?: string;
  };
  if (!accessToken) {
    throw new ApiError(502, "oauth_exchange_failed", "Google sign-in failed.");
  }

  const profileResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!profileResponse.ok) {
    throw new ApiError(502, "oauth_profile_failed", "Couldn't read your Google profile.");
  }

  const profile = (await profileResponse.json()) as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.email) {
    throw ApiError.badRequest("Your Google account didn't share an email address.");
  }

  return {
    sub: profile.sub,
    email: profile.email.toLowerCase(),
    emailVerified: Boolean(profile.email_verified),
    name: profile.name || profile.email.split("@")[0]!,
    picture: profile.picture,
  };
}
