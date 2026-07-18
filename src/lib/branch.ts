import { db } from "@/db";
import { sql } from "drizzle-orm";

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
export async function listBranches(): Promise<BranchListItem[]> {
  const rows = await db.execute(sql`
    select b.id, b.name, b.slug, b.family,
      count(distinct cb.college_id)::int as colleges,
      coalesce(sum(cb.total_intake), 0)::int as seats,
      (select avg(cu.closing_percentile)::float
         from cutoffs cu join categories cat on cat.id = cu.category_id
        where cu.college_branch_id in (
                select id from college_branches where branch_id = b.id)
          and cu.year = ${YEAR} and cat.code = 'GOPEN'
          and cu.verified_at is not null) as "avgCutoff"
    from branches b
    join college_branches cb on cb.branch_id = b.id
    group by b.id, b.name, b.slug, b.family
    having count(distinct cb.college_id) > 0
    order by seats desc, colleges desc
  `);
  return rows as unknown as BranchListItem[];
}

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
export async function getBranchCityMatrix(cityCount = 8): Promise<BranchMatrix> {
  const [cityRows, seatRows, demandRows, marketRows, slugRows] = await Promise.all([
    db.execute(sql`
      select c.city, coalesce(sum(cb.total_intake),0)::int as seats
      from colleges c join college_branches cb on cb.college_id = c.id
      where c.city is not null
      group by c.city order by seats desc limit ${cityCount}
    `),
    db.execute(sql`
      select b.family, c.city, coalesce(sum(cb.total_intake),0)::int as seats
      from college_branches cb
      join colleges c on c.id = cb.college_id
      join branches b on b.id = cb.branch_id
      where c.city is not null and b.family is not null
      group by b.family, c.city
    `),
    db.execute(sql`
      select b.family, c.city, max(cu.closing_percentile)::float as demand
      from cutoffs cu
      join college_branches cb on cb.id = cu.college_branch_id
      join colleges c on c.id = cb.college_id
      join branches b on b.id = cb.branch_id
      join categories cat on cat.id = cu.category_id
      where cu.year = ${YEAR} and cat.code = 'GOPEN' and cu.verified_at is not null
        and c.city is not null and b.family is not null
      group by b.family, c.city
    `),
    db.execute(sql`select family, payload from job_market where kind = 'summary'`),
    db.execute(sql`
      select distinct on (family) family, slug from (
        select b.family, b.slug, count(cb.id) as n
        from branches b join college_branches cb on cb.branch_id = b.id
        where b.family is not null
        group by b.family, b.slug, b.id
      ) t order by family, n desc
    `),
  ]);

  const cities = (cityRows as unknown as { city: string }[]).map((r) => r.city);
  const citySet = new Set(cities);

  const cells: BranchMatrix["cells"] = {};
  const familyTotals = new Map<string, number>();
  for (const r of seatRows as unknown as { family: string; city: string; seats: number }[]) {
    familyTotals.set(r.family, (familyTotals.get(r.family) ?? 0) + r.seats);
    if (!citySet.has(r.city)) continue;
    (cells[r.family] ??= {})[r.city] = { demand: null, seats: r.seats };
  }
  for (const r of demandRows as unknown as { family: string; city: string; demand: number | null }[]) {
    if (!citySet.has(r.city)) continue;
    const cell = (cells[r.family] ??= {})[r.city];
    if (cell) cell.demand = r.demand;
    else cells[r.family][r.city] = { demand: r.demand, seats: 0 };
  }

  const market: BranchMatrix["market"] = {};
  for (const r of marketRows as unknown as {
    family: string;
    payload: { meanSalary: number | null; jobs: number | null };
  }[]) {
    market[r.family] = { salary: r.payload?.meanSalary ?? null, jobs: r.payload?.jobs ?? null };
  }

  const slugs: BranchMatrix["slugs"] = {};
  for (const r of slugRows as unknown as { family: string; slug: string }[]) {
    if (!slugs[r.family]) slugs[r.family] = r.slug;
  }

  const families = [...familyTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f)
    .filter((f) => cells[f]);

  return { families, cities, cells, market, slugs };
}

