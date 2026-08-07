import { desc, or, sql } from "drizzle-orm";

import { getDb, users } from "@/db";
import { jsonOk, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/guards";
import { userActivity } from "@/lib/server/analytics";
import { readPagination } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  await requireAdmin();

  const url = new URL(request.url);
  const { limit, offset } = readPagination(url, 25, 100);
  const q = url.searchParams.get("q")?.trim();

  // `lower()` on both sides because TiDB's default `utf8mb4_bin` collation makes
  // LIKE case-sensitive — searching "aman" would otherwise miss "Aman".
  const pattern = q ? `%${q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const where = pattern
    ? or(
        sql`lower(${users.email}) like ${pattern}`,
        sql`lower(${users.displayName}) like ${pattern}`,
      )
    : undefined;

  const db = getDb();
  const [rows, counted] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        role: users.role,
        status: users.status,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
        hasPassword: sql<number>`case when ${users.passwordHash} is null then 0 else 1 end`,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(users).where(where),
  ]);

  const plays = await userActivity(rows.map((row) => row.id));

  return jsonOk({
    items: rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      role: row.role,
      status: row.status,
      verified: row.emailVerifiedAt !== null,
      hasPassword: Number(row.hasPassword) === 1,
      createdAt: row.createdAt.toISOString(),
      plays30d: plays.get(row.id) ?? 0,
    })),
    total: Number(counted[0]?.total ?? 0),
    limit,
    offset,
  });
});
