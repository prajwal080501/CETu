import { db } from "@/db";
import { sql, inArray, and, eq, isNotNull } from "drizzle-orm";
import {
  colleges,
  universities,
  collegeBranches,
  branches,
  cutoffs,
  categories,
  nirfRankings,
  placements,
  collegeDocuments,
} from "@/db/schema";

export interface CompareCollege {
  id: number;
  name: string;
  slug: string;
  city: string | null;
  university: string | null;
  type: string | null;
  isAutonomous: boolean | null;
  aicteApproved: boolean | null;
  naacGrade: string | null;
  naacCgpa: number | null;
  campusAcres: number | null;
  totalSeats: number;
  branchCount: number;
  topCutoff: number | null;
  nirf: { year: number; rank: number | null; band: string | null }[];
  latestNirf: { rank: number | null; band: string | null } | null;
  placement: {
    year: number;
    median: number | null;
    highest: number | null;
    rate: number | null;
    recruiters: string | null;
  } | null;
  // Official cutoff / institute-level (SPOT) round PDFs, when available.
  cutoffDocs: { docType: string; year: number | null; title: string; url: string }[];
}

/** Lightweight list of all colleges for the compare picker/typeahead. */
export async function getCollegesLite() {
  return db
    .select({ id: colleges.id, name: colleges.name, city: colleges.city })
    .from(colleges)
    .where(eq(colleges.hidden, false))
    .orderBy(colleges.name);
}

/** College-level comparison payload for the selected colleges (keeps input order). */
export async function getCompareColleges(
  ids: number[]
): Promise<CompareCollege[]> {
  if (ids.length === 0) return [];

  const base = await db
    .select({
      id: colleges.id,
      name: colleges.name,
      slug: colleges.slug,
      city: colleges.city,
      university: universities.name,
      type: colleges.type,
      isAutonomous: colleges.isAutonomous,
      aicteApproved: colleges.aicteApproved,
      naacGrade: colleges.naacGrade,
      naacCgpa: colleges.naacCgpa,
      campusAcres: colleges.campusAcres,
      totalSeats: sql<number>`coalesce((select sum(total_intake) from ${collegeBranches} cb where cb.college_id = ${colleges.id}),0)::int`,
      branchCount: sql<number>`(select count(*) from ${collegeBranches} cb where cb.college_id = ${colleges.id})::int`,
      topCutoff: sql<number | null>`(select max(cu.closing_percentile) from ${collegeBranches} cb join ${cutoffs} cu on cu.college_branch_id = cb.id join ${categories} cat on cat.id = cu.category_id where cb.college_id = ${colleges.id} and cu.year = 2025 and cat.code = 'GOPEN' and cu.verified_at is not null)::float`,
    })
    .from(colleges)
    .leftJoin(universities, eq(colleges.homeUniversityId, universities.id))
    .where(and(inArray(colleges.id, ids), eq(colleges.hidden, false)));

  const nirf = await db
    .select({
      collegeId: nirfRankings.collegeId,
      year: nirfRankings.year,
      rank: nirfRankings.rank,
      band: nirfRankings.band,
    })
    .from(nirfRankings)
    .where(inArray(nirfRankings.collegeId, ids))
    .orderBy(nirfRankings.year);

  const place = await db
    .select({
      collegeId: placements.collegeId,
      year: placements.year,
      median: placements.medianPackageLpa,
      highest: placements.highestPackageLpa,
      rate: placements.placementRatePct,
      recruiters: placements.topRecruiters,
    })
    .from(placements)
    .where(
      and(inArray(placements.collegeId, ids), isNotNull(placements.verifiedAt))
    )
    .orderBy(placements.year);

  const docs = await db
    .select({
      collegeId: collegeDocuments.collegeId,
      docType: collegeDocuments.docType,
      year: collegeDocuments.year,
      title: collegeDocuments.title,
      url: collegeDocuments.url,
    })
    .from(collegeDocuments)
    .where(
      and(
        inArray(collegeDocuments.collegeId, ids),
        inArray(collegeDocuments.docType, ["cutoff", "institutional"])
      )
    )
    .orderBy(collegeDocuments.year);

  const byId = new Map(base.map((b) => [b.id, b]));
  return ids
    .map((id) => byId.get(id))
    .filter((b): b is (typeof base)[number] => !!b)
    .map((b) => {
      const nirfRows = nirf
        .filter((n) => n.collegeId === b.id)
        .map((n) => ({ year: n.year, rank: n.rank, band: n.band }));
      const placeRows = place.filter((p) => p.collegeId === b.id);
      const latestPlace = placeRows[placeRows.length - 1];
      return {
        ...b,
        naacCgpa: b.naacCgpa == null ? null : Number(b.naacCgpa),
        campusAcres: b.campusAcres == null ? null : Number(b.campusAcres),
        nirf: nirfRows,
        latestNirf:
          nirfRows.length > 0
            ? { rank: nirfRows[nirfRows.length - 1].rank, band: nirfRows[nirfRows.length - 1].band }
            : null,
        placement: latestPlace
          ? {
              year: latestPlace.year,
              median: latestPlace.median == null ? null : Number(latestPlace.median),
              highest: latestPlace.highest == null ? null : Number(latestPlace.highest),
              rate: latestPlace.rate == null ? null : Number(latestPlace.rate),
              recruiters: latestPlace.recruiters,
            }
          : null,
        cutoffDocs: docs
          .filter((d) => d.collegeId === b.id)
          .map((d) => ({ docType: d.docType, year: d.year, title: d.title, url: d.url })),
      };
    });
}

