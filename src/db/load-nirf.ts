/**
 * Load NIRF Engineering rankings (pipeline/fetch_nirf.py JSONL) into each
 * college's embedded nirfRankings, matching NIRF institute names to our colleges
 * by fuzzy token similarity (+ city bonus + acronym). A manual override map
 * (CET_NIRF_XWALK -> { "<nirf name>": "<dteCode>" }) wins.
 *
 * Run: MONGODB_URI=... [CET_NIRF_XWALK=nirf_manual.json] tsx src/db/load-nirf.ts nirf.jsonl
 */
import { readFileSync, existsSync } from "node:fs";
import { mongoClient } from "./mongo";
import { collections, type CollegeDoc } from "./collections";
import { nextId } from "./ids";
import type { UpdateFilter } from "mongodb";

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
    name.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ")
      .filter((t) => t.length > 1 && !STOP.has(t))
  );
}

function overlap(a: Set<string>, b: Set<string>): { jac: number; inter: number } {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return { jac: union === 0 ? 0 : inter / union, inter };
}

const SKIP = [
  "indian institute of technology", "national institute of technology",
  "visvesvaraya national", "defence institute", "army institute",
  "symbiosis international", "narsee monjee", "rashtrasant tukadoji maharaj nagpur un",
];
const skip = (name: string) => SKIP.some((s) => name.toLowerCase().includes(s));

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("usage: tsx src/db/load-nirf.ts nirf.jsonl");
  await mongoClient.connect();
  const rows: NirfRow[] = readFileSync(path, "utf8")
    .split("\n").filter(Boolean).map((l) => JSON.parse(l));

  const manualPath = process.env.CET_NIRF_XWALK;
  const manual: Record<string, string> =
    manualPath && existsSync(manualPath)
      ? JSON.parse(readFileSync(manualPath, "utf8"))
      : {};

  const collegeRows = await collections
    .colleges()
    .find({}, { projection: { dteCode: 1, name: 1, city: 1 } })
    .toArray();
  const collegeTokens = collegeRows.map((c) => ({ id: c._id, name: c.name, city: c.city, tok: tokens(c.name) }));
  const byDte = new Map(collegeRows.map((c) => [c.dteCode, c._id]));

  const names = [...new Set(rows.map((r) => r.name))];
  const match = new Map<string, { id: number; name: string; score: number } | null>();
  for (const name of names) {
    if (manual[name]) {
      const id = byDte.get(manual[name]);
      if (id) { match.set(name, { id, name: `(manual ${manual[name]})`, score: 1 }); continue; }
    }
    if (skip(name)) { match.set(name, null); continue; }
    const nt = tokens(name);
    const nirfCity = rows.find((r) => r.name === name)?.city?.toLowerCase() ?? "";
    let best: { id: number; name: string; score: number; inter: number } | null = null;
    for (const c of collegeTokens) {
      const { jac, inter } = overlap(nt, c.tok);
      let s = jac;
      if (nirfCity && (c.city ?? "").toLowerCase() && nirfCity.includes((c.city ?? "").toLowerCase()))
        s += 0.08;
      if (!best || s > best.score) best = { id: c.id, name: c.name, score: s, inter };
    }
    match.set(name, best && best.score >= 0.4 && best.inter >= 2 ? best : null);
  }

  const matched = new Set<string>();
  let inserted = 0;
  for (const r of rows) {
    const m = match.get(r.name);
    if (!m) continue;
    matched.add(r.name);
    const score = r.score == null ? null : Number(r.score);
    // Update the existing year's row if present, else push a new one.
    const upd = await collections.colleges().updateOne(
      { _id: m.id, "nirfRankings.year": r.year },
      {
        $set: {
          "nirfRankings.$.rank": r.rank,
          "nirfRankings.$.band": r.band,
          "nirfRankings.$.score": score,
        },
      } as unknown as UpdateFilter<CollegeDoc>
    );
    if (upd.matchedCount === 0) {
      const id = await nextId("nirf");
      await collections.colleges().updateOne(
        { _id: m.id },
        {
          $push: {
            nirfRankings: {
              id, year: r.year, rank: r.rank, band: r.band, score,
              nirfInstituteId: r.nirf_institute_id,
            },
          },
        }
      );
    }
    if (r.nirf_institute_id)
      await collections.colleges().updateOne(
        { _id: m.id },
        { $set: { nirfInstituteId: r.nirf_institute_id } }
      );
    inserted++;
  }

  const [agg] = await collections
    .colleges()
    .aggregate<{ n: number }>([
      { $project: { c: { $size: { $ifNull: ["$nirfRankings", []] } } } },
      { $group: { _id: null, n: { $sum: "$c" } } },
    ])
    .toArray();
  console.log(`matched ${matched.size}/${names.length} NIRF institutes; ${inserted} ranking rows written; ${agg?.n ?? 0} total in DB`);
  const unmatched = names.filter((nm) => !match.get(nm));
  if (unmatched.length) {
    console.log(`\nUNMATCHED (add to CET_NIRF_XWALK):`);
    unmatched.forEach((u) => console.log("  - " + u));
  }
  await mongoClient.close();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