export async function getBranchBySlug(slug: string) {
  const rows = await db.execute(sql`
    select id, name, slug, degree, family
    from branches where slug = ${slug} limit 1
  `);
  const list = rows as unknown as {
    id: number;
    name: string;
    slug: string;
    degree: string;
    family: string | null;
  }[];
  return list[0] ?? null;
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

export async function getBranchAnalysis(branchId: number): Promise<BranchAnalysis> {
  const [overviewRows, byCityRows, topRows, trendRows] = await Promise.all([
    db.execute(sql`
      select
        count(distinct cb.college_id)::int as colleges,
        count(distinct c.city)::int as cities,
        coalesce(sum(cb.total_intake), 0)::int as seats,
        (select avg(cu.closing_percentile)::float from cutoffs cu
           join categories cat on cat.id = cu.category_id
          where cu.college_branch_id in (select id from college_branches where branch_id = ${branchId})
            and cu.year = ${YEAR} and cat.code = 'GOPEN' and cu.verified_at is not null) as "avgCutoff",
        (select max(cu.closing_percentile)::float from cutoffs cu
           join categories cat on cat.id = cu.category_id
          where cu.college_branch_id in (select id from college_branches where branch_id = ${branchId})
            and cu.year = ${YEAR} and cat.code = 'GOPEN' and cu.verified_at is not null) as "topCutoff"
      from college_branches cb
      join colleges c on c.id = cb.college_id
      where cb.branch_id = ${branchId}
    `),
    db.execute(sql`
      select c.city,
        count(distinct cb.college_id)::int as colleges,
        coalesce(sum(cb.total_intake), 0)::int as seats,
        avg(g.cp)::float as "avgCutoff",
        max(g.cp)::float as "topCutoff"
      from college_branches cb
      join colleges c on c.id = cb.college_id
      left join lateral (
        select cu.closing_percentile as cp from cutoffs cu
          join categories cat on cat.id = cu.category_id
         where cu.college_branch_id = cb.id and cu.year = ${YEAR}
           and cat.code = 'GOPEN' and cu.verified_at is not null
         order by cu.closing_percentile desc limit 1
      ) g on true
      where cb.branch_id = ${branchId} and c.city is not null
      group by c.city
      order by seats desc
    `),
    db.execute(sql`
      select c.name, c.slug, c.city, cb.total_intake as seats,
        (select max(cu.closing_percentile)::float from cutoffs cu
           join categories cat on cat.id = cu.category_id
          where cu.college_branch_id = cb.id and cu.year = ${YEAR}
            and cat.code = 'GOPEN' and cu.verified_at is not null) as cutoff
      from college_branches cb
      join colleges c on c.id = cb.college_id
      where cb.branch_id = ${branchId}
      order by cutoff desc nulls last, seats desc nulls last
      limit 10
    `),
    db.execute(sql`
      select cu.year,
        avg(cu.closing_percentile)::float as "avgCutoff"
      from cutoffs cu
      join categories cat on cat.id = cu.category_id
      where cu.college_branch_id in (select id from college_branches where branch_id = ${branchId})
        and cat.code = 'GOPEN' and cu.verified_at is not null
      group by cu.year order by cu.year
    `),
  ]);

  const overviewList = overviewRows as unknown as BranchAnalysis["overview"][];
  return {
    overview:
      overviewList[0] ?? {
        colleges: 0,
        seats: 0,
        avgCutoff: null,
        topCutoff: null,
        cities: 0,
      },
    byCity: byCityRows as unknown as BranchAnalysis["byCity"],
    topColleges: topRows as unknown as BranchAnalysis["topColleges"],
    trend: trendRows as unknown as BranchAnalysis["trend"],
  };
}
