/**
 * Load NIRF Engineering rankings (pipeline/fetch_nirf.py JSONL) into
 * nirf_rankings, matching NIRF institute names to our colleges by fuzzy token
 * similarity (+ city bonus + acronym). Prints matched/unmatched for review; a
 * manual override map (CET_NIRF_XWALK -> { "<nirf name>": "<dteCode>" }) wins.
 *
 * Run: DATABASE_URL=... [CET_NIRF_XWALK=nirf_manual.json] tsx src/db/load-nirf.ts nirf.jsonl
 */
import { readFileSync, existsSync } from "node:fs";
import { db } from "./index";
import { colleges, nirfRankings } from "./schema";
import { eq, sql } from "drizzle-orm";

interface NirfRow {
  year: number;
  nirf_institute_id: string | null;
  name: string;
  city: string | null;
  state: string;
  score: number | null;
  rank: number | null;
  band: string | null;
}

const STOP = new Set([
  "college", "engineering", "institute", "technology", "of", "and", "the",
  "trust", "charitable", "deemed", "university", "education", "society",
  "mandal", "s", "for", "science", "research", "management", "studies",
  "national", "indian", "shri", "shree", "dr", "prof", "late", "smt",
  "vidyapeeth", "campus", "technical", "polytechnic", "group", "sanstha",
]);

function tokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((t) => t.length > 1 && !STOP.has(t))
  );
}

function overlap(a: Set<string>, b: Set<string>): { jac: number; inter: number } {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return { jac: union === 0 ? 0 : inter / union, inter };
}

// NIRF institutes that are NOT in DTE CAP (separate admission) — never match.
const SKIP = [
  "indian institute of technology",
  "national institute of technology",
  "visvesvaraya national",
  "defence institute",
  "army institute",
  "symbiosis international",
  "narsee monjee",
  "rashtrasant tukadoji maharaj nagpur un",
];
const skip = (name: string) =>
  SKIP.some((s) => name.toLowerCase().includes(s));

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("usage: tsx src/db/load-nirf.ts nirf.jsonl");
  const rows: NirfRow[] = readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const manualPath = process.env.CET_NIRF_XWALK;
  const manual: Record<string, string> =
    manualPath && existsSync(manualPath)
      ? JSON.parse(readFileSync(manualPath, "utf8"))
      : {};

  const collegeRows = await db
    .select({ id: colleges.id, dteCode: colleges.dteCode, name: colleges.name, city: colleges.city })
    .from(colleges);
  const collegeTokens = collegeRows.map((c) => ({ ...c, tok: tokens(c.name) }));
  const byDte = new Map(collegeRows.map((c) => [c.dteCode, c.id]));

  // one match per distinct NIRF institute name
  const names = [...new Set(rows.map((r) => r.name))];
  const match = new Map<string, { id: number; name: string; score: number } | null>();
  for (const name of names) {
    if (manual[name]) {
      const id = byDte.get(manual[name]);
      if (id) {
        match.set(name, { id, name: `(manual ${manual[name]})`, score: 1 });
        continue;
      }
    }
    if (skip(name)) {
      match.set(name, null);
      continue;
    }
    const nt = tokens(name);
    const nirfCity = rows.find((r) => r.name === name)?.city?.toLowerCase() ?? "";
    let best: { id: number; name: string; score: number; inter: number } | null = null;
    for (const c of collegeTokens) {
      const { jac, inter } = overlap(nt, c.tok);
      let s = jac;
      if (nirfCity && (c.city ?? "").toLowerCase() && nirfCity.includes((c.city ?? "").toLowerCase()))
        s += 0.08; // city agreement bonus
      if (!best || s > best.score) best = { id: c.id, name: c.name, score: s, inter };
    }
    // High precision: need a real jaccard AND ≥2 shared distinctive tokens.
    match.set(name, best && best.score >= 0.4 && best.inter >= 2 ? best : null);
  }

  // insert rankings for matched institutes
  const matched = new Set<string>();
  let inserted = 0;
  for (const r of rows) {
    const m = match.get(r.name);
    if (!m) continue;
    matched.add(r.name);
    await db
      .insert(nirfRankings)
      .values({
        collegeId: m.id,
        year: r.year,
        rank: r.rank,
        band: r.band,
        score: r.score == null ? null : String(r.score),
        nirfInstituteId: r.nirf_institute_id,
      })
      .onConflictDoUpdate({
        target: [nirfRankings.collegeId, nirfRankings.year],
        set: { rank: r.rank, band: r.band, score: r.score == null ? null : String(r.score) },
      });
    if (r.nirf_institute_id)
      await db
        .update(colleges)
        .set({ nirfInstituteId: r.nirf_institute_id })
        .where(eq(colleges.id, m.id));
    inserted++;
  }

  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(nirfRankings);
  console.log(`matched ${matched.size}/${names.length} NIRF institutes; ${inserted} ranking rows written; ${n} total in DB`);
  const unmatched = names.filter((nm) => !match.get(nm));
  if (unmatched.length) {
    console.log(`\nUNMATCHED (add to CET_NIRF_XWALK):`);
    unmatched.forEach((u) => console.log("  - " + u));
  }
  console.log(`\nMATCHES:`);
  for (const nm of names) {
    const m = match.get(nm);
    if (m) console.log(`  ${nm.slice(0, 42).padEnd(42)} -> ${m.name.slice(0, 40)} (${m.score.toFixed(2)})`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
