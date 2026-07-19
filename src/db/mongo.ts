import { MongoClient, type Db, type Document } from "mongodb";

/**
 * Serverless-safe MongoDB client (mirrors the discipline of the old pg pool).
 * MongoDB Atlas caps total connections and Vercel spins many function
 * instances, so we cache a single MongoClient on globalThis and keep the
 * per-instance pool small. The driver connects lazily on first operation and
 * reuses the pool across invocations on a warm instance.
 */
const globalForMongo = globalThis as unknown as { _mongo?: MongoClient };

const uri =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/cetu";

// Keep the per-instance pool small — the same lesson as DB_POOL_MAX on pg.
// Atlas allows many total connections, but small pools per instance leave
// headroom under bursty serverless concurrency.
const poolMax = Number(process.env.MONGO_POOL_MAX) || 5;

const client =
  globalForMongo._mongo ??
  new MongoClient(uri, {
    maxPoolSize: poolMax,
    minPoolSize: 0,
    maxIdleTimeMS: 20_000,
  });

// In dev, cache on globalThis so HMR doesn't open a new client per reload.
if (process.env.NODE_ENV !== "production") {
  globalForMongo._mongo = client;
}

export const mongoClient = client;

export const db: Db = client.db(process.env.MONGODB_DB || "cetu");

/** Typed collection accessor. */
export const col = <T extends Document = Document>(name: string) =>
  db.collection<T>(name);