export interface BranchCompareCell {
  collegeId: number;
  categoryCode: string;
  seatType: string;
  closingPercentile: number | null;
  closingMeritNo: number | null;
}

/** Branch-level comparison: one branch's cutoffs (latest yr) across the colleges. */
export async function getCompareBranch(
  ids: number[],
  branchId: number
): Promise<{ year: number | null; seats: Map<number, number | null>; cells: BranchCompareCell[] }> {
  if (ids.length === 0) return { year: null, seats: new Map(), cells: [] };
  const rows = await db
    .select({
      collegeId: collegeBranches.collegeId,
      year: cutoffs.year,
      categoryCode: categories.code,
      seatType: cutoffs.seatType,
      closingPercentile: cutoffs.closingPercentile,
      closingMeritNo: cutoffs.closingMeritNo,
    })
    .from(cutoffs)
    .innerJoin(collegeBranches, eq(cutoffs.collegeBranchId, collegeBranches.id))
    .innerJoin(categories, eq(cutoffs.categoryId, categories.id))
    .where(
      and(
        eq(collegeBranches.branchId, branchId),
        inArray(collegeBranches.collegeId, ids),
        isNotNull(cutoffs.verifiedAt)
      )
    );
  const seatsRows = await db
    .select({ collegeId: collegeBranches.collegeId, intake: collegeBranches.totalIntake })
    .from(collegeBranches)
    .where(
      and(eq(collegeBranches.branchId, branchId), inArray(collegeBranches.collegeId, ids))
    );
  const seats = new Map(seatsRows.map((s) => [s.collegeId, s.intake]));
  if (rows.length === 0) return { year: null, seats, cells: [] };
  const latestYear = Math.max(...rows.map((r) => r.year));
  return {
    year: latestYear,
    seats,
    cells: rows
      .filter((r) => r.year === latestYear)
      .map((r) => ({
        collegeId: r.collegeId,
        categoryCode: r.categoryCode,
        seatType: r.seatType as string,
        closingPercentile: r.closingPercentile == null ? null : Number(r.closingPercentile),
        closingMeritNo: r.closingMeritNo,
      })),
  };
}

/** Branches offered by ALL selected colleges (for the branch-compare picker). */
export async function getCommonBranches(ids: number[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: branches.id,
      name: branches.name,
      n: sql<number>`count(distinct ${collegeBranches.collegeId})::int`,
    })
    .from(collegeBranches)
    .innerJoin(branches, eq(collegeBranches.branchId, branches.id))
    .where(inArray(collegeBranches.collegeId, ids))
    .groupBy(branches.id, branches.name)
    .orderBy(sql`count(distinct ${collegeBranches.collegeId}) desc`, branches.name);
  // branches offered by more than one selected college first
  return rows.map((r) => ({ id: r.id, name: r.name, colleges: r.n }));
}
