import "server-only";

import { connect } from "@tidbcloud/serverless";
import { drizzle } from "drizzle-orm/tidb-serverless";

import { env } from "@/lib/env";
import * as schema from "./schema";

type Database = ReturnType<typeof create>;

function create() {
  // The TiDB serverless driver speaks HTTP, so there is no connection pool to
  // manage and no cold-start penalty on Vercel's serverless functions.
  const client = connect({ url: env.databaseUrl });
  return drizzle(client, { schema });
}

let cached: Database | undefined;

/**
 * Lazily-created singleton. Deferring creation means importing this module is
 * side-effect free, so `next build` never needs DATABASE_URL to be present.
 */
export function getDb(): Database {
  if (!cached) cached = create();
  return cached;
}

export { schema };
export * from "./schema";
