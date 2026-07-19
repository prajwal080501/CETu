# CETu — PostgreSQL → MongoDB Migration Plan

> **Decision:** You've chosen to migrate off Postgres to MongoDB Atlas. This plan
> makes that migration clean and low-risk. Two things to keep in mind so
> expectations are right (both discussed already):
> 1. **This is a rewrite of the data layer, not a config change.** Drizzle is
>    SQL-only and gets removed entirely; every query and write is re-authored.
> 2. **The Atlas free tier (M0) has the same class of limits** that bit us on
>    Supabase — shared throttled compute, cold pauses, and a connection cap. The
>    serverless connection-singleton pattern below is mandatory, exactly like the
>    `max`-bounded pool was on pg. Migrating does not remove infra tuning; it
>    moves it.
>
> The plan is phased so the app keeps working on Postgres until the very last
> cutover step.

---

## 1. Target stack

| Layer | Now (Postgres) | After (MongoDB) |
|---|---|---|
| Database | Supabase Postgres | **MongoDB Atlas** (M0 to start; replica set — needed for transactions) |
| Driver | `postgres` (postgres.js) | **`mongodb`** official Node driver |
| ORM/schema | `drizzle-orm` + `drizzle-kit` | **none** — native driver + a thin typed helper (+ optional `zod` for write validation) |
| Query style | SQL (`db.execute` + query builder) | `find()` / **aggregation pipelines** |
| Migrations | `drizzle-kit push` | `createIndex()` calls in a one-shot `ensure-indexes` script |

**Why the native driver, not Mongoose/Prisma:** the app is aggregation-heavy
(rankings, matrices, per-branch demand). The native driver gives direct access to
the aggregation framework, which is where ~20 of our queries land. Mongoose adds a
schema layer we don't need (Mongo is schemaless and our shapes are already
enforced in TypeScript); Prisma's Mongo support is partial and still needs a
replica set. Native driver = the most direct SQL→pipeline mapping.

**Dependencies:** remove `drizzle-orm`, `drizzle-kit`, `postgres`; add `mongodb`
(and optionally `zod`). Delete `drizzle.config.ts`.

---

## 2. Data model (collection design)

**Key decision — reuse the existing integer IDs as `_id`.** Mongo allows any type
for `_id`. Our Postgres `serial` PKs are referenced by number all over the app
(e.g. the predictor keys its `Map` on `collegeBranchId`). Porting each row with
`_id = <its old integer id>` keeps **every foreign-key reference working
unchanged** and makes the data-copy script a near 1:1 transfer. Do **not** switch
to `ObjectId` — that would force rewriting every reference and the predictor.

**Embed vs. reference — the rule:** embed small data that's always read with its
parent; keep large or cross-cut collections flat and **denormalize** the few
fields we filter/group on.

### Collections

| Collection | `_id` | Source table(s) | Shape notes |
|---|---|---|---|
| `colleges` | int | `colleges` **+ embed** `placements`, `nirfRankings`, `fees`(summary), `alumni`, `collegeDocuments` | These sub-tables are small, per-college, and always rendered together on the college page → embed as arrays. `avgFeeAnnual`, `naac*` already live on the college. |
| `branches` | int | `branches` | Reference table (117 docs). |
| `universities` | int | `universities` | Reference (small). |
| `categories` | int | `categories` | Reference (~17). |
| `offerings` | int | `college_branches` | Denormalize `collegeName`, `citySlug`, `branchName`, `family` onto each doc. ~2,340 docs. |
| `cutoffs` | int | `cutoffs` | **Flat + denormalized** — the 65k-row workhorse. Each doc carries `collegeId`, `collegeBranchId`, `branchId`, `family`, `city`, `categoryCode`, `categoryGroup`, `seatType`, `year`, `round`, `closingPercentile` (double), `closingMeritNo`, `verifiedAt`. Denormalizing kills the `$lookup` on the hot predictor/ranking paths. |
| `seatMatrix` | int | `seat_matrix` | Flat, denormalized like `cutoffs`. |
| `sourceDocuments` | int | `source_documents` | Provenance; referenced by `cutoffs`/`seatMatrix` via `sourceDocumentId`. |
| `aiInsights` | int | `ai_insights` | Cache. Or key by `collegeId`. |
| `jobMarket` | int | `job_market` | Cache; unique on `{family, kind}`. |
| `cityEmployers` | int | `city_employers` | Cache; unique on `{city, scope}`. |
| `naacSubmissions` | int | `naac_submissions` | Moderation queue. |
| `preferenceLists` | `userId` (string) | `preference_lists` | Already keyed by Clerk user id → `_id = userId`. |
| `threads` | int | `threads` | Community. |
| `threadReplies` | int | `thread_replies` | Community; `threadId` reference. |

