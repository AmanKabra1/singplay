import { eq, ne, and, sql } from "drizzle-orm";

import { getDb, users } from "@/db";
import { deleteUserCascade } from "@/db/cascade";
import { ApiError, jsonOk, readJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { issueToken } from "@/lib/auth/tokens";
import { sendPasswordResetEmail } from "@/lib/mail";
import { LIMITS, limit } from "@/lib/rate-limit";
import { userAdminPatchSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Refuses any change that would leave the deployment with no active admin. */
async function assertNotLastAdmin(userId: string) {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.status, "active"), ne(users.id, userId)));

  if (Number(row?.count ?? 0) === 0) {
    throw ApiError.badRequest(
      "This is the only active admin account — promote someone else first.",
    );
  }
}

export const PATCH = route<Ctx>(async (request, { params }) => {
  limit(request, "write", LIMITS.write);
  const admin = await requireAdmin();
  const { id } = await params;

  const body = userAdminPatchSchema.parse(await readJson(request));

  const [target] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw ApiError.notFound("That account doesn't exist.");

  if (target.id === admin.id && (body.role === "user" || body.status === "suspended")) {
    throw ApiError.badRequest("You can't demote or suspend your own account.");
  }
  if (
    target.role === "admin" &&
    (body.role === "user" || body.status === "suspended")
  ) {
    await assertNotLastAdmin(target.id);
  }

  await getDb()
    .update(users)
    .set({
      ...(body.role ? { role: body.role } : {}),
      ...(body.status ? { status: body.status } : {}),
    })
    .where(eq(users.id, id));

  return jsonOk({ ok: true });
});

export const DELETE = route<Ctx>(async (request, { params }) => {
  limit(request, "write", LIMITS.write);
  const admin = await requireAdmin();
  const { id } = await params;

  if (id === admin.id) {
    throw ApiError.badRequest("Delete your own account from Profile & settings.");
  }

  const [target] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw ApiError.notFound("That account doesn't exist.");
  if (target.role === "admin") await assertNotLastAdmin(target.id);

  await deleteUserCascade(id);
  return jsonOk({ ok: true });
});

/**
 * Admin-triggered password reset. Sends the same single-use link the user would
 * get themselves — an admin never sees or sets someone else's password.
 */
export const POST = route<Ctx>(async (request, { params }) => {
  limit(request, "write", LIMITS.write);
  await requireAdmin();
  const { id } = await params;

  const [target] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw ApiError.notFound("That account doesn't exist.");
  if (!target.passwordHash) {
    throw ApiError.badRequest("That account signs in with Google — there's no password.");
  }

  const token = await issueToken(target.id, "reset_password");
  const { delivered } = await sendPasswordResetEmail(target.email, token);

  return jsonOk({
    ok: true,
    message: delivered
      ? `A reset link has been sent to ${target.email}.`
      : "Email isn't configured here — the reset link was written to the server log.",
  });
});
