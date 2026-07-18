/**
 * Load branch-wise seat intake (from pipeline/parse_intake.py) into
 * college_branches. Matches on (institute dte_code, branch name) to the
 * offerings already created from cutoff data.
 *
 * Run: DATABASE_URL=... tsx src/db/load-intake.ts seats.jsonl
 */
import { readFileSync } from "node:fs";
import { db } from "./index";
import { colleges, branches, collegeBranches } from "./schema";
import { and, eq } from "drizzle-orm";

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
  const rows: IntakeRow[] = readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  console.log(`read ${rows.length} intake rows`);

  const collegeRows = await db
    .select({ id: colleges.id, dteCode: colleges.dteCode })
    .from(colleges);
  const collegeByDte = new Map(collegeRows.map((c) => [c.dteCode, c.id]));
  const branchRows = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches);
  const branchByName = new Map(branchRows.map((b) => [b.name, b.id]));

  let matched = 0;
  const unmatched: string[] = [];
  for (const r of rows) {
    const collegeId = collegeByDte.get(r.institute_code);
    const branchId = branchByName.get(r.branch);
    if (!collegeId || !branchId) {
      unmatched.push(`${r.institute_code}|${r.branch}`);
      continue;
    }
    const res = await db
      .update(collegeBranches)
      .set({
        totalIntake: r.sanction_intake,
        capSeats: r.cap_seats,
        msSeats: r.ms_seats,
        minoritySeats: r.minority_seats,
        aiSeats: r.ai_seats,
      })
      .where(
        and(
          eq(collegeBranches.collegeId, collegeId),
          eq(collegeBranches.branchId, branchId)
        )
      )
      .returning({ id: collegeBranches.id });
    if (res.length) matched++;
    else unmatched.push(`${r.institute_code}|${r.branch}`);
  }
  console.log(
    `updated ${matched} offerings with seats; ${unmatched.length} unmatched`
  );
  if (unmatched.length)
    console.log("  e.g.", unmatched.slice(0, 6).join("  ·  "));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
