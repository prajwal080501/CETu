import { collections } from "@/db/collections";

/** Unverified crowdsourced contributions awaiting moderation. */
export async function getPendingContributions() {
  const [pendPlacements, pendAlumni, naacDocs, collegeNames] = await Promise.all([
    collections
      .colleges()
      .aggregate<{
        id: number; college: string; year: number;
        median: number | null; highest: number | null; rate: number | null;
        recruiters: string | null; source: string | null;
      }>([
        { $unwind: "$placements" },
        { $match: { "placements.verifiedAt": null } },
        {
          $project: {
            _id: 0, id: "$placements.id", college: "$name", year: "$placements.year",
            median: "$placements.medianPackageLpa", highest: "$placements.highestPackageLpa",
            rate: "$placements.placementRatePct", recruiters: "$placements.topRecruiters",
            source: "$placements.source",
          },
        },
        { $sort: { id: 1 } },
      ])
      .toArray(),
    collections
      .colleges()
      .aggregate<{ id: number; college: string; name: string; achievement: string | null }>([
        { $unwind: "$alumni" },
        { $match: { "alumni.verifiedAt": null } },
        {
          $project: {
            _id: 0, id: "$alumni.id", college: "$name",
            name: "$alumni.name", achievement: "$alumni.achievement",
          },
        },
        { $sort: { id: 1 } },
      ])
      .toArray(),
    collections.naacSubmissions().find({}).sort({ _id: 1 }).toArray(),
    collections.colleges().find({}, { projection: { name: 1 } }).toArray(),
  ]);

  const nameById = new Map(collegeNames.map((c) => [c._id, c.name]));
  const pendNaac = naacDocs.map((n) => ({
    id: n._id,
    college: nameById.get(n.collegeId) ?? "",
    grade: n.grade,
    cgpa: n.cgpa,
    validUpto: n.validUpto,
    source: n.source,
  }));

  return { placements: pendPlacements, alumni: pendAlumni, naac: pendNaac };
}

/** Pending cutoff ingestions (from admin PDF uploads) awaiting batch approval. */
export async function getPendingCutoffBatches() {
  const [grouped, srcDocs, collegeNames] = await Promise.all([
    collections
      .cutoffs()
      .aggregate<{ _id: number; pendingRows: number; collegeIds: number[] }>([
        { $match: { verifiedAt: null, sourceDocumentId: { $ne: null } } },
        {
          $group: {
            _id: "$sourceDocumentId",
            pendingRows: { $sum: 1 },
            collegeIds: { $addToSet: "$collegeId" },
          },
        },
      ])
      .toArray(),
    collections.sourceDocuments().find({ docType: "cutoff" }).toArray(),
    collections.colleges().find({}, { projection: { name: 1 } }).toArray(),
  ]);

  const srcById = new Map(srcDocs.map((s) => [s._id, s]));
  const nameById = new Map(collegeNames.map((c) => [c._id, c.name]));

  return grouped
    .filter((g) => srcById.has(g._id))
    .map((g) => {
      const sd = srcById.get(g._id)!;
      return {
        id: g._id,
        title: sd.title,
        year: sd.year,
        round: sd.round as number,
        pendingRows: g.pendingRows,
        sampleColleges: g.collegeIds
          .slice(0, 3)
          .map((cid) => nameById.get(cid) ?? "")
          .filter(Boolean),
      };
    })
    .sort((a, b) => b.id - a.id);
}

/** Top-line pipeline totals for the admin dashboard. */
export async function getPipelineStats() {
  const [cutoffCount, verified, collegeCount, branchCount, offeringCount, univCount, byYear] =
    await Promise.all([
      collections.cutoffs().countDocuments(),
      collections.cutoffs().countDocuments({ verifiedAt: { $ne: null } }),
      collections.colleges().countDocuments(),
      collections.branches().countDocuments(),
      collections.offerings().countDocuments(),
      collections.universities().countDocuments(),
      collections
        .cutoffs()
        .aggregate<{ year: number; round: number; rows: number }>([
          { $group: { _id: "$year", round: { $max: "$round" }, rows: { $sum: 1 } } },
          { $project: { _id: 0, year: "$_id", round: 1, rows: 1 } },
          { $sort: { year: 1 } },
        ])
        .toArray(),
    ]);

  return {
    totals: { cutoffs: cutoffCount, verified },
    counts: {
      colleges: collegeCount,
      branches: branchCount,
      offerings: offeringCount,
      universities: univCount,
    },
    byYear,
  };
}

