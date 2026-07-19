import { db } from "@/db";
import {
  colleges,
  branches,
  collegeBranches,
  cutoffs,
  categories,
  universities,
  nirfRankings,
  placements,
  alumni,
  collegeDocuments,
  fees,
} from "@/db/schema";

const FEE_YEAR = 2025; // must match FEE_YEAR in app/actions/admin-meta.ts
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import type { CutoffRow } from "./predictor";
import type { SeatType } from "./reference";
import { s3Enabled, isS3Key, signedGetUrl } from "./s3";

// Predictor reference data (categories, universities, offering labels, cities)
// changes only on ingestion — cache it. Note: unstable_cache serializes to JSON,
// so anything cached must be a plain array/object (never a Map).
const PREDICTOR_REVALIDATE = 3600; // 1 hour

/** All colleges with their home-university name, for the directory. */
export async function listColleges() {
  return db
    .select({
      id: colleges.id,
      name: colleges.name,
      slug: colleges.slug,
      city: colleges.city,
      district: colleges.district,
      type: colleges.type,
      university: universities.name,
      universityShort: universities.shortName,
    })
    .from(colleges)
    .leftJoin(universities, eq(colleges.homeUniversityId, universities.id))
    .where(eq(colleges.hidden, false))
    .orderBy(colleges.name);
}

export async function getCollegeBySlug(slug: string) {
  const [college] = await db
    .select({
      id: colleges.id,
      dteCode: colleges.dteCode,
      name: colleges.name,
      slug: colleges.slug,
      city: colleges.city,
      district: colleges.district,
      type: colleges.type,
      isAutonomous: colleges.isAutonomous,
      aicteApproved: colleges.aicteApproved,
      naacGrade: colleges.naacGrade,
      naacCgpa: colleges.naacCgpa,
      naacValidUpto: colleges.naacValidUpto,
      naacSource: colleges.naacSource,
      avgFeeAnnual: colleges.avgFeeAnnual,
      website: colleges.website,
      homeUniversityId: colleges.homeUniversityId,
      university: universities.name,
    })
    .from(colleges)
    .leftJoin(universities, eq(colleges.homeUniversityId, universities.id))
    .where(and(eq(colleges.slug, slug), eq(colleges.hidden, false)));
  return college ?? null;
}

/** Verified placements for a college, newest year first. */
export async function getCollegePlacements(collegeId: number) {
  return db
    .select({
      year: placements.year,
      avg: placements.avgPackageLpa,
      median: placements.medianPackageLpa,
      highest: placements.highestPackageLpa,
      rate: placements.placementRatePct,
      recruiters: placements.topRecruiters,
      source: placements.source,
    })
    .from(placements)
    .where(and(eq(placements.collegeId, collegeId), isNotNull(placements.verifiedAt)))
    .orderBy(desc(placements.year));
}

/** Official PDFs for a college (placement reports, institutional-round cutoffs).
 * Admin-uploaded docs store an S3 key in `url`; resolve those to a short-lived
 * presigned URL. Legacy external http(s) URLs (seeded docs) pass through. */
export async function getCollegeDocuments(collegeId: number) {
  const rows = await db
    .select({
      docType: collegeDocuments.docType,
      year: collegeDocuments.year,
      title: collegeDocuments.title,
      url: collegeDocuments.url,
    })
    .from(collegeDocuments)
    .where(eq(collegeDocuments.collegeId, collegeId))
    .orderBy(desc(collegeDocuments.year));

  return Promise.all(
    rows.map(async (d) => ({
      ...d,
      url:
        s3Enabled && isS3Key(d.url)
          ? await signedGetUrl(d.url).catch(() => d.url)
          : d.url,
    }))
  );
}

/** Verified alumni for a college (with photo/company/role), newest batch first. */
export async function getCollegeAlumni(collegeId: number) {
  const rows = await db
    .select({
      name: alumni.name,
      achievement: alumni.achievement,
      company: alumni.company,
      role: alumni.role,
      batchYear: alumni.batchYear,
      linkedinUrl: alumni.linkedinUrl,
      photoUrl: alumni.photoUrl,
    })
    .from(alumni)
    .where(and(eq(alumni.collegeId, collegeId), isNotNull(alumni.verifiedAt)))
    .orderBy(desc(alumni.batchYear), alumni.name);

  return Promise.all(
    rows.map(async (a) => ({
      ...a,
      photoUrl:
        a.photoUrl && s3Enabled && isS3Key(a.photoUrl)
          ? await signedGetUrl(a.photoUrl).catch(() => null)
          : a.photoUrl,
    }))
  );
}

