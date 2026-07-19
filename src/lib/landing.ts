import { cached } from "./query-cache";
import { collections } from "@/db/collections";

const PREDICT_YEAR = 2025;

/**
 * These landing/reference queries only change when cutoffs/colleges are
 * ingested — never per-request. Wrap each in the data cache so MongoDB is hit at
 * most once per REVALIDATE window; results are shared across all requests.
 */
const REVALIDATE = 3600; // 1 hour

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface RankedCollege {
  id: number;
  name: string;
  slug: string;
  city: string | null;
  university: string | null;
  type: string | null;
  isAutonomous: boolean | null;
  aicteApproved: boolean | null;
  naacGrade: string | null;
  website: string | null;
  totalSeats: number;
  branchCount: number;
  topCutoff: number | null; // best (highest) GOPEN closing percentile, latest year
  topBranch: string | null;
}

/**
 * Colleges ranked by competitiveness = their best Open-category closing
 * percentile in the latest year (higher = harder to get = "top"). Colleges with
 * no cutoff sort last. Powers the list page and the landing "top colleges".
 *
 * Single-pass: one aggregation over cutoffs (best GOPEN %ile + its branch per
 * college) and one over offerings (seats + branch count), joined onto colleges
 * in JS (~389 rows). Denormalized fields on cutoffs/offerings avoid $lookup.
 */
