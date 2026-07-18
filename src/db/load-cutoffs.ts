/**
 * Load parsed CAP cutoff rows (JSONL from pipeline/parse_cutoff.py) into
 * Postgres. Upserts universities, colleges, branches, categories and
 * college-branch offerings, then inserts cutoffs.
 *
 * Faithful-first: every distinct branch string and base category from the PDF
 * becomes its own row (lossless).
 *
 * Two entry points:
 *  - CLI: `DATABASE_URL=... tsx src/db/load-cutoffs.ts rows.jsonl` (verifies rows).
 *  - `loadCutoffRows(rows, opts)`: importable by the admin upload flow, which
 *    loads rows as PENDING (`verifiedAt: null`) linked to a sourceDocument.
 */
import { readFileSync, existsSync } from "node:fs";
import { db } from "./index";
import {
  categories,
  universities,
  branches,
  colleges,
  collegeBranches,
  cutoffs,
} from "./schema";
import { sql } from "drizzle-orm";
import { inferUniversity, extractCity, branchFamily } from "@/lib/normalize";

export interface ParsedRow {
  year: number;
  round: number;
  institute_code: string;
  institute_name: string;
  home_university: string;
  college_status: string;
  choice_code: string;
  branch: string;
  seat_section: string; // HU | HU_OHU | OHU | SL | AI | MI
  category_token: string;
  base_category: string;
  merit_no: number;
  percentile: number;
}

type SeatType = "HU" | "HU_OHU" | "OHU" | "SL" | "AI" | "MI" | "INST";

// "Autonomous Institute" / "Deemed to be University" are not real universities;
// such colleges have no HU/OHU competition, so we leave home_university null.
const NON_UNIVERSITY = new Set([
  "Autonomous Institute",
  "Deemed to be University",
]);

const COLLEGE_TYPE: Record<string, string> = {
  Government: "government",
  "Government Autonomous": "autonomous",
  "Government-Aided": "government_aided",
  "Un-Aided": "private_unaided",
  "University Managed": "university_dept",
  "University Department": "university_dept",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}

// Coarse UI group from a base category code.
function categoryGroup(code: string): string {
  if (code === "EWS") return "ews";
  if (code === "TFWS") return "tfws";
  if (code === "MI") return "special";
  if (code === "ORPHAN") return "special";
  if (code.startsWith("PWD") || code.startsWith("DEF")) return "special";
  const core = code.replace(/^[GL]/, "");
  if (core.startsWith("OPEN")) return "open";
  if (core.startsWith("SC")) return "sc";
  if (core.startsWith("ST")) return "st";
  if (core.startsWith("VJ") || core.startsWith("NT")) return "vjnt";
  if (core.startsWith("OBC") || core.startsWith("SEBC")) return "obc";
  return "other";
}

function categoryLabel(code: string): string {
  const ladies = code.startsWith("L") ? "Ladies " : "";
  return `${ladies}${code}`.trim();
}

export interface LoadSummary {
  universities: number;
  categories: number;
  branches: number;
  colleges: number;
  offerings: number;
  cutoffs: number;
}

/**
 * Upsert reference data + offerings and insert cutoffs for `rows`.
 * `opts.verifiedAt` — pass `new Date()` for the trusted CLI pipeline, or `null`
 * to stage rows for admin approval. `opts.sourceDocumentId` links the cutoffs to
 * their provenance record (used to approve/reject a batch).
 */
