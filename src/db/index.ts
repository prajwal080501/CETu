import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Single shared postgres.js connection + Drizzle client.
 * In dev we cache on globalThis so HMR doesn't open a new pool per reload.
 */
const globalForDb = globalThis as unknown as {
  _pgClient?: ReturnType<typeof postgres>;
};

const connectionString = process.env.DATABASE_URL;

// Serverless-safe pooling. On Vercel each invocation is isolated, so keep the
// pool tiny; Neon's transaction pooler (the `-pooler` connection string) doesn't
// support prepared statements, so disable them in production.
const isServerless = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

const client =
  globalForDb._pgClient ??
  postgres(connectionString ?? "postgres://localhost:5432/college_analyser", {
    max: isServerless ? 1 : 10,
    prepare: !isServerless,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb._pgClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
