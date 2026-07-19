/**
 * Create the MongoDB indexes that replace the Postgres unique constraints and
 * lookup indexes. Idempotent — safe to re-run.
 *
 *   MONGODB_URI=... MONGODB_DB=cetu tsx scripts/ensure-indexes.ts
 */
import { mongoClient, db } from "../src/db/mongo";
import { collections } from "../src/db/collections";

/** Seed each id sequence to the current data max, so nextId() never collides. */
async function seedCounters() {
  const topMax = async (coll: string): Promise<number> => {
    const [d] = await db
      .collection(coll)
      .aggregate<{ m: number }>([{ $group: { _id: null, m: { $max: "$_id" } } }])
      .toArray();
    return typeof d?.m === "number" ? d.m : 0;
  };
  const embeddedMax = async (field: string): Promise<number> => {
    const [d] = await collections
      .colleges()
      .aggregate<{ m: number }>([
        { $unwind: `$${field}` },
        { $group: { _id: null, m: { $max: `$${field}.id` } } },
      ])
      .toArray();
    return typeof d?.m === "number" ? d.m : 0;
  };

  const seqs: [string, number][] = [
    ["colleges", await topMax("colleges")],
    ["branches", await topMax("branches")],
    ["universities", await topMax("universities")],
    ["categories", await topMax("categories")],
    ["offerings", await topMax("offerings")],
    ["seatMatrix", await topMax("seatMatrix")],
    ["cutoffs", await topMax("cutoffs")],
    ["sourceDocuments", await topMax("sourceDocuments")],
    ["threads", await topMax("threads")],
    ["threadReplies", await topMax("threadReplies")],
    ["naacSubmissions", await topMax("naacSubmissions")],
    ["placements", await embeddedMax("placements")],
    ["alumni", await embeddedMax("alumni")],
    ["documents", await embeddedMax("documents")],
    ["fees", await embeddedMax("fees")],
    ["nirf", await embeddedMax("nirfRankings")],
  ];
  for (const [seq, max] of seqs) {
    // $max never lowers an already-advanced counter — safe to re-run.
    await db
      .collection<{ _id: string; value: number }>("counters")
      .updateOne({ _id: seq }, { $max: { value: max } }, { upsert: true });
  }
  console.log("✓ counters seeded:", seqs.map(([s, m]) => `${s}=${m}`).join(" "));
}

async function main() {
  await mongoClient.connect();

  await collections.cutoffs().createIndexes([
    { key: { year: 1, round: 1, seatType: 1, categoryCode: 1 }, name: "lookup" },
    { key: { collegeBranchId: 1 }, name: "by_cb" },
    { key: { closingPercentile: -1 }, name: "by_percentile" },
    { key: { verifiedAt: 1 }, name: "by_verified" },
    {
      key: { collegeBranchId: 1, year: 1, round: 1, seatType: 1, categoryId: 1 },
      name: "uq",
      unique: true,
    },
  ]);

  await collections.seatMatrix().createIndexes([
    { key: { collegeBranchId: 1 }, name: "by_cb" },
    {
      key: { collegeBranchId: 1, year: 1, round: 1, seatType: 1, categoryId: 1 },
      name: "uq",
      unique: true,
    },
  ]);

  await collections.colleges().createIndexes([
    { key: { slug: 1 }, name: "slug_uq", unique: true },
    { key: { dteCode: 1 }, name: "dteCode_uq", unique: true },
    { key: { city: 1 }, name: "by_city" },
    { key: { hidden: 1 }, name: "by_hidden" },
  ]);

  await collections.offerings().createIndexes([
    { key: { collegeId: 1 }, name: "by_college" },
    { key: { branchId: 1 }, name: "by_branch" },
    { key: { collegeId: 1, branchId: 1 }, name: "uq", unique: true },
  ]);

  await collections.branches().createIndexes([
    { key: { slug: 1 }, name: "slug_uq", unique: true },
    { key: { family: 1 }, name: "by_family" },
  ]);

  await collections
    .categories()
    .createIndex({ code: 1 }, { name: "code_uq", unique: true });

  await collections
    .universities()
    .createIndex({ name: 1 }, { name: "name_uq", unique: true });

  await collections.threads().createIndexes([
    { key: { scopeType: 1, scopeValue: 1 }, name: "by_scope" },
    { key: { lastActivityAt: -1 }, name: "by_activity" },
  ]);

  await collections
    .threadReplies()
    .createIndex({ threadId: 1 }, { name: "by_thread" });

  await collections
    .jobMarket()
    .createIndex({ family: 1, kind: 1 }, { name: "uq", unique: true });

  await collections
    .cityEmployers()
    .createIndex({ city: 1, scope: 1 }, { name: "uq", unique: true });

  await collections
    .naacSubmissions()
    .createIndex({ collegeId: 1 }, { name: "by_college" });

  await collections
    .aiInsights()
    .createIndex({ collegeId: 1 }, { name: "college_uq", unique: true });

  console.log("✓ indexes ensured");
  await seedCounters();
  await mongoClient.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
