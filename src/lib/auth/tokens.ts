import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, lt, or } from "drizzle-orm";

import { authTokens, getDb } from "@/db";
import { newId } from "@/lib/utils";

export type TokenType = "verify_email" | "reset_password";

const TTL_MINUTES: Record<TokenType, number> = {
  verify_email: 60 * 24,
  reset_password: 60,
};

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Issues a single-use token. Only the SHA-256 hash is stored, so a database
 * leak cannot be replayed into account takeovers.
 */
export async function issueToken(userId: string, type: TokenType) {
  const db = getDb();
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MINUTES[type] * 60_000);

  // Any older token of the same kind is dead the moment a new one is issued.
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.userId, userId),
        eq(authTokens.type, type),
        isNull(authTokens.usedAt),
      ),
    );

  await db.insert(authTokens).values({
    id: newId(),
    userId,
    type,
    tokenHash: hashToken(raw),
    expiresAt,
  });

  return raw;
}

/** Consumes a token, returning the user id it belongs to, or null if invalid. */
export async function consumeToken(raw: string, type: TokenType) {
  const db = getDb();
  const tokenHash = hashToken(raw);

  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, tokenHash), eq(authTokens.type, type)))
    .limit(1);

  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.id, row.id));

  return row.userId;
}

/** Housekeeping: drop spent and expired rows. Called opportunistically. */
export async function pruneTokens() {
  const db = getDb();
  const cutoff = new Date(Date.now() - 7 * 86_400_000);
  await db
    .delete(authTokens)
    .where(or(lt(authTokens.expiresAt, cutoff), lt(authTokens.createdAt, cutoff)));
}
