import { db } from "@/db";
import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

const PREDICT_YEAR = 2025;

/**
 * These landing/reference queries (aggregate counts, competitiveness ranking,
 * the search index) only change when cutoffs/colleges are ingested — never
 * per-request. On serverless + free-tier Postgres, running them live on every
 * request is what made the homepage time out and crash. Wrap each in the data
 * cache so the DB is hit at most once per REVALIDATE window; results are shared
 * across all requests until they expire.
 */
const REVALIDATE = 3600; // 1 hour

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
 */
export const getRankedColleges = unstable_cache(
  async (opts?: {
    area?: string;
    limit?: number;
  }): Promise<RankedCollege[]> => {
  const areaClause = opts?.area
    ? sql`and c.city ilike ${opts.area}`
    : sql``;
  const limitClause = opts?.limit ? sql`limit ${opts.limit}` : sql``;
  // Single-pass ranking: compute each college's seats/branch-count and its best
  // GOPEN closing percentile (+ the branch that owns it) in two grouped scans,
  // then join onto colleges. This replaces four correlated subqueries per row
  // (which forced the 65k-row cutoffs table to be re-scanned per college) with
  // one aggregate over each source table.
  const rows = await db.execute(sql`
    with seat_agg as (
      select cb.college_id,
             coalesce(sum(cb.total_intake), 0)::int as total_seats,
             count(*)::int as branch_count
      from college_branches cb
      group by cb.college_id
    ),
    cut_agg as (
      select cb.college_id,
             max(cu.closing_percentile)::float as top_cutoff,
             (array_agg(b.name order by cu.closing_percentile desc))[1] as top_branch
      from college_branches cb
      join cutoffs cu on cu.college_branch_id = cb.id
      join categories cat on cat.id = cu.category_id
      join branches b on b.id = cb.branch_id
      where cu.year = ${PREDICT_YEAR}
        and cat.code = 'GOPEN'
        and cu.verified_at is not null
      group by cb.college_id
    )
    select
      c.id, c.name, c.slug, c.city, c.type, c.is_autonomous as "isAutonomous",
      c.aicte_approved as "aicteApproved", c.naac_grade as "naacGrade",
      c.website, u.name as university,
      coalesce(sa.total_seats, 0) as "totalSeats",
      coalesce(sa.branch_count, 0) as "branchCount",
      ca.top_cutoff as "topCutoff",
      ca.top_branch as "topBranch"
    from colleges c
    left join universities u on u.id = c.home_university_id
    left join seat_agg sa on sa.college_id = c.id
    left join cut_agg ca on ca.college_id = c.id
    where c.hidden = false ${areaClause}
    order by "topCutoff" desc nulls last, "totalSeats" desc
    ${limitClause}
  `);
  return rows as unknown as RankedCollege[];
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
export const getSearchIndex = unstable_cache(
  async (): Promise<SearchDoc[]> => {
  const rows = await db.execute(sql`
    with cut_agg as (
      select cb.college_id, max(cu.closing_percentile) as top_cutoff
      from college_branches cb
      join cutoffs cu on cu.college_branch_id = cb.id
      join categories cat on cat.id = cu.category_id
      where cu.year = ${PREDICT_YEAR}
        and cat.code = 'GOPEN' and cu.verified_at is not null
      group by cb.college_id
    )
    select c.name, c.slug, c.city, u.name as university
    from colleges c
    left join universities u on u.id = c.home_university_id
    left join cut_agg ca on ca.college_id = c.id
    where c.hidden = false
    order by ca.top_cutoff desc nulls last, c.name
  `);
  return rows as unknown as SearchDoc[];
  },
  ["search-index"],
  { revalidate: REVALIDATE },
);

/** Headline totals for the landing hero. */
export const getLandingStats = unstable_cache(
  async () => {
    const rows = await db.execute(sql`
      select
        (select count(*) from colleges where not hidden)::int as colleges,
        (select count(*) from branches)::int as branches,
        (select coalesce(sum(total_intake),0) from college_branches)::int as seats,
        (select count(*) from cutoffs)::int as cutoffs,
        (select count(distinct year) from cutoffs)::int as years
    `);
    return (rows as unknown as {
      colleges: number;
      branches: number;
      seats: number;
      cutoffs: number;
      years: number;
    }[])[0];
  },
  ["landing-stats"],
  { revalidate: REVALIDATE },
);

/** Seats grouped by branch family (for a bar chart). */
export const getSeatsByFamily = unstable_cache(
  async () => {
    const rows = await db.execute(sql`
      select coalesce(b.family, 'Other') as family,
             coalesce(sum(cb.total_intake), 0)::int as seats
      from college_branches cb join branches b on b.id = cb.branch_id
      group by b.family order by seats desc
    `);
    return rows as unknown as { family: string; seats: number }[];
  },
  ["seats-by-family"],
  { revalidate: REVALIDATE },
);

/** Colleges + seats grouped by home university region (for a bar chart). */
export const getCollegesByRegion = unstable_cache(
  async () => {
    const rows = await db.execute(sql`
      select coalesce(u.short_name, u.name, 'Unmapped') as region,
             count(distinct c.id)::int as colleges
      from colleges c left join universities u on u.id = c.home_university_id
      group by u.short_name, u.name order by colleges desc limit 10
    `);
    return rows as unknown as { region: string; colleges: number }[];
  },
  ["colleges-by-region"],
  { revalidate: REVALIDATE },
);

/** Colleges with the highest verified placement packages (for a home widget). */
export const getTopPlacements = unstable_cache(
  async (limit = 6) => {
  const rows = await db.execute(sql`
    select c.name, c.slug, c.city,
           max(p.highest_package_lpa)::float as highest,
           max(p.median_package_lpa)::float as median,
           max(p.avg_package_lpa)::float as avg
    from placements p join colleges c on c.id = p.college_id
    where p.verified_at is not null and p.highest_package_lpa is not null and not c.hidden
    group by c.id, c.name, c.slug, c.city
    order by max(p.highest_package_lpa) desc
    limit ${limit}
  `);
  return rows as unknown as {
    name: string;
    slug: string;
    city: string | null;
    highest: number | null;
    median: number | null;
    avg: number | null;
  }[];
  },
  ["top-placements"],
  { revalidate: REVALIDATE },
);

/** Top areas (cities) by number of colleges — for the area browser. */
export const getAreaFacets = unstable_cache(
  async (limit = 12) => {
    const rows = await db.execute(sql`
      select city, count(*)::int as colleges
      from colleges where city is not null and not hidden
      group by city order by colleges desc limit ${limit}
    `);
    return rows as unknown as { city: string; colleges: number }[];
  },
  ["area-facets"],
  { revalidate: REVALIDATE },
);
