/**
 * Load parsed CAP cutoff rows (JSONL from pipeline/parse_cutoff.py) into
 * MongoDB. Upserts universities, colleges, branches, categories and
 * college-branch offerings, then inserts cutoffs (denormalized).
 *
 * Faithful-first: every distinct branch string and base category from the PDF
 * becomes its own row (lossless).
 *
 * Two entry points:
 *  - CLI: `MONGODB_URI=... tsx src/db/load-cutoffs.ts rows.jsonl` (verifies rows).
 *  - `loadCutoffRows(rows, opts)`: importable by the admin upload flow, which
 *    loads rows as PENDING (`verifiedAt: null`) linked to a sourceDocument.
 */
import { readFileSync, existsSync } from "node:fs";
import { mongoClient } from "./mongo";
import { collections } from "./collections";
import { nextIds } from "./ids";
import { inferUniversity, extractCity, branchFamily } from "@/lib/normalize";
import type { AnyBulkWriteOperation } from "mongodb";
import type { CutoffDoc } from "./collections";

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
type CollegeType =
  | "government" | "autonomous" | "government_aided"
  | "private_unaided" | "university_dept" | null;

// "Autonomous Institute" / "Deemed to be University" are not real universities;
// such colleges have no HU/OHU competition, so we leave home_university null.
const NON_UNIVERSITY = new Set(["Autonomous Institute", "Deemed to be University"]);

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

