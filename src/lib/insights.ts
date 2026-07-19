import "server-only";
import { createHash } from "node:crypto";
import { collections } from "@/db/collections";
import {
  getCollegeBySlug,
  getCollegeOverview,
  getCollegeBranches,
  getCollegeNirf,
  getCollegePlacements,
  getCollegeCutoffMatrix,
} from "./queries";
import type { CollegeInsights, InsightFacts } from "./ai";

/**
 * Assemble the grounding facts for a college from verified DB data only. These
 * are the ONLY inputs Gemini is allowed to reason from (see lib/ai.ts).
 */
export async function buildInsightFacts(
  collegeId: number,
  slug: string
): Promise<InsightFacts | null> {
  const college = await getCollegeBySlug(slug);
  if (!college || college.id !== collegeId) return null;

  const [overview, offerings, nirf, placementRows, matrix] = await Promise.all([
    getCollegeOverview(collegeId),
    getCollegeBranches(collegeId),
    getCollegeNirf(collegeId),
    getCollegePlacements(collegeId),
    getCollegeCutoffMatrix(collegeId),
  ]);

  // Toughest GOPEN closing percentile per branch (max across seat types) as a
  // representative selectivity signal.
  const openByBranch = new Map<string, number>();
  for (const r of matrix.rows) {
    if (r.categoryCode !== "GOPEN" || r.closingPercentile == null) continue;
    const cur = openByBranch.get(r.branchName);
    if (cur == null || r.closingPercentile > cur)
      openByBranch.set(r.branchName, r.closingPercentile);
  }

  const topBranches = offerings
    .filter((o) => o.totalIntake != null)
    .sort((a, b) => (b.totalIntake ?? 0) - (a.totalIntake ?? 0))
    .slice(0, 6)
    .map((o) => ({
      name: o.branchName,
      seats: o.totalIntake,
      openCutoff: openByBranch.get(o.branchName) ?? null,
    }));

  const p = placementRows[0];

  return {
    name: college.name,
    city: college.city,
    type: college.type,
    university: college.university,
    autonomous: Boolean(college.isAutonomous),
    naacGrade: college.naacGrade,
    nirf: nirf ? { year: nirf.year, rank: nirf.rank, band: nirf.band } : null,
    totalSeats: overview.totalSeats,
    branchCount: overview.branches,
    topBranches,
    placements: p
      ? {
          year: p.year,
          highestLpa: p.highest == null ? null : Number(p.highest),
          medianLpa: p.median == null ? null : Number(p.median),
          avgLpa: p.avg == null ? null : Number(p.avg),
          ratePct: p.rate == null ? null : Number(p.rate),
          recruiters: p.recruiters,
        }
      : null,
  };
}

/** Stable hash of the grounding facts; used to invalidate the cache. */
export function factsHash(facts: InsightFacts): string {
  return createHash("sha256").update(JSON.stringify(facts)).digest("hex");
}

/** Read the cached insight for a college (regardless of freshness). */
export async function getCachedInsights(
  collegeId: number
): Promise<{ content: CollegeInsights; dataHash: string; model: string } | null> {
  const row = await collections
    .aiInsights()
    .findOne(
      { collegeId },
      { projection: { content: 1, dataHash: 1, model: 1 } }
    );
  if (!row) return null;
  return {
    content: row.content as CollegeInsights,
    dataHash: row.dataHash,
    model: row.model,
  };
}
