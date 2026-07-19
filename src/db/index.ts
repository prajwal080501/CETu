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

// A hosted pooler (Supabase Supavisor / Neon pooler) sits in front of Postgres.
// Transaction mode does NOT support prepared statements, so disable them in prod.
const isServerless = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

// In serverless, each warm function instance keeps its own pool, and Supabase's
// *session* pooler caps total clients (free tier: 15). Keep per-instance `max`
// small so a few concurrent instances can't exhaust it ("EMAXCONNSESSION: max
// clients reached"). Override with DB_POOL_MAX if you move to a bigger pooler /
// the transaction pooler (which multiplexes and tolerates a higher number).
const poolMax = Number(process.env.DB_POOL_MAX) || (isServerless ? 3 : 10);

const client =
  globalForDb._pgClient ??
  postgres(connectionString ?? "postgres://localhost:5432/college_analyser", {
    max: poolMax,
    prepare: !isServerless,
    idle_timeout: 20, // release idle connections back to the pooler quickly
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb._pgClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
