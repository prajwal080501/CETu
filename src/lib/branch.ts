import { cached } from "./query-cache";
import { collections } from "@/db/collections";

// Branch analytics are derived from verified CAP data that only changes on
// ingestion — cache them so every page view doesn't re-scan the cutoffs table.
const REVALIDATE = 3600; // 1 hour

/**
 * "Know Your Branch" analytics — all derived from our own verified CAP data, so
 * every number is real and Maharashtra-specific. Demand is proxied by the
 * Open-category (GOPEN) closing percentile: higher = harder to get = more
 * sought-after. Supply is sanctioned intake. The live job-market/salary layer is
 * added separately (see lib/adzuna.ts).
 */

const YEAR = 2025;

export interface BranchListItem {
  id: number;
  name: string;
  slug: string;
  family: string | null;
  colleges: number;
  seats: number;
  avgCutoff: number | null; // avg GOPEN closing percentile (demand)
}

/** All branches that have at least one offering, with headline stats. */
export const listBranches = cached(
  async (): Promise<BranchListItem[]> => {
    const [offAgg, demand, branches] = await Promise.all([
      // colleges (= distinct offerings, unique per college×branch) + seats
      collections
        .offerings()
        .aggregate<{ _id: number; colleges: number; seats: number }>([
          {
            $group: {
              _id: "$branchId",
              colleges: { $sum: 1 },
              seats: { $sum: { $ifNull: ["$totalIntake", 0] } },
            },
          },
        ])
        .toArray(),
      // avg GOPEN closing percentile per branch (demand)
      collections
        .cutoffs()
        .aggregate<{ _id: number; avgCutoff: number }>([
          {
            $match: {
              year: YEAR,
              categoryCode: "GOPEN",
              verifiedAt: { $ne: null },
            },
          },
          { $group: { _id: "$branchId", avgCutoff: { $avg: "$closingPercentile" } } },
        ])
        .toArray(),
      collections.branches().find({}).toArray(),
    ]);

    const demandById = new Map(demand.map((d) => [d._id, d.avgCutoff]));
    const branchById = new Map(branches.map((b) => [b._id, b]));

    const rows: BranchListItem[] = offAgg
      .filter((o) => o.colleges > 0 && branchById.has(o._id))
      .map((o) => {
        const b = branchById.get(o._id)!;
        return {
          id: o._id,
          name: b.name,
          slug: b.slug,
          family: b.family,
          colleges: o.colleges,
          seats: o.seats,
          avgCutoff: demandById.get(o._id) ?? null,
        };
      });

    // order by seats desc, colleges desc, id (stable tiebreak)
    rows.sort(
      (a, b) =>
        b.seats - a.seats || b.colleges - a.colleges || a.id - b.id
    );
    return rows;
  },
  ["list-branches"],
  { revalidate: REVALIDATE }
);

export interface BranchMatrix {
  families: string[];
  cities: string[];
  cells: Record<string, Record<string, { demand: number | null; seats: number }>>;
  market: Record<string, { salary: number | null; jobs: number | null }>;
  slugs: Record<string, string>; // family → a representative branch slug to link to
}

/**
 * Global family × city matrix powering the landing/branches overview heatmap:
 * per (branch family, top city) admission demand (max GOPEN %ile) + seats, plus
 * each family's cached live job-market summary (mean salary + jobs) where present.
 */
