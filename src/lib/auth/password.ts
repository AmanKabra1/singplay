import "server-only";

import { compare, hash } from "bcryptjs";
import { z } from "zod";

const COST = 12;

export function hashPassword(plain: string) {
  return hash(plain, COST);
}

export function verifyPassword(plain: string, hashed: string) {
  return compare(plain, hashed);
}

/**
 * Password policy. Deliberately checks length first so the message the user
 * sees names the single most useful thing to fix.
 */
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Passwords can be at most 72 characters.")
  .refine((v) => /[a-z]/i.test(v), "Include at least one letter.")
  .refine((v) => /\d/.test(v), "Include at least one number.");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .pipe(z.email("That doesn't look like a valid email address."))
  .transform((v) => v.toLowerCase());

// The strength meter lives in its own client-safe module — this file is
// `server-only`, and the signup form needs to score passwords in the browser.
export { passwordStrength } from "./password-strength";