**Why `cutoffs` stays flat (not embedded in colleges):** the predictor and all
ranking queries filter cutoffs *across all colleges* by
`{year, categoryCode, seatType, closingPercentile}`. Embedding them in college
docs would force a full-collection scan of every college on each predict, and a
busy college's cutoff array (branches × years × rounds × categories × seat types)
risks the 16 MB document cap. Flat + indexed is correct.

**Numeric note:** `closing_percentile` is `numeric(10,7)` in pg. Store as a JS
`double` — percentiles (0–100, 7 dp) are well within double precision. Money/CGPA
fields likewise become doubles.

---

## 3. Indexes (recreate explicitly — Mongo won't infer them)

An `scripts/ensure-indexes.ts` run once after data load:

```
cutoffs:      { year:1, round:1, seatType:1, categoryCode:1 }        // lookup
              { collegeBranchId:1 }
              { closingPercentile:-1 }
              { collegeBranchId:1, year:1, round:1, seatType:1, categoryId:1 } unique
seatMatrix:   mirror of cutoffs
colleges:     { slug:1 } unique, { dteCode:1 } unique, { city:1 }, { hidden:1 }
offerings:    { collegeId:1 }, { branchId:1 }, { collegeId:1, branchId:1 } unique
branches:     { slug:1 } unique, { family:1 }
categories:   { code:1 } unique
threads:      { scopeType:1, scopeValue:1 }, { lastActivityAt:-1 }
threadReplies:{ threadId:1 }
jobMarket:    { family:1, kind:1 } unique
cityEmployers:{ city:1, scope:1 } unique
```

The unique indexes replace the Postgres `uniqueIndex`/`unique` constraints and are
what protect the loaders' idempotent upserts.

---

## 4. Connection module (serverless-safe) — replaces `src/db/index.ts`

The single most important file. Same singleton discipline as the pg pool, because
Atlas caps connections and Vercel spins many instances:

```ts
import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI!;
const globalForMongo = globalThis as unknown as { _mongo?: MongoClient };

const client =
  globalForMongo._mongo ??
  new MongoClient(uri, {
    maxPoolSize: Number(process.env.MONGO_POOL_MAX) || 5, // bound per instance
    minPoolSize: 0,
    maxIdleTimeMS: 20_000,
  });
if (process.env.NODE_ENV !== "production") globalForMongo._mongo = client;

// The driver lazily connects on first op and reuses the pool across invocations.
export const db: Db = client.db(process.env.MONGODB_DB || "cetu");
export const col = <T extends Document>(name: string) => db.collection<T>(name);
```

Keep `maxPoolSize` small (the same lesson as `DB_POOL_MAX`). Atlas M0 allows 500
total, but small pools per instance keep headroom.

---

## 5. Query translation — the real work

24 files touch the DB. Break down:

- **~20 raw analytical SQL queries** (`db.execute(sql\`…\`)`) → **aggregation
  pipelines.** These are the hard, high-value ones, concentrated in
  `src/lib/landing.ts`, `src/lib/branch.ts`, `src/lib/queries.ts`,
  `src/lib/admin.ts`.
- **~33 query-builder CRUD calls** (`db.select/insert/update/delete`) → mechanical
  `find/insertOne/updateOne/deleteMany`. Low risk.

### SQL → aggregation mapping (reference)

| SQL construct | MongoDB |
|---|---|
| `JOIN` | denormalized field (preferred) or `$lookup` |
| `GROUP BY … agg()` | `$group` with `$sum/$avg/$max` |
| `WHERE` | `$match` |
| `ORDER BY / LIMIT / OFFSET` | `$sort / $limit / $skip` |
| correlated subquery (our single-pass CTEs) | `$group` stage then `$lookup`/`$merge`, or two pipelines joined in JS |
| `count(distinct x)` | `$group` by `x` then `$count`, or `$addToSet` + `$size` |
| `ilike '%q%'` | `$regex` with `$options:"i"` (we have exactly **1** such usage) |
| `array_agg(... order by ...)[1]` | `$sort` + `$first`/`$top` (Mongo 5.2+ `$top`) |

### The queries that need real thought (call-outs)