export const getBranchCityMatrix = cached(
  async (cityCount = 8): Promise<BranchMatrix> => {
    const [cityRows, seatRows, demandRows, marketRows, offByBranch, branches] =
      await Promise.all([
        collections
          .offerings()
          .aggregate<{ city: string; seats: number }>([
            { $match: { city: { $ne: null } } },
            {
              $group: {
                _id: "$city",
                seats: { $sum: { $ifNull: ["$totalIntake", 0] } },
              },
            },
            { $project: { _id: 0, city: "$_id", seats: 1 } },
            { $sort: { seats: -1 } },
            { $limit: cityCount },
          ])
          .toArray(),
        collections
          .offerings()
          .aggregate<{ family: string; city: string; seats: number }>([
            { $match: { city: { $ne: null }, family: { $ne: null } } },
            {
              $group: {
                _id: { family: "$family", city: "$city" },
                seats: { $sum: { $ifNull: ["$totalIntake", 0] } },
              },
            },
            {
              $project: {
                _id: 0,
                family: "$_id.family",
                city: "$_id.city",
                seats: 1,
              },
            },
          ])
          .toArray(),
        collections
          .cutoffs()
          .aggregate<{ family: string; city: string; demand: number }>([
            {
              $match: {
                year: YEAR,
                categoryCode: "GOPEN",
                verifiedAt: { $ne: null },
                city: { $ne: null },
                family: { $ne: null },
              },
            },
            {
              $group: {
                _id: { family: "$family", city: "$city" },
                demand: { $max: "$closingPercentile" },
              },
            },
            {
              $project: {
                _id: 0,
                family: "$_id.family",
                city: "$_id.city",
                demand: 1,
              },
            },
          ])
          .toArray(),
        collections.jobMarket().find({ kind: "summary" }).toArray(),
        // offering counts per branch (for the representative slug per family)
        collections
          .offerings()
          .aggregate<{ _id: number; n: number }>([
            { $group: { _id: "$branchId", n: { $sum: 1 } } },
          ])
          .toArray(),
        collections.branches().find({}).toArray(),
      ]);

    const cities = cityRows.map((r) => r.city);
    const citySet = new Set(cities);

    const cells: BranchMatrix["cells"] = {};
    const familyTotals = new Map<string, number>();
    for (const r of seatRows) {
      familyTotals.set(r.family, (familyTotals.get(r.family) ?? 0) + r.seats);
      if (!citySet.has(r.city)) continue;
      (cells[r.family] ??= {})[r.city] = { demand: null, seats: r.seats };
    }
    for (const r of demandRows) {
      if (!citySet.has(r.city)) continue;
      const cell = (cells[r.family] ??= {})[r.city];
      if (cell) cell.demand = r.demand;
      else cells[r.family][r.city] = { demand: r.demand, seats: 0 };
    }

    const market: BranchMatrix["market"] = {};
    for (const r of marketRows) {
      const payload = r.payload as { meanSalary?: number | null; jobs?: number | null };
      market[r.family] = {
        salary: payload?.meanSalary ?? null,
        jobs: payload?.jobs ?? null,
      };
    }

    // Representative branch slug per family = the branch with the most offerings.
    const nByBranch = new Map(offByBranch.map((o) => [o._id, o.n]));
    const bestPerFamily = new Map<string, { slug: string; n: number }>();
    for (const b of branches) {
      if (!b.family) continue;
      const n = nByBranch.get(b._id) ?? 0;
      const cur = bestPerFamily.get(b.family);
      if (!cur || n > cur.n) bestPerFamily.set(b.family, { slug: b.slug, n });
    }
    const slugs: BranchMatrix["slugs"] = {};
    for (const [family, { slug }] of bestPerFamily) slugs[family] = slug;

    const families = [...familyTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([f]) => f)
      .filter((f) => cells[f]);

    return { families, cities, cells, market, slugs };
  },
  ["branch-city-matrix"],
  { revalidate: REVALIDATE }
);

export async function getBranchBySlug(slug: string) {
  const b = await collections.branches().findOne({ slug });
  if (!b) return null;
  return {
    id: b._id,
    name: b.name,
    slug: b.slug,
    degree: b.degree,
    family: b.family,
  };
}

export interface BranchAnalysis {
  overview: {
    colleges: number;
    seats: number;
    avgCutoff: number | null;
    topCutoff: number | null;
    cities: number;
  };
  byCity: {
    city: string;
    colleges: number;
    seats: number;
    avgCutoff: number | null;
    topCutoff: number | null;
  }[];
  topColleges: {
    name: string;
    slug: string;
    city: string | null;
    seats: number | null;
    cutoff: number | null;
  }[];
  trend: { year: number; avgCutoff: number | null }[];
}

