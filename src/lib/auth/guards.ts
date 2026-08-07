import "server-only";

import { eq } from "drizzle-orm";

import { getDb, users, type User } from "@/db";
import { ApiError } from "@/lib/api/http";
import { getSession, type SessionPayload } from "./session";

/** Session-only check. Cheap: no database round-trip. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw ApiError.unauthorized();
  return session;
}

/**
 * Loads the live user row. Use this wherever a stale JWT would be dangerous —
 * a suspended account or a revoked admin role must take effect immediately,
 * not whenever the token happens to expire.
 */
export async function requireUser(): Promise<User> {
  const session = await requireSession();
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);

  if (!user) throw ApiError.unauthorized("Your account no longer exists.");
  if (user.status === "suspended") {
    throw ApiError.forbidden("This account has been suspended. Contact support.");
  }
  return user;
}

/** Role check is re-read from the database, never trusted from the cookie alone. */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw ApiError.forbidden("Admins only.");
  return user;
}

/** Returns the user if signed in, or null. Used by routes that serve guests too. */
export async function optionalUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);
  return user && user.status === "active" ? user : null;
}
