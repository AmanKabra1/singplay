import "server-only";

import { eq } from "drizzle-orm";

import { getDb, users, type User } from "@/db";
import { env } from "@/lib/env";
import type { SessionUser } from "@/lib/types";
import { newId } from "@/lib/utils";
import { createSessionCookie, type SessionPayload } from "./session";

/** Public shape of an account — never leaks the password hash. */
export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    verified: user.emailVerifiedAt !== null,
  };
}

export function toSessionPayload(user: User): SessionPayload {
  return {
    sub: user.id,
    email: user.email,
    name: user.displayName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    verified: user.emailVerifiedAt !== null,
  };
}

export async function signIn(user: User, remember: boolean) {
  await createSessionCookie(toSessionPayload(user), remember);
  return toSessionUser(user);
}

export async function findUserByEmail(email: string) {
  const [user] = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return user ?? null;
}

export async function findUserById(id: string) {
  const [user] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

/**
 * Bootstrap rule: the single address in ADMIN_EMAIL becomes an admin on signup.
 * Everything else defaults to `user`, and the role is only ever read back from
 * the database — never from the client (brief §3.1).
 */
export function roleForEmail(email: string) {
  return env.adminEmail && email.toLowerCase() === env.adminEmail
    ? ("admin" as const)
    : ("user" as const);
}

export async function createUser(input: {
  email: string;
  displayName: string;
  passwordHash?: string | null;
  googleId?: string | null;
  avatarUrl?: string | null;
  emailVerified?: boolean;
}) {
  const db = getDb();
  const id = newId();

  await db.insert(users).values({
    id,
    email: input.email.toLowerCase(),
    displayName: input.displayName,
    passwordHash: input.passwordHash ?? null,
    googleId: input.googleId ?? null,
    avatarUrl: input.avatarUrl ?? null,
    role: roleForEmail(input.email),
    emailVerifiedAt: input.emailVerified ? new Date() : null,
  });

  const created = await findUserById(id);
  if (!created) throw new Error("Failed to read back the account we just created.");
  return created;
}
