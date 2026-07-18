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

// A hosted transaction pooler (Supabase Supavisor / Neon pooler) multiplexes
// connections server-side, so a normal client pool is fine — but transaction
// mode does NOT support prepared statements, so disable them in production.
const isServerless = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

const client =
  globalForDb._pgClient ??
  postgres(connectionString ?? "postgres://localhost:5432/college_analyser", {
    max: 10,
    prepare: !isServerless,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb._pgClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
