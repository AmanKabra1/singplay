import "server-only";

import { optionalUser } from "@/lib/auth/guards";
import type { User } from "@/db";

export type Viewer = { id: string | null; isAuthenticated: boolean };

/**
 * The pair every catalog read needs: the live user row (or null) and the small
 * `{ id, isAuthenticated }` descriptor the query helpers take. Resolving both in
 * one place keeps routes from accidentally trusting the cookie's role claim.
 */
export async function currentViewer(): Promise<{ user: User | null; viewer: Viewer }> {
  const user = await optionalUser();
  return {
    user,
    viewer: { id: user?.id ?? null, isAuthenticated: user !== null },
  };
}