export async function loadCutoffRows(
  rows: ParsedRow[],
  opts: { verifiedAt: Date | null; sourceDocumentId?: number }
): Promise<LoadSummary> {
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

  // --- universities (upsert by name, generate int ids) --------------------
  const uniNames = [...new Set(rows.map(homeUnivOf).filter((u) => u.length > 0))];
  const uniByName = new Map<string, number>();
  const uniNameById = new Map<number, string>();
  {
    const existing = await collections.universities().find({ name: { $in: uniNames } }).toArray();
    for (const u of existing) { uniByName.set(u.name, u._id); uniNameById.set(u._id, u.name); }
    const missing = uniNames.filter((n) => !uniByName.has(n));
    if (missing.length) {
      const ids = await nextIds("universities", missing.length);
      await collections.universities().insertMany(
        missing.map((name, i) => ({ _id: ids[i], name, shortName: null }))
      );
      missing.forEach((name, i) => { uniByName.set(name, ids[i]); uniNameById.set(ids[i], name); });
    }
  }

  // --- categories (upsert by code) ----------------------------------------
  const catCodes = [...new Set(rows.map((r) => r.base_category))];
  const catByCode = new Map<string, number>();
  {
    const existing = await collections.categories().find({ code: { $in: catCodes } }).toArray();
    for (const c of existing) catByCode.set(c.code, c._id);
    const missing = catCodes.filter((c) => !catByCode.has(c));
    if (missing.length) {
      const ids = await nextIds("categories", missing.length);
      await collections.categories().insertMany(
        missing.map((code, i) => ({
          _id: ids[i], code, label: categoryLabel(code), group: categoryGroup(code),
        }))
      );
      missing.forEach((code, i) => catByCode.set(code, ids[i]));
    }
  }

  // --- branches (upsert by name, dedup slug) ------------------------------
  const branchNames = [...new Set(rows.map((r) => r.branch))];
  const branchByName = new Map<string, number>();
  const familyByName = new Map<string, string | null>();
  for (const name of branchNames) familyByName.set(name, branchFamily(name));
  {
    const existing = await collections.branches().find({ name: { $in: branchNames } }).toArray();
    for (const b of existing) branchByName.set(b.name, b._id);
    const missing = branchNames.filter((n) => !branchByName.has(n));
    if (missing.length) {
      // Ensure globally-unique slugs (check existing slugs too).
      const used = new Set((await collections.branches().find({}, { projection: { slug: 1 } }).toArray()).map((b) => b.slug));
      const ids = await nextIds("branches", missing.length);
      const docs = missing.map((name, i) => {
        let slug = slugify(name);
        let n = 1;
        while (used.has(slug)) slug = `${slugify(name)}-${n++}`;
        used.add(slug);
        return { _id: ids[i], name, slug, degree: "BE", family: branchFamily(name) };
      });
      await collections.branches().insertMany(docs);
      missing.forEach((name, i) => branchByName.set(name, ids[i]));
    }
  }

  // --- colleges (upsert by dteCode, merge; preserve embedded arrays) ------
  const byCode = new Map<string, ParsedRow>();
  for (const r of rows) if (!byCode.has(r.institute_code)) byCode.set(r.institute_code, r);
  const collegeByCode = new Map<string, number>();
  const collegeCity = new Map<number, string | null>();
  const collegeHuId = new Map<number, number | null>();
  const collegeName = new Map<number, string>();
  {
    const codes = [...byCode.keys()];
    const existing = await collections.colleges().find({ dteCode: { $in: codes } }).toArray();
    const existByCode = new Map(existing.map((c) => [c.dteCode, c]));
    const newCodes = codes.filter((c) => !existByCode.has(c));
    const newIds = await nextIds("colleges", newCodes.length);
    const newIdByCode = new Map(newCodes.map((c, i) => [c, newIds[i]]));

    for (const [code, r] of byCode) {
      const uName = homeUnivOf(r);
      const huId = uName ? uniByName.get(uName) ?? null : null;
      const city = extractCity(r.institute_name);
      const type = (COLLEGE_TYPE[r.college_status] ?? null) as CollegeType;
      const isAuto = /autonomous/i.test(r.college_status);
      const existingC = existByCode.get(code);
      if (existingC) {
        const mergedHuId = huId ?? existingC.homeUniversityId ?? null;
        const mergedCity = city ?? existingC.city ?? null;
        await collections.colleges().updateOne(
          { _id: existingC._id },
          {
            $set: {
              name: r.institute_name,
              city: mergedCity,
              homeUniversityId: mergedHuId,
              homeUniversityName: mergedHuId ? uniNameById.get(mergedHuId) ?? existingC.homeUniversityName : existingC.homeUniversityName,
              type: type ?? existingC.type ?? null,
              isAutonomous: existingC.isAutonomous || isAuto,
            },
          }
        );
        collegeByCode.set(code, existingC._id);
        collegeCity.set(existingC._id, mergedCity);
        collegeHuId.set(existingC._id, mergedHuId);
        collegeName.set(existingC._id, r.institute_name);
      } else {
        const id = newIdByCode.get(code)!;
        await collections.colleges().insertOne({
          _id: id,
          dteCode: code,
          name: r.institute_name,
          slug: `${slugify(r.institute_name)}-${code}`,
          city,
          district: null,
          homeUniversityId: huId,
          homeUniversityName: huId ? uniNameById.get(huId) ?? null : null,
          type,
          isAutonomous: isAuto,
          aicteApproved: true,
          naacGrade: null, naacCgpa: null, naacValidUpto: null, naacSource: null,
          nirfInstituteId: null, campusAcres: null, establishedYear: null,
          website: null, avgFeeAnnual: null, hidden: false, createdAt: new Date(),
          placements: [], nirfRankings: [], fees: [], alumni: [], documents: [],
        });
        collegeByCode.set(code, id);
        collegeCity.set(id, city);
        collegeHuId.set(id, huId);
        collegeName.set(id, r.institute_name);
      }
    }
  }

  // --- offerings (upsert by collegeId+branchId) ---------------------------
  const offerings = new Map<string, { collegeId: number; branchId: number }>();
  for (const r of rows) {
    const collegeId = collegeByCode.get(r.institute_code);
    const branchId = branchByName.get(r.branch);
    if (!collegeId || !branchId) continue;
    const key = `${collegeId}|${branchId}`;
    if (!offerings.has(key)) offerings.set(key, { collegeId, branchId });
  }
  const cbByKey = new Map<string, number>();
  {
    const keys = [...offerings.values()];
    const existing = await collections.offerings().find({
      $or: keys.map((o) => ({ collegeId: o.collegeId, branchId: o.branchId })),
    }).toArray();
    for (const o of existing) cbByKey.set(`${o.collegeId}|${o.branchId}`, o._id);
    const missing = keys.filter((o) => !cbByKey.has(`${o.collegeId}|${o.branchId}`));
    if (missing.length) {
      const ids = await nextIds("offerings", missing.length);
      await collections.offerings().insertMany(
        missing.map((o, i) => ({
          _id: ids[i],
          collegeId: o.collegeId,
          collegeName: collegeName.get(o.collegeId) ?? "",
          city: collegeCity.get(o.collegeId) ?? null,
          branchId: o.branchId,
          branchName: branchNames.find((n) => branchByName.get(n) === o.branchId) ?? "",
          family: [...familyByName.entries()].find(([n]) => branchByName.get(n) === o.branchId)?.[1] ?? null,
          totalIntake: null, capSeats: null, msSeats: null, minoritySeats: null,
          aiSeats: null, isNbaAccredited: false,
        }))
      );
      missing.forEach((o, i) => cbByKey.set(`${o.collegeId}|${o.branchId}`, ids[i]));
    }
  }

  // --- cutoffs (denormalized, dedup on unique key via upsert) -------------
  const ops: AnyBulkWriteOperation<CutoffDoc>[] = [];
  const branchFamById = new Map<number, string | null>();
  for (const [name, id] of branchByName) branchFamById.set(id, familyByName.get(name) ?? null);
  for (const r of rows) {
    const collegeId = collegeByCode.get(r.institute_code);
    const branchId = branchByName.get(r.branch);
    const categoryId = catByCode.get(r.base_category);
    if (!collegeId || !branchId || !categoryId) continue;
    const cbId = cbByKey.get(`${collegeId}|${branchId}`);
    if (!cbId) continue;
    const doc: Omit<CutoffDoc, "_id"> = {
      collegeBranchId: cbId,
      collegeId,
      collegeHomeUniversityId: collegeHuId.get(collegeId) ?? null,
      branchId,
      family: branchFamById.get(branchId) ?? null,
      city: collegeCity.get(collegeId) ?? null,
      year: r.year,
      round: r.round,
      seatType: r.seat_section as SeatType,
      categoryId,
      categoryCode: r.base_category,
      categoryGroup: categoryGroup(r.base_category),
      choiceCode: r.choice_code,
      closingPercentile: Number(r.percentile),
      closingMeritNo: r.merit_no,
      sourceDocumentId: opts.sourceDocumentId ?? null,
      verifiedAt: opts.verifiedAt,
      createdAt: new Date(),
    };
    ops.push({
      updateOne: {
        filter: {
          collegeBranchId: cbId, year: r.year, round: r.round,
          seatType: doc.seatType, categoryId,
        },
        update: { $setOnInsert: doc },
        upsert: true,
      },
    });
  }
  const CHUNK = 1000;
  for (let i = 0; i < ops.length; i += CHUNK) {
    await collections.cutoffs().bulkWrite(ops.slice(i, i + CHUNK), { ordered: false });
  }

  return {
    universities: uniNames.length,
    categories: catCodes.length,
    branches: branchNames.length,
    colleges: byCode.size,
    offerings: offerings.size,
    cutoffs: ops.length,
  };
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("usage: tsx src/db/load-cutoffs.ts rows.jsonl");
  await mongoClient.connect();

  const rows: ParsedRow[] = readFileSync(path, "utf8")
    .split("\n").filter(Boolean).map((l) => JSON.parse(l));
  console.log(`read ${rows.length} parsed rows`);

  const s = await loadCutoffRows(rows, { verifiedAt: new Date() });
  const n = await collections.cutoffs().countDocuments();
  console.log(
    `loaded: ${s.universities} universities, ${s.categories} categories, ` +
      `${s.branches} branches, ${s.colleges} colleges, ${s.offerings} offerings, ` +
      `${s.cutoffs} cutoff rows -> ${n} total in DB`
  );
  await mongoClient.close();
  process.exit(0);
}

if (process.argv[1] && /load-cutoffs\.ts$/.test(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
