import type { Config } from "drizzle-kit";
import { readFileSync } from "fs";

// drizzle-kit runs outside of Next.js, so .env.local isn't auto-loaded.
// Parse it manually — no dotenv dependency required.
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      // Strip surrounding quotes if present ("value" or 'value')
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
} catch {
  // .env.local may not exist in CI / production — that's fine, the real
  // env vars are set in the environment directly there.
}

// drizzle-kit talks to TiDB over the regular MySQL protocol (not the HTTP
// serverless driver), which needs TLS enabled explicitly — hence the separate
// DATABASE_URL_MIGRATE with `?ssl={"rejectUnauthorized":true}` appended.
const url = process.env.DATABASE_URL_MIGRATE || process.env.DATABASE_URL || "";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
} satisfies Config;
