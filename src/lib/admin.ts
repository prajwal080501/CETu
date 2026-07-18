import { db } from "@/db";
import {
  colleges,
  branches,
  collegeBranches,
  cutoffs,
  universities,
  placements,
  alumni,
  naacSubmissions,
} from "@/db/schema";
import { and, eq, isNull, isNotNull, sql, inArray } from "drizzle-orm";

/** Unverified crowdsourced contributions awaiting moderation. */
export async function getPendingContributions() {
  const [pendPlacements, pendAlumni, pendNaac] = await Promise.all([
    db
      .select({
        id: placements.id,
        college: colleges.name,
        year: placements.year,
        median: placements.medianPackageLpa,
        highest: placements.highestPackageLpa,
        rate: placements.placementRatePct,
        recruiters: placements.topRecruiters,
        source: placements.source,
      })
      .from(placements)
      .innerJoin(colleges, eq(placements.collegeId, colleges.id))
      .where(isNull(placements.verifiedAt))
      .orderBy(placements.id),
    db
      .select({
        id: alumni.id,
        college: colleges.name,
        name: alumni.name,
        achievement: alumni.achievement,
      })
      .from(alumni)
      .innerJoin(colleges, eq(alumni.collegeId, colleges.id))
      .where(isNull(alumni.verifiedAt))
      .orderBy(alumni.id),
    db
      .select({
        id: naacSubmissions.id,
        college: colleges.name,
        grade: naacSubmissions.grade,
        cgpa: naacSubmissions.cgpa,
        validUpto: naacSubmissions.validUpto,
        source: naacSubmissions.source,
      })
      .from(naacSubmissions)
      .innerJoin(colleges, eq(naacSubmissions.collegeId, colleges.id))
      .orderBy(naacSubmissions.id),
  ]);
  return { placements: pendPlacements, alumni: pendAlumni, naac: pendNaac };
}

/** Pending cutoff ingestions (from admin PDF uploads) awaiting batch approval. */
export async function getPendingCutoffBatches() {
  const rows = await db.execute(sql`
    select sd.id, sd.title, sd.year, sd.round,
      count(*)::int as "pendingRows",
      (array_agg(distinct c.name))[1:3] as "sampleColleges"
    from source_documents sd
    join cutoffs cu on cu.source_document_id = sd.id and cu.verified_at is null
    join college_branches cb on cb.id = cu.college_branch_id
    join colleges c on c.id = cb.college_id
    where sd.doc_type = 'cutoff'
    group by sd.id, sd.title, sd.year, sd.round
    order by sd.id desc
  `);
  return rows as unknown as {
    id: number;
    title: string;
    year: number;
    round: number;
    pendingRows: number;
    sampleColleges: string[];
  }[];
}

/** Top-line pipeline totals for the admin dashboard. */
export async function getPipelineStats() {
  const [totals] = await db
    .select({
      cutoffs: sql<number>`count(*)::int`,
      verified: sql<number>`count(*) filter (where ${cutoffs.verifiedAt} is not null)::int`,
    })
    .from(cutoffs);

  const [counts] = await db
    .select({
      colleges: sql<number>`(select count(*) from ${colleges})::int`,
      branches: sql<number>`(select count(*) from ${branches})::int`,
      offerings: sql<number>`(select count(*) from ${collegeBranches})::int`,
      universities: sql<number>`(select count(*) from ${universities})::int`,
    })
    .from(sql`(select 1) as _`);

  const byYear = await db
    .select({
      year: cutoffs.year,
      round: sql<number>`max(${cutoffs.round})::int`,
      rows: sql<number>`count(*)::int`,
    })
    .from(cutoffs)
    .groupBy(cutoffs.year)
    .orderBy(cutoffs.year);

  return { totals, counts, byYear };
}

/**
 * Colleges that have HU/OHU seats but no home university mapped — the concrete
 * data gap a curator should resolve (needs the DTE institute directory).
 */
export async function getCollegesMissingUniversity() {
  const rows = await db
    .selectDistinct({
      id: colleges.id,
      name: colleges.name,
      city: colleges.city,
      dteCode: colleges.dteCode,
    })
    .from(colleges)
    .innerJoin(collegeBranches, eq(collegeBranches.collegeId, colleges.id))
    .innerJoin(cutoffs, eq(cutoffs.collegeBranchId, collegeBranches.id))
    .where(
      and(
        isNull(colleges.homeUniversityId),
        inArray(cutoffs.seatType, ["HU", "OHU", "HU_OHU"])
      )
    )
    .orderBy(colleges.name);
  return rows;
}

/** Branches that fell through classification into "Other" (review candidates). */
export async function getUnclassifiedBranches() {
  return db
    .select({ id: branches.id, name: branches.name, family: branches.family })
    .from(branches)
    .where(sql`${branches.family} = 'Other' or ${branches.family} is null`)
    .orderBy(branches.name);
}

/** Coverage: colleges with a home university and with a city. */
export async function getCoverage() {
  const [row] = await db
    .select({
      withUniversity: sql<number>`count(*) filter (where ${colleges.homeUniversityId} is not null)::int`,
      withCity: sql<number>`count(*) filter (where ${colleges.city} is not null)::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(colleges);
  return row;
}

// keep imports honest
void isNotNull;