/** Latest NIRF Engineering ranking for a college (or null). */
export async function getCollegeNirf(collegeId: number) {
  const [row] = await db
    .select({
      year: nirfRankings.year,
      rank: nirfRankings.rank,
      band: nirfRankings.band,
      score: nirfRankings.score,
    })
    .from(nirfRankings)
    .where(eq(nirfRankings.collegeId, collegeId))
    .orderBy(desc(nirfRankings.year))
    .limit(1);
  return row ?? null;
}

/** Aggregate stats for a college's overview header. */
export async function getCollegeOverview(collegeId: number) {
  const [row] = await db
    .select({
      branches: sql<number>`count(distinct ${collegeBranches.branchId})::int`,
      totalSeats: sql<number>`coalesce(sum(${collegeBranches.totalIntake}), 0)::int`,
    })
    .from(collegeBranches)
    .where(eq(collegeBranches.collegeId, collegeId));
  return row ?? { branches: 0, totalSeats: 0 };
}

/** Branch offerings at a college with intake. */
export async function getCollegeBranches(collegeId: number) {
  return db
    .select({
      collegeBranchId: collegeBranches.id,
      branchId: branches.id,
      branchName: branches.name,
      branchSlug: branches.slug,
      degree: branches.degree,
      family: branches.family,
      totalIntake: collegeBranches.totalIntake,
      capSeats: collegeBranches.capSeats,
      msSeats: collegeBranches.msSeats,
      aiSeats: collegeBranches.aiSeats,
      minoritySeats: collegeBranches.minoritySeats,
      fee: fees.annualTuition,
    })
    .from(collegeBranches)
    .innerJoin(branches, eq(collegeBranches.branchId, branches.id))
    .leftJoin(
      fees,
      and(
        eq(fees.collegeBranchId, collegeBranches.id),
        eq(fees.year, FEE_YEAR),
        eq(fees.categoryGroup, "open")
      )
    )
    .where(eq(collegeBranches.collegeId, collegeId))
    .orderBy(branches.family, branches.name);
}

/** Verified cutoff rows for one offering, newest year first. */
export async function getCutoffsForOffering(collegeBranchId: number) {
  return db
    .select({
      year: cutoffs.year,
      round: cutoffs.round,
      seatType: cutoffs.seatType,
      categoryCode: categories.code,
      categoryLabel: categories.label,
      closingPercentile: cutoffs.closingPercentile,
    })
    .from(cutoffs)
    .innerJoin(categories, eq(cutoffs.categoryId, categories.id))
    .where(
      and(
        eq(cutoffs.collegeBranchId, collegeBranchId),
        isNotNull(cutoffs.verifiedAt)
      )
    )
    .orderBy(desc(cutoffs.year));
}

/**
 * Load all verified cutoff rows for a given year in predictor shape, grouped by
 * offering. This is the dataset the rules-based predictor runs over.
 */
export async function loadCutoffRowsForYear(
  year: number
): Promise<Map<number, CutoffRow[]>> {
  const rows = await db
    .select({
      collegeBranchId: cutoffs.collegeBranchId,
      collegeId: colleges.id,
      collegeHomeUniversityId: colleges.homeUniversityId,
      seatType: cutoffs.seatType,
      categoryCode: categories.code,
      closingPercentile: cutoffs.closingPercentile,
    })
    .from(cutoffs)
    .innerJoin(
      collegeBranches,
      eq(cutoffs.collegeBranchId, collegeBranches.id)
    )
    .innerJoin(colleges, eq(collegeBranches.collegeId, colleges.id))
    .innerJoin(categories, eq(cutoffs.categoryId, categories.id))
    .where(and(eq(cutoffs.year, year), isNotNull(cutoffs.verifiedAt)));

  const byOffering = new Map<number, CutoffRow[]>();
  for (const r of rows) {
    const row: CutoffRow = {
      collegeBranchId: r.collegeBranchId,
      collegeId: r.collegeId,
      collegeHomeUniversityId: r.collegeHomeUniversityId,
      seatType: r.seatType as SeatType,
      categoryCode: r.categoryCode,
      closingPercentile:
        r.closingPercentile == null ? null : Number(r.closingPercentile),
    };
    const list = byOffering.get(r.collegeBranchId);
    if (list) list.push(row);
    else byOffering.set(r.collegeBranchId, [row]);
  }
  return byOffering;
}

/**
 * College-wide cutoff matrix for the latest year with data: one row per
 * (branch, category, seat type). The UI pivots this into category-rows ×
 * branch-columns with a seat-type toggle and branch filter.
 */
