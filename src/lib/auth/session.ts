import "server-only";

import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

import { SESSION_COOKIE } from "@/lib/constants";
import { env } from "@/lib/env";
import type { UserRole } from "@/db/schema";

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
  /** Whether the account has confirmed its email address. */
  verified: boolean;
};

const ONE_DAY = 60 * 60 * 24;
const REMEMBER_ME_DAYS = 30;

function secret() {
  return new TextEncoder().encode(env.authSecret);
}

export async function signSession(payload: SessionPayload, remember: boolean) {
  const maxAge = remember ? ONE_DAY * REMEMBER_ME_DAYS : ONE_DAY;
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject(payload.sub)
    .setExpirationTime(`${maxAge}s`)
    .sign(secret());
  return { token, maxAge };
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, secret(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub || !payload.role) return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      avatarUrl: payload.avatarUrl ?? null,
      verified: Boolean(payload.verified),
    };
  } catch {
    // Expired, tampered with, or signed by a rotated secret — all mean "no session".
    return null;
  }
}

export async function createSessionCookie(payload: SessionPayload, remember: boolean) {
  const { token, maxAge } = await signSession(payload, remember);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: 0,
  });
}

/** Reads and verifies the session from the request cookies. Never throws. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
