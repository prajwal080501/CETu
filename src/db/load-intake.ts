/**
 * Load branch-wise seat intake (from pipeline/parse_intake.py) into offerings.
 * Matches on (institute dte_code, branch name) to the offerings already created
 * from cutoff data.
 *
 * Run: MONGODB_URI=... tsx src/db/load-intake.ts seats.jsonl
 */
import { readFileSync } from "node:fs";
import { mongoClient } from "./mongo";
import { collections } from "./collections";

interface IntakeRow {
  institute_code: string;
  choice_code: string;
  branch: string;
  sanction_intake: number;
  cap_seats: number;
  ms_seats: number;
  minority_seats: number;
  ai_seats: number;
  institute_seats: number;
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("usage: tsx src/db/load-intake.ts seats.jsonl");
  await mongoClient.connect();
  const rows: IntakeRow[] = readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  console.log(`read ${rows.length} intake rows`);

  const collegeRows = await collections
    .colleges()
    .find({}, { projection: { dteCode: 1 } })
    .toArray();
  const collegeByDte = new Map(collegeRows.map((c) => [c.dteCode, c._id]));
  const branchRows = await collections
    .branches()
    .find({}, { projection: { name: 1 } })
    .toArray();
  const branchByName = new Map(branchRows.map((b) => [b.name, b._id]));

  let matched = 0;
  const unmatched: string[] = [];
  for (const r of rows) {
    const collegeId = collegeByDte.get(r.institute_code);
    const branchId = branchByName.get(r.branch);
    if (!collegeId || !branchId) {
      unmatched.push(`${r.institute_code}|${r.branch}`);
      continue;
    }
    const res = await collections.offerings().updateOne(
      { collegeId, branchId },
      {
        $set: {
          totalIntake: r.sanction_intake,
          capSeats: r.cap_seats,
          msSeats: r.ms_seats,
          minoritySeats: r.minority_seats,
          aiSeats: r.ai_seats,
        },
      }
    );
    if (res.matchedCount) matched++;
    else unmatched.push(`${r.institute_code}|${r.branch}`);
  }
  console.log(`updated ${matched} offerings with seats; ${unmatched.length} unmatched`);
  if (unmatched.length) console.log("  e.g.", unmatched.slice(0, 6).join("  ·  "));
  await mongoClient.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
