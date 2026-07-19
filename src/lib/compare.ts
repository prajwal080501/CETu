import { collections } from "@/db/collections";

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
  const cols = await collections
    .colleges()
    .find({ hidden: false }, { projection: { name: 1, city: 1 } })
    .toArray();
  return cols
    .map((c) => ({ id: c._id, name: c.name, city: c.city }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** College-level comparison payload for the selected colleges (keeps input order). */
export async function getCompareColleges(ids: number[]): Promise<CompareCollege[]> {
  if (ids.length === 0) return [];

  const [cols, seatAgg, cutAgg] = await Promise.all([
    collections.colleges().find({ _id: { $in: ids }, hidden: false }).toArray(),
    collections
      .offerings()
      .aggregate<{ _id: number; totalSeats: number; branchCount: number }>([
        { $match: { collegeId: { $in: ids } } },
        {
          $group: {
            _id: "$collegeId",
            totalSeats: { $sum: { $ifNull: ["$totalIntake", 0] } },
            branchCount: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    collections
      .cutoffs()
      .aggregate<{ _id: number; topCutoff: number }>([
        {
          $match: {
            collegeId: { $in: ids },
            year: 2025,
            categoryCode: "GOPEN",
            verifiedAt: { $ne: null },
          },
        },
        { $group: { _id: "$collegeId", topCutoff: { $max: "$closingPercentile" } } },
      ])
      .toArray(),
  ]);

  const seatById = new Map(seatAgg.map((s) => [s._id, s]));
  const cutById = new Map(cutAgg.map((c) => [c._id, c.topCutoff]));
  const byId = new Map(cols.map((c) => [c._id, c]));

  return ids
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => {
      const nirfRows = (c.nirfRankings ?? [])
        .slice()
        .sort((a, b) => a.year - b.year)
        .map((n) => ({ year: n.year, rank: n.rank, band: n.band }));
      const placeRows = (c.placements ?? [])
        .filter((p) => p.verifiedAt != null)
        .sort((a, b) => a.year - b.year);
      const latestPlace = placeRows[placeRows.length - 1];
      return {
        id: c._id,
        name: c.name,
        slug: c.slug,
        city: c.city,
        university: c.homeUniversityName,
        type: c.type,
        isAutonomous: c.isAutonomous,
        aicteApproved: c.aicteApproved,
        naacGrade: c.naacGrade,
        naacCgpa: c.naacCgpa,
        campusAcres: c.campusAcres,
        totalSeats: seatById.get(c._id)?.totalSeats ?? 0,
        branchCount: seatById.get(c._id)?.branchCount ?? 0,
        topCutoff: cutById.get(c._id) ?? null,
        nirf: nirfRows,
        latestNirf:
          nirfRows.length > 0
            ? {
                rank: nirfRows[nirfRows.length - 1].rank,
                band: nirfRows[nirfRows.length - 1].band,
              }
            : null,
        placement: latestPlace
          ? {
              year: latestPlace.year,
              median: latestPlace.medianPackageLpa,
              highest: latestPlace.highestPackageLpa,
              rate: latestPlace.placementRatePct,
              recruiters: latestPlace.topRecruiters,
            }
          : null,
        cutoffDocs: (c.documents ?? [])
          .filter((d) => d.docType === "cutoff" || d.docType === "institutional")
          .sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
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

  const [rows, seatRows] = await Promise.all([
    collections
      .cutoffs()
      .find({ branchId, collegeId: { $in: ids }, verifiedAt: { $ne: null } })
      .toArray(),
    collections
      .offerings()
      .find(
        { branchId, collegeId: { $in: ids } },
        { projection: { collegeId: 1, totalIntake: 1 } }
      )
      .toArray(),
  ]);

  const seats = new Map<number, number | null>(
    seatRows.map((s) => [s.collegeId, s.totalIntake])
  );
  if (rows.length === 0) return { year: null, seats, cells: [] };
  const latestYear = Math.max(...rows.map((r) => r.year));
  return {
    year: latestYear,
    seats,
    cells: rows
      .filter((r) => r.year === latestYear)
      .map((r) => ({
        collegeId: r.collegeId as number,
        categoryCode: r.categoryCode,
        seatType: r.seatType as string,
        closingPercentile:
          r.closingPercentile == null ? null : Number(r.closingPercentile),
        closingMeritNo: r.closingMeritNo,
      })),
  };
}

/** Branches offered by ALL selected colleges (for the branch-compare picker). */
export async function getCommonBranches(ids: number[]) {
  if (ids.length === 0) return [];
  const [agg, branchDocs] = await Promise.all([
    collections
      .offerings()
      .aggregate<{ _id: number; n: number }>([
        { $match: { collegeId: { $in: ids } } },
        { $group: { _id: "$branchId", colleges: { $addToSet: "$collegeId" } } },
        { $project: { n: { $size: "$colleges" } } },
      ])
      .toArray(),
    collections.branches().find({}, { projection: { name: 1 } }).toArray(),
  ]);
  const nameById = new Map(branchDocs.map((b) => [b._id, b.name]));
  return agg
    .map((a) => ({ id: a._id, name: nameById.get(a._id) ?? "", colleges: a.n }))
    .sort((a, b) => b.colleges - a.colleges || a.name.localeCompare(b.name));
}