1. **`getRankedColleges`** (`landing.ts`) — we already reduced this to two grouped
   scans + join. In Mongo: one `$group` over `cutoffs` (best GOPEN %ile + branch
   per college), one `$group` over `offerings` (seats + branch count), then join
   onto `colleges`. Cleanest as an aggregation on `cutoffs` with `$lookup` to
   colleges, or compute the two group-bys and merge in JS. **Keep the
   `unstable_cache` wrappers — they're framework-level and stay.**
2. **`getBranchCityMatrix`** (`branch.ts`) — five parallel grouped queries →
   five aggregation pipelines. Direct.
3. **`getBranchAnalysis`, `listBranches`** — `$group` over denormalized cutoffs.
4. **`loadCutoffHistory`** (`queries.ts`, predictor) — the easy win: a single
   `find({ verifiedAt: { $ne: null } })` with a projection, then the same JS
   `Map`-building we already have. No join needed thanks to denormalization.
5. **College detail cutoff/seat matrix** (`queries.ts`) — `find` on `cutoffs`
   filtered by `collegeBranchId ∈ [...]`, grouped/pivoted in JS as today.
6. **`getPredictorMeta`** — three `find()`s; keep the "cache raw arrays, build the
   `Map` outside the cache" split we just added (Mongo docs serialize fine, but
   the `Map` still must be built outside `unstable_cache`).

**The `unstable_cache` + `allSettled` resilience work we just did stays as-is** —
it's Next.js-level and independent of the database. Only the query bodies change.

---

## 6. Writes, transactions & cascade deletes

- **Server actions** (`contribute.ts`, `discuss.ts`, `admin-*.ts`) → native
  `insertOne/updateOne/deleteOne`. Mechanical.
- **Transactions:** a few actions do multi-step writes (approve/reject a cutoff
  batch, moderation apply-and-delete, reply increments `thread.replyCount`). Mongo
  multi-doc transactions require a **replica set** — Atlas provides one even on
  M0, so `session.withTransaction()` works. Wrap the multi-step ones.
- **Cascade deletes — MongoDB has none.** Postgres has **11** `onDelete: cascade`
  FKs. Anywhere the app deletes a parent (e.g. a college, a `college_branch`, a
  `source_document`, a thread), we must **manually delete children** (its
  `cutoffs`, `seatMatrix`, embedded arrays, `threadReplies`, …). Enumerate and
  encapsulate these in helper functions. This is the easiest place to introduce
  orphaned data — treat it carefully. Deleting a cutoff batch by
  `sourceDocumentId` is a `deleteMany({ sourceDocumentId })` — straightforward.

---

## 7. Data migration script (`scripts/pg-to-mongo.ts`)

One Node script, run once. Reads from the **existing** Postgres (via the current
drizzle/pg client — still installed until cutover) and bulk-writes to Mongo:

1. Copy reference tables → `universities`, `categories`, `branches` (1:1, keep ids
   as `_id`).
2. Copy `colleges`; for each, `$push` its `placements`, `nirfRankings`, `fees`,
   `alumni`, `collegeDocuments` as embedded arrays (one pass per child table,
   grouped by `collegeId`).
3. Copy `college_branches` → `offerings`, denormalizing `collegeName/city/
   branchName/family` by joining in the script.
4. Copy `cutoffs` and `seat_matrix` in **batches of ~5k** (`bulkWrite` /
   `insertMany`), denormalizing the same fields. 65k rows → a handful of batches.
5. Copy caches + community tables 1:1.
6. Run `ensure-indexes.ts`.
7. **Verify counts** per collection against `SELECT count(*)` from pg (must match:
   colleges 389, cutoffs 65,776, offerings 2,340, branches 117, …).

Because ids are preserved, this is deterministic and re-runnable (drop + reload).

---

## 8. Loaders & pipeline

- **Python parsers are unaffected** (`parse_cutoff.py`, `parse_intake.py`,
  `fetch_nirf.py`) — they emit JSONL, no DB coupling.
- Rewrite the **loaders** that consume JSONL to write Mongo instead of pg:
  `load-cutoffs.ts` (and its exported `loadCutoffRows` used by admin ingest),
  `load-intake.ts`, `load-nirf.ts`, `seed.ts`, `seed-official.ts`, `backtest.ts`.
  Their transform logic stays; only the write layer (drizzle upsert → Mongo
  `bulkWrite` with `updateOne … upsert:true` keyed on the unique index) changes.
