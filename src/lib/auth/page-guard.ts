import "server-only";

import { redirect } from "next/navigation";

import type { User } from "@/db";
import { optionalUser } from "./guards";

/**
 * Page-level equivalents of the API guards.
 *
 * A signed-out visitor gets a redirect to sign-in carrying where they were
 * headed, rather than a 401 they can't act on. As with the API guards, the role
 * is read from the live user row — never from the session cookie's claim.
 */
export async function requirePageUser(next: string): Promise<User> {
  const user = await optionalUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requirePageAdmin(next: string): Promise<User> {
  const user = await requirePageUser(next);
  // A non-admin who guesses an admin URL gets a 404, not a "forbidden" page
  // that confirms the route exists.
  if (user.role !== "admin") redirect("/");
  return user;
}