export async function loadCutoffRows(
  rows: ParsedRow[],
  opts: { verifiedAt: Date | null; sourceDocumentId?: number }
): Promise<LoadSummary> {
  // Authoritative institute -> home-university crosswalk. Optional; falls back
  // to the per-row value. Path via CET_UNIV_XWALK.
  const xwalkPath = process.env.CET_UNIV_XWALK;
  const crosswalk: Record<string, string> =
    xwalkPath && existsSync(xwalkPath)
      ? JSON.parse(readFileSync(xwalkPath, "utf8"))
      : {};
  const homeUnivOf = (r: ParsedRow): string => {
    const x = crosswalk[r.institute_code];
    if (x) return x;
    if (r.home_university && !NON_UNIVERSITY.has(r.home_university))
      return r.home_university;
    if (/autonomous/i.test(r.college_status)) return "";
    return inferUniversity(r.institute_name) ?? "";
  };

  // --- universities -------------------------------------------------------
  const uniNames = [...new Set(rows.map(homeUnivOf).filter((u) => u.length > 0))];
  if (uniNames.length)
    await db
      .insert(universities)
      .values(uniNames.map((name) => ({ name })))
      .onConflictDoNothing();
  const uniRows = await db.select().from(universities);
  const uniByName = new Map(uniRows.map((u) => [u.name, u.id]));

  // --- categories ---------------------------------------------------------
  const catCodes = [...new Set(rows.map((r) => r.base_category))];
  if (catCodes.length)
    await db
      .insert(categories)
      .values(
        catCodes.map((code) => ({
          code,
          label: categoryLabel(code),
          group: categoryGroup(code),
        }))
      )
      .onConflictDoNothing();
  const catRows = await db.select().from(categories);
  const catByCode = new Map(catRows.map((c) => [c.code, c.id]));

  // --- branches -----------------------------------------------------------
  const branchNames = [...new Set(rows.map((r) => r.branch))];
  const seen = new Map<string, number>();
  const branchValues = branchNames.map((name) => {
    let slug = slugify(name);
    const n = seen.get(slug) ?? 0;
    seen.set(slug, n + 1);
    if (n > 0) slug = `${slug}-${n}`;
    return { name, slug, family: branchFamily(name) };
  });
  if (branchValues.length)
    await db.insert(branches).values(branchValues).onConflictDoNothing();
  const branchRows = await db.select().from(branches);
  const branchByName = new Map(branchRows.map((b) => [b.name, b.id]));

  // --- colleges -----------------------------------------------------------
  const byCode = new Map<string, ParsedRow>();
  for (const r of rows) if (!byCode.has(r.institute_code)) byCode.set(r.institute_code, r);
  const collegeValues = [...byCode.values()].map((r) => {
    const uName = homeUnivOf(r);
    const homeUniversityId = uName ? uniByName.get(uName) ?? null : null;
    return {
      dteCode: r.institute_code,
      name: r.institute_name,
      slug: `${slugify(r.institute_name)}-${r.institute_code}`,
      city: extractCity(r.institute_name),
      homeUniversityId,
      type: (COLLEGE_TYPE[r.college_status] ?? null) as
        | "government"
        | "autonomous"
        | "government_aided"
        | "private_unaided"
        | "university_dept"
        | null,
      isAutonomous: /autonomous/i.test(r.college_status),
    };
  });
  if (collegeValues.length)
    await db
      .insert(colleges)
      .values(collegeValues)
      .onConflictDoUpdate({
        target: colleges.dteCode,
        set: {
          name: sql`excluded.name`,
          city: sql`coalesce(excluded.city, ${colleges.city})`,
          homeUniversityId: sql`coalesce(excluded.home_university_id, ${colleges.homeUniversityId})`,
          type: sql`coalesce(excluded.type, ${colleges.type})`,
          isAutonomous: sql`${colleges.isAutonomous} or excluded.is_autonomous`,
        },
      });
  const collegeRows = await db.select().from(colleges);
  const collegeByCode = new Map(collegeRows.map((c) => [c.dteCode, c.id]));

  // --- college_branches (offerings) --------------------------------------
  const offerings = new Map<string, { collegeId: number; branchId: number }>();
  for (const r of rows) {
    const key = `${r.institute_code}|${r.branch}`;
    if (offerings.has(key)) continue;
    const collegeId = collegeByCode.get(r.institute_code);
    const branchId = branchByName.get(r.branch);
    if (collegeId && branchId) offerings.set(key, { collegeId, branchId });
  }
  if (offerings.size)
    await db
      .insert(collegeBranches)
      .values([...offerings.values()].map((o) => ({ collegeId: o.collegeId, branchId: o.branchId })))
      .onConflictDoNothing();
  const cbRows = await db
    .select({ id: collegeBranches.id, collegeId: collegeBranches.collegeId, branchId: collegeBranches.branchId })
    .from(collegeBranches);
  const cbByKey = new Map(cbRows.map((c) => [`${c.collegeId}|${c.branchId}`, c.id]));

  // --- cutoffs ------------------------------------------------------------
  const cutoffValues = [];
  for (const r of rows) {
    const collegeId = collegeByCode.get(r.institute_code);
    const branchId = branchByName.get(r.branch);
    const categoryId = catByCode.get(r.base_category);
    if (!collegeId || !branchId || !categoryId) continue;
    const cbId = cbByKey.get(`${collegeId}|${branchId}`);
    if (!cbId) continue;
    cutoffValues.push({
      collegeBranchId: cbId,
      year: r.year,
      round: r.round,
      seatType: r.seat_section as SeatType,
      categoryId,
      choiceCode: r.choice_code,
      closingPercentile: String(r.percentile),
      closingMeritNo: r.merit_no,
      sourceDocumentId: opts.sourceDocumentId ?? null,
      verifiedAt: opts.verifiedAt,
    });
  }
  const CHUNK = 1000;
  for (let i = 0; i < cutoffValues.length; i += CHUNK) {
    await db
      .insert(cutoffs)
      .values(cutoffValues.slice(i, i + CHUNK))
      .onConflictDoNothing();
  }

  return {
    universities: uniNames.length,
    categories: catCodes.length,
    branches: branchNames.length,
    colleges: collegeValues.length,
    offerings: offerings.size,
    cutoffs: cutoffValues.length,
  };
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("usage: tsx src/db/load-cutoffs.ts rows.jsonl");

  const rows: ParsedRow[] = readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  console.log(`read ${rows.length} parsed rows`);

  const s = await loadCutoffRows(rows, { verifiedAt: new Date() });

  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(cutoffs);
  console.log(
    `loaded: ${s.universities} universities, ${s.categories} categories, ` +
      `${s.branches} branches, ${s.colleges} colleges, ${s.offerings} offerings, ` +
      `${s.cutoffs} cutoff rows -> ${n} total in DB`
  );
  process.exit(0);
}

// Run main() only when invoked directly as a CLI (not when imported).
if (process.argv[1] && /load-cutoffs\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