export const getRankedColleges = cached(
  async (opts?: {
    area?: string;
    limit?: number;
  }): Promise<RankedCollege[]> => {
    const [seatAgg, cutAgg, branches] = await Promise.all([
      collections
        .offerings()
        .aggregate<{ _id: number; totalSeats: number; branchCount: number }>([
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
        .aggregate<{ _id: number; topCutoff: number; topBranchId: number }>([
          {
            $match: {
              year: PREDICT_YEAR,
              categoryCode: "GOPEN",
              verifiedAt: { $ne: null },
            },
          },
          { $sort: { closingPercentile: -1, branchId: 1 } },
          {
            $group: {
              _id: "$collegeId",
              topCutoff: { $max: "$closingPercentile" },
              topBranchId: { $first: "$branchId" }, // sorted → first = max (branchId breaks ties)
            },
          },
        ])
        .toArray(),
      collections.branches().find({}, { projection: { name: 1 } }).toArray(),
    ]);

    const seatById = new Map(seatAgg.map((s) => [s._id, s]));
    const cutById = new Map(cutAgg.map((c) => [c._id, c]));
    const branchName = new Map(branches.map((b) => [b._id, b.name]));

    const filter: Record<string, unknown> = { hidden: false };
    if (opts?.area) {
      filter.city = { $regex: `^${escapeRegex(opts.area)}$`, $options: "i" };
    }
    const cols = await collections.colleges().find(filter).toArray();

    const rows: RankedCollege[] = cols.map((c) => {
      const seat = seatById.get(c._id);
      const cut = cutById.get(c._id);
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
        website: c.website,
        totalSeats: seat?.totalSeats ?? 0,
        branchCount: seat?.branchCount ?? 0,
        topCutoff: cut?.topCutoff ?? null,
        topBranch: cut ? branchName.get(cut.topBranchId) ?? null : null,
      };
    });

    // order by topCutoff desc nulls last, then totalSeats desc, then id (stable)
    rows.sort((a, b) => {
      if (a.topCutoff != null || b.topCutoff != null) {
        if (a.topCutoff == null) return 1;
        if (b.topCutoff == null) return -1;
        if (b.topCutoff !== a.topCutoff) return b.topCutoff - a.topCutoff;
      }
      if (b.totalSeats !== a.totalSeats) return b.totalSeats - a.totalSeats;
      return a.id - b.id;
    });

    return opts?.limit ? rows.slice(0, opts.limit) : rows;
  },
  ["ranked-colleges"],
  { revalidate: REVALIDATE },
);

export interface SearchDoc {
  name: string;
  slug: string;
  city: string | null;
  university: string | null;
}

/**
 * Lightweight, client-shippable search index (all colleges, minimal fields),
 * ordered by competitiveness so equal-relevance ties surface the top college
 * first. Small enough (~389 rows) to filter instantly in the browser.
 */
export const getSearchIndex = cached(
  async (): Promise<SearchDoc[]> => {
    const [cutAgg, cols] = await Promise.all([
      collections
        .cutoffs()
        .aggregate<{ _id: number; topCutoff: number }>([
          {
            $match: {
              year: PREDICT_YEAR,
              categoryCode: "GOPEN",
              verifiedAt: { $ne: null },
            },
          },
          { $group: { _id: "$collegeId", topCutoff: { $max: "$closingPercentile" } } },
        ])
        .toArray(),
      collections
        .colleges()
        .find(
          { hidden: false },
          { projection: { name: 1, slug: 1, city: 1, homeUniversityName: 1 } }
        )
        .toArray(),
    ]);

    const cutById = new Map(cutAgg.map((c) => [c._id, c.topCutoff]));

    return cols
      .map((c) => ({
        name: c.name,
        slug: c.slug,
        city: c.city,
        university: c.homeUniversityName,
        _top: cutById.get(c._id) ?? null,
      }))
      .sort((a, b) => {
        if (a._top == null && b._top == null) return a.name.localeCompare(b.name);
        if (a._top == null) return 1;
        if (b._top == null) return -1;
        if (b._top !== a._top) return b._top - a._top;
        return a.name.localeCompare(b.name);
      })
      .map(({ name, slug, city, university }) => ({ name, slug, city, university }));
  },
  ["search-index"],
  { revalidate: REVALIDATE },
);

/** Headline totals for the landing hero. */
export const getLandingStats = cached(
  async () => {
    const [colleges, branches, cutoffs, years, seatAgg] = await Promise.all([
      collections.colleges().countDocuments({ hidden: false }),
      collections.branches().countDocuments(),
      collections.cutoffs().countDocuments(),
      collections.cutoffs().distinct("year"),
      collections
        .offerings()
        .aggregate<{ seats: number }>([
          { $group: { _id: null, seats: { $sum: { $ifNull: ["$totalIntake", 0] } } } },
        ])
        .toArray(),
    ]);
    return {
      colleges,
      branches,
      seats: seatAgg[0]?.seats ?? 0,
      cutoffs,
      years: years.length,
    };
  },
  ["landing-stats"],
  { revalidate: REVALIDATE },
);

/** Seats grouped by branch family (for a bar chart). */
export const getSeatsByFamily = cached(
  async () => {
    const rows = await collections
      .offerings()
      .aggregate<{ family: string; seats: number }>([
        {
          $group: {
            _id: { $ifNull: ["$family", "Other"] },
            seats: { $sum: { $ifNull: ["$totalIntake", 0] } },
          },
        },
        { $project: { _id: 0, family: "$_id", seats: 1 } },
        { $sort: { seats: -1 } },
      ])
      .toArray();
    return rows;
  },
  ["seats-by-family"],
  { revalidate: REVALIDATE },
);

/** Colleges grouped by home university region (for a bar chart). */
export const getCollegesByRegion = cached(
  async () => {
    const [cols, univs] = await Promise.all([
      collections
        .colleges()
        .find({}, { projection: { homeUniversityId: 1 } })
        .toArray(),
      collections.universities().find({}).toArray(),
    ]);
    const univById = new Map(univs.map((u) => [u._id, u]));
    const counts = new Map<string, number>();
    for (const c of cols) {
      const u = c.homeUniversityId ? univById.get(c.homeUniversityId) : null;
      const region = u?.shortName || u?.name || "Unmapped";
      counts.set(region, (counts.get(region) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([region, colleges]) => ({ region, colleges }))
      .sort((a, b) => b.colleges - a.colleges)
      .slice(0, 10);
  },
  ["colleges-by-region"],
  { revalidate: REVALIDATE },
);

/** Colleges with the highest verified placement packages (for a home widget). */
export const getTopPlacements = cached(
  async (limit = 6) => {
    const rows = await collections
      .colleges()
      .aggregate<{
        name: string;
        slug: string;
        city: string | null;
        highest: number | null;
        median: number | null;
        avg: number | null;
      }>([
        { $match: { hidden: false } },
        {
          $project: {
            name: 1,
            slug: 1,
            city: 1,
            vp: {
              $filter: {
                input: "$placements",
                as: "p",
                cond: {
                  $and: [
                    { $ne: ["$$p.verifiedAt", null] },
                    { $ne: ["$$p.highestPackageLpa", null] },
                  ],
                },
              },
            },
          },
        },
        { $match: { "vp.0": { $exists: true } } },
        {
          $project: {
            _id: 0,
            name: 1,
            slug: 1,
            city: 1,
            highest: { $max: "$vp.highestPackageLpa" },
            median: { $max: "$vp.medianPackageLpa" },
            avg: { $max: "$vp.avgPackageLpa" },
          },
        },
        { $sort: { highest: -1 } },
        { $limit: limit },
      ])
      .toArray();
    return rows;
  },
  ["top-placements"],
  { revalidate: REVALIDATE },
);

/** Top areas (cities) by number of colleges — for the area browser. */
export const getAreaFacets = cached(
  async (limit = 12) => {
    const rows = await collections
      .colleges()
      .aggregate<{ city: string; colleges: number }>([
        { $match: { hidden: false, city: { $ne: null } } },
        { $group: { _id: "$city", colleges: { $sum: 1 } } },
        { $project: { _id: 0, city: "$_id", colleges: 1 } },
        { $sort: { colleges: -1 } },
        { $limit: limit },
      ])
      .toArray();
    return rows;
  },
  ["area-facets"],
  { revalidate: REVALIDATE },
);