export const getBranchAnalysis = cached(
  async (branchId: number): Promise<BranchAnalysis> => {
    const offerings = await collections
      .offerings()
      .find({ branchId })
      .toArray();
    const collegeIds = [...new Set(offerings.map((o) => o.collegeId))];

    const [ovAgg, perOff, trend, cols] = await Promise.all([
      // overview: avg/max over ALL GOPEN 2025 cutoff rows for the branch
      collections
        .cutoffs()
        .aggregate<{ avg: number | null; max: number | null }>([
          {
            $match: {
              branchId,
              year: YEAR,
              categoryCode: "GOPEN",
              verifiedAt: { $ne: null },
            },
          },
          {
            $group: {
              _id: null,
              avg: { $avg: "$closingPercentile" },
              max: { $max: "$closingPercentile" },
            },
          },
        ])
        .toArray(),
      // per-offering top GOPEN 2025 cutoff (mirrors the pg lateral)
      collections
        .cutoffs()
        .aggregate<{ _id: number; maxCp: number }>([
          {
            $match: {
              branchId,
              year: YEAR,
              categoryCode: "GOPEN",
              verifiedAt: { $ne: null },
            },
          },
          { $group: { _id: "$collegeBranchId", maxCp: { $max: "$closingPercentile" } } },
        ])
        .toArray(),
      // trend: avg GOPEN closing percentile per year (all years)
      collections
        .cutoffs()
        .aggregate<{ year: number; avgCutoff: number | null }>([
          {
            $match: {
              branchId,
              categoryCode: "GOPEN",
              verifiedAt: { $ne: null },
            },
          },
          { $group: { _id: "$year", avgCutoff: { $avg: "$closingPercentile" } } },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, year: "$_id", avgCutoff: 1 } },
        ])
        .toArray(),
      collections
        .colleges()
        .find(
          { _id: { $in: collegeIds } },
          { projection: { name: 1, slug: 1, city: 1 } }
        )
        .toArray(),
    ]);

    const maxCpByCb = new Map(perOff.map((p) => [p._id, p.maxCp]));
    const collegeById = new Map(cols.map((c) => [c._id, c]));

    // overview
    const cities = new Set(
      offerings.map((o) => o.city).filter((c): c is string => c != null)
    );
    const overview = {
      colleges: offerings.length,
      cities: cities.size,
      seats: offerings.reduce((s, o) => s + (o.totalIntake ?? 0), 0),
      avgCutoff: ovAgg[0]?.avg ?? null,
      topCutoff: ovAgg[0]?.max ?? null,
    };

    // byCity
    const byCityMap = new Map<
      string,
      { colleges: number; seats: number; cps: number[] }
    >();
    for (const o of offerings) {
      if (o.city == null) continue;
      const e =
        byCityMap.get(o.city) ??
        byCityMap.set(o.city, { colleges: 0, seats: 0, cps: [] }).get(o.city)!;
      e.colleges += 1;
      e.seats += o.totalIntake ?? 0;
      const cp = maxCpByCb.get(o._id);
      if (cp != null) e.cps.push(cp);
    }
    const byCity = [...byCityMap.entries()]
      .map(([city, e]) => ({
        city,
        colleges: e.colleges,
        seats: e.seats,
        avgCutoff: e.cps.length
          ? e.cps.reduce((s, x) => s + x, 0) / e.cps.length
          : null,
        topCutoff: e.cps.length ? Math.max(...e.cps) : null,
      }))
      .sort((a, b) => b.seats - a.seats || a.city.localeCompare(b.city));

    // topColleges
    const topColleges = offerings
      .map((o) => {
        const c = collegeById.get(o.collegeId);
        return {
          name: c?.name ?? o.collegeName,
          slug: c?.slug ?? "",
          city: c?.city ?? o.city,
          seats: o.totalIntake,
          cutoff: maxCpByCb.get(o._id) ?? null,
          _id: o._id,
        };
      })
      .sort((a, b) => {
        if (a.cutoff != null || b.cutoff != null) {
          if (a.cutoff == null) return 1;
          if (b.cutoff == null) return -1;
          if (b.cutoff !== a.cutoff) return b.cutoff - a.cutoff;
        }
        if ((a.seats ?? 0) !== (b.seats ?? 0)) return (b.seats ?? 0) - (a.seats ?? 0);
        return a._id - b._id;
      })
      .slice(0, 10)
      .map(({ name, slug, city, seats, cutoff }) => ({ name, slug, city, seats, cutoff }));

    return { overview, byCity, topColleges, trend };
  },
  ["branch-analysis"],
  { revalidate: REVALIDATE }
);