- `load-cutoffs.ts`'s `loadCutoffRows(rows, { verifiedAt, sourceDocumentId })` keeps
  its signature; the admin cutoff-ingest action keeps working.

---

## 9. Search (acronym-aware)

`src/lib/search.ts` is **pure TypeScript over an in-memory array** (the client-side
typeahead + `/colleges` filter). It has **zero DB coupling** and needs **no
changes** — it consumes `getSearchIndex()`, which we just repoint to a Mongo
aggregation. The only server-side `ilike` (1 usage) becomes a `$regex`.

---

## 10. Execution order (keeps the app live until cutover)

1. **Provision** Atlas cluster; put `MONGODB_URI`, `MONGODB_DB`, `MONGO_POOL_MAX`
   in `.env.local` + Vercel (don't remove `DATABASE_URL` yet).
2. **Add** `mongodb`; write `src/db/mongo.ts` (§4) alongside the existing pg
   client. Nothing uses it yet.
3. **Write & run** `pg-to-mongo.ts` + `ensure-indexes.ts`; verify counts (§7).
4. **Port read modules** one at a time behind their existing function signatures —
   `landing.ts` → `branch.ts` → `queries.ts` → `compare.ts` → `discuss.ts` →
   `admin.ts` → `employers.ts`/`insights.ts`. Diff each against the pg output on
   the same data (the function signatures don't change, so pages keep compiling).
5. **Port write modules** (`actions/*`, loaders) incl. transactions + manual
   cascades (§6).
6. **Cutover:** delete `src/db/index.ts` (pg), `schema.ts`, `drizzle.config.ts`;
   remove `drizzle-orm`/`drizzle-kit`/`postgres`; drop `DATABASE_URL`. Point
   `db:*` scripts at the new loaders.
7. **Verify** every route in prod (home, colleges + pagination, college detail,
   branches + detail, predictor, compare, discuss, spot, admin).

Each step is independently shippable; the app runs on Postgres until step 6.

---

## 11. Effort & risk

**Rough effort:** ~2–4 focused days. Distribution: connection + migration script +
indexes (~0.5 day), the ~20 aggregation rewrites (~1.5–2 days — the bulk of it),
~33 CRUD conversions + transactions + cascades (~1 day), verification (~0.5 day).

**Risk register:**
- 🔴 **Aggregation correctness** — the ranking/matrix pipelines are subtle
  (`$group` + join semantics ≠ SQL). Mitigation: diff each ported query against pg
  on identical data (we did exactly this for the recent rewrites — 0 mismatches is
  the bar).
- 🔴 **Orphaned data** from missing manual cascades. Mitigation: centralize deletes.
- 🟠 **Serverless connection storms** — the very failure you hit on pg, well-known
  on Mongo+Vercel. Mitigation: the §4 singleton + small `maxPoolSize` (do not skip).
- 🟠 **Free-tier cold starts / throttling persist** on M0 — unchanged from pg.
- 🟢 **Search** — no change (client-side).

**What genuinely gets easier:** `loadCutoffHistory` and any "fetch the whole
document" read (embedded college page data in one round-trip). **What gets
harder:** every ranking/aggregate/matrix query, referential integrity (now manual),
and ad-hoc analytical queries you'd have written in SQL.

---

## 12. Files touched (checklist)

- **New:** `src/db/mongo.ts`, `scripts/pg-to-mongo.ts`, `scripts/ensure-indexes.ts`,
  `src/db/collections.ts` (typed collection accessors + TS interfaces replacing the
  drizzle schema types).
- **Rewrite (reads):** `src/lib/landing.ts`, `branch.ts`, `queries.ts`, `compare.ts`,
  `discuss.ts`, `admin.ts`, `employers.ts`, `insights.ts`, `adzuna.ts`.
- **Rewrite (writes):** `src/app/actions/contribute.ts`, `discuss.ts`,
  `admin-data.ts`, `admin-meta.ts`, `admin-upload.ts`, `insights.ts`,
  `preferences.ts`; `src/app/spot/page.tsx`.
- **Rewrite (loaders):** `src/db/load-cutoffs.ts`, `load-intake.ts`, `load-nirf.ts`,
  `seed.ts`, `seed-official.ts`, `backtest.ts`.
- **Delete at cutover:** `src/db/index.ts`, `src/db/schema.ts`, `drizzle.config.ts`.
- **Unchanged:** `src/lib/search.ts`, all Python in `pipeline/`, every React
  component, the `unstable_cache`/`allSettled` resilience layer.
</content>