/**
 * Colleges that have HU/OHU seats but no home university mapped — the concrete
 * data gap a curator should resolve (needs the DTE institute directory).
 */
export async function getCollegesMissingUniversity() {
  const collegeIds = await collections
    .cutoffs()
    .distinct("collegeId", {
      collegeHomeUniversityId: null,
      seatType: { $in: ["HU", "OHU", "HU_OHU"] },
    });
  const cols = await collections
    .colleges()
    .find(
      { _id: { $in: collegeIds as number[] } },
      { projection: { name: 1, city: 1, dteCode: 1 } }
    )
    .toArray();
  return cols
    .map((c) => ({ id: c._id, name: c.name, city: c.city, dteCode: c.dteCode }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Branches that fell through classification into "Other" (review candidates). */
export async function getUnclassifiedBranches() {
  const rows = await collections
    .branches()
    .find({ $or: [{ family: "Other" }, { family: null }] })
    .toArray();
  return rows
    .map((b) => ({ id: b._id, name: b.name, family: b.family }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface CollegeCoverage {
  id: number;
  name: string;
  city: string | null;
  cutoffs: boolean;
  placements: boolean;
  nirf: boolean;
  naac: boolean;
  fees: boolean;
  alumni: boolean;
  university: boolean;
}

/**
 * Per-college data availability matrix for the admin console: which colleges
 * have cutoffs / placements / NIRF / NAAC / fees / alumni / home-university, and
 * which are missing each. Powers the "what still needs data" view.
 */
export async function getDataCoverage(): Promise<{
  rows: CollegeCoverage[];
  summary: Record<string, number> & { total: number };
}> {
  const [cols, cutoffCollegeIds] = await Promise.all([
    collections.colleges().find(
      { hidden: false },
      {
        projection: {
          name: 1, city: 1, homeUniversityId: 1, naacGrade: 1,
          placements: 1, nirfRankings: 1, fees: 1, alumni: 1,
        },
      }
    ).toArray(),
    collections.cutoffs().distinct("collegeId", { verifiedAt: { $ne: null } }),
  ]);
  const hasCutoff = new Set(cutoffCollegeIds as number[]);

  const rows: CollegeCoverage[] = cols
    .map((c) => ({
      id: c._id,
      name: c.name,
      city: c.city,
      cutoffs: hasCutoff.has(c._id),
      placements: (c.placements ?? []).some((p) => p.verifiedAt != null),
      nirf: (c.nirfRankings ?? []).length > 0,
      naac: !!c.naacGrade,
      fees: (c.fees ?? []).length > 0,
      alumni: (c.alumni ?? []).some((a) => a.verifiedAt != null),
      university: c.homeUniversityId != null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const count = (k: keyof CollegeCoverage) => rows.filter((r) => r[k] === true).length;
  const summary = {
    total: rows.length,
    cutoffs: count("cutoffs"),
    placements: count("placements"),
    nirf: count("nirf"),
    naac: count("naac"),
    fees: count("fees"),
    alumni: count("alumni"),
    university: count("university"),
  };
  return { rows, summary };
}

/** Coverage: colleges with a home university and with a city. */
export async function getCoverage() {
  const [withUniversity, withCity, total] = await Promise.all([
    collections.colleges().countDocuments({ homeUniversityId: { $ne: null } }),
    collections.colleges().countDocuments({ city: { $ne: null } }),
    collections.colleges().countDocuments(),
  ]);
  return { withUniversity, withCity, total };
}
