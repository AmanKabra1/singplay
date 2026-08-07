import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { route } from "@/lib/api/http";
import { googleAuthUrl } from "@/lib/auth/google";
import { env } from "@/lib/env";

export const OAUTH_STATE_COOKIE = "sp_oauth_state";

/** Only same-origin relative paths, so `?next=` can't become an open redirect. */
function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export const GET = route(async (request) => {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));

  // The state carries both the CSRF nonce and where to land afterwards.
  const nonce = randomBytes(16).toString("base64url");
  const state = `${nonce}.${Buffer.from(next).toString("base64url")}`;

  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(googleAuthUrl(state));
});