export async function getCollegeCutoffMatrix(collegeId: number) {
  const rows = await db
    .select({
      branchName: branches.name,
      branchFamily: branches.family,
      categoryCode: categories.code,
      categoryLabel: categories.label,
      categoryGroup: categories.group,
      seatType: cutoffs.seatType,
      year: cutoffs.year,
      closingPercentile: cutoffs.closingPercentile,
      closingMeritNo: cutoffs.closingMeritNo,
    })
    .from(cutoffs)
    .innerJoin(collegeBranches, eq(cutoffs.collegeBranchId, collegeBranches.id))
    .innerJoin(branches, eq(collegeBranches.branchId, branches.id))
    .innerJoin(categories, eq(cutoffs.categoryId, categories.id))
    .where(
      and(
        eq(collegeBranches.collegeId, collegeId),
        isNotNull(cutoffs.verifiedAt)
      )
    );
  if (rows.length === 0) return { year: null, rows: [] };
  const latestYear = Math.max(...rows.map((r) => r.year));
  return {
    year: latestYear,
    rows: rows
      .filter((r) => r.year === latestYear)
      .map((r) => ({
        branchName: r.branchName,
        branchFamily: r.branchFamily,
        categoryCode: r.categoryCode,
        categoryLabel: r.categoryLabel,
        categoryGroup: r.categoryGroup,
        seatType: r.seatType as string,
        closingPercentile:
          r.closingPercentile == null ? null : Number(r.closingPercentile),
        closingMeritNo: r.closingMeritNo,
      })),
  };
}

/** Distinct cities (with college counts) for the predictor location filter. */
export const getPredictorCities = unstable_cache(
  async () => {
    const rows = await db
      .select({
        city: colleges.city,
        n: sql<number>`count(*)::int`,
      })
      .from(colleges)
      .where(isNotNull(colleges.city))
      .groupBy(colleges.city)
      .orderBy(sql`count(*) desc`, colleges.city);
    return rows.filter((r) => r.city);
  },
  ["predictor-cities"],
  { revalidate: PREDICTOR_REVALIDATE },
);

/**
 * All verified cutoff rows across years, grouped by offering, in the shape the
 * trend-aware predictor consumes. Enables projecting next year's cutoff.
 */
export async function loadCutoffHistory(): Promise<
  Map<number, import("./predictor").CutoffHistoryRow[]>
> {
  const rows = await db
    .select({
      collegeBranchId: cutoffs.collegeBranchId,
      collegeId: colleges.id,
      collegeHomeUniversityId: colleges.homeUniversityId,
      seatType: cutoffs.seatType,
      categoryCode: categories.code,
      year: cutoffs.year,
      closingPercentile: cutoffs.closingPercentile,
    })
    .from(cutoffs)
    .innerJoin(collegeBranches, eq(cutoffs.collegeBranchId, collegeBranches.id))
    .innerJoin(colleges, eq(collegeBranches.collegeId, colleges.id))
    .innerJoin(categories, eq(cutoffs.categoryId, categories.id))
    .where(isNotNull(cutoffs.verifiedAt));

  const byOffering = new Map<number, import("./predictor").CutoffHistoryRow[]>();
  for (const r of rows) {
    const row = {
      collegeBranchId: r.collegeBranchId,
      collegeId: r.collegeId,
      collegeHomeUniversityId: r.collegeHomeUniversityId,
      seatType: r.seatType as import("./reference").SeatType,
      categoryCode: r.categoryCode,
      year: r.year,
      closingPercentile:
        r.closingPercentile == null ? null : Number(r.closingPercentile),
    };
    const list = byOffering.get(r.collegeBranchId);
    if (list) list.push(row);
    else byOffering.set(r.collegeBranchId, [row]);
  }
  return byOffering;
}

/**
 * Cached raw arrays for the predictor form. Kept separate from getPredictorMeta
 * because unstable_cache can only store serializable values — the Map is built
 * from these arrays per-request (cheap) in getPredictorMeta below.
 */
const getPredictorMetaRaw = unstable_cache(
  async () => {
    const [cats, univs, cbs] = await Promise.all([
      db.select().from(categories),
      db.select().from(universities).orderBy(universities.name),
      db
        .select({
          collegeBranchId: collegeBranches.id,
          collegeName: colleges.name,
          collegeSlug: colleges.slug,
          city: colleges.city,
          branchName: branches.name,
        })
        .from(collegeBranches)
        .innerJoin(colleges, eq(collegeBranches.collegeId, colleges.id))
        .innerJoin(branches, eq(collegeBranches.branchId, branches.id)),
    ]);
    return { categories: cats, universities: univs, offerings: cbs };
  },
  ["predictor-meta"],
  { revalidate: PREDICTOR_REVALIDATE },
);

/** Lightweight lookups for predictor form + result rendering. */
export async function getPredictorMeta() {
  const { categories: cats, universities: univs, offerings } =
    await getPredictorMetaRaw();
  const offeringInfo = new Map(offerings.map((c) => [c.collegeBranchId, c]));
  return { categories: cats, universities: univs, offeringInfo };
}
