import "server-only";
import { db } from "@/db";
import { jobMarket } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { roleForFamily } from "./branch-roles";

/**
 * Adzuna live job-market integration (India / Maharashtra). Graceful degradation
 * like Clerk/Gemini: gated on ADZUNA_APP_ID + ADZUNA_APP_KEY. Without keys the
 * job-market heatmap simply shows a "connect a source" placeholder and the rest
 * of the branch page (all real CAP data) is unaffected.
 *
 * Free-tier friendly: every response is cached in `job_market` keyed by branch
 * family; we only call Adzuna when the cache is missing or older than TTL.
 */

const APP_ID = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;
const BASE = "https://api.adzuna.com/v1/api/jobs/in";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const adzunaEnabled = Boolean(
  APP_ID && APP_KEY && APP_ID !== "REPLACE_ME" && APP_KEY !== "REPLACE_ME"
);

export type GeoPayload = {
  // Per Maharashtra city: mean salary (from search) + open job count. Adzuna
  // India geodata returns job counts per region (no median), so we enumerate
  // cities from it and pull each city's mean salary from the search endpoint.
  regions: { region: string; salary: number | null; jobs: number }[];
  currency: string;
};
export type HistogramPayload = {
  buckets: { min: number; count: number }[];
  currency: string;
};
export type SummaryPayload = {
  meanSalary: number | null;
  jobs: number | null;
  role: string;
};

export type JobMarket = {
  geo: GeoPayload | null;
  histogram: HistogramPayload | null;
  summary: SummaryPayload | null;
  role: string;
  fetchedAt: string | null;
  stale: boolean;
};

function auth(): string {
  return `app_id=${APP_ID}&app_key=${APP_KEY}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET JSON with one retry — smooths transient free-tier 429s. */
async function getJSON(
  url: string,
  retries = 1
): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return (await res.json()) as Record<string, unknown>;
      if (res.status === 429 && attempt < retries) {
        await sleep(600);
        continue;
      }
      return null;
    } catch {
      if (attempt < retries) await sleep(400);
    }
  }
  return null;
}

/** Live-fetch the three payloads for a family's role and normalize them. */
async function fetchFromAdzuna(
  family: string
): Promise<{ geo: GeoPayload | null; histogram: HistogramPayload | null; summary: SummaryPayload | null }> {
  const role = roleForFamily(family);
  const what = encodeURIComponent(role.what);

  // 1. Enumerate Maharashtra cities by job volume (geodata gives counts).
  const geoRaw = await getJSON(
    `${BASE}/geodata?${auth()}&location0=India&location1=Maharashtra&category=${role.category}`
  );
  const cities = (
    (Array.isArray(geoRaw?.locations) ? geoRaw!.locations : []) as Record<
      string,
      unknown
    >[]
  )
    .map((l) => {
      const area = (l.location as { area?: string[] } | undefined)?.area ?? [];
      return { region: String(area[area.length - 1] ?? ""), jobs: Number(l.count ?? 0) };
    })
    .filter((c) => c.region && c.jobs > 0)
    .sort((a, b) => b.jobs - a.jobs)
    .slice(0, 6);

  // 2. Per-city mean salary (search) — sequential + spaced to respect the free
  // tier's rate limit (a wide concurrent burst trips 429s).
  const perCity: { region: string; jobs: number; salary: number | null }[] = [];
  for (const c of cities) {
    const s = await getJSON(
      `${BASE}/search/1?${auth()}&results_per_page=1&where=${encodeURIComponent(
        c.region
      )}&what=${what}&category=${role.category}`
    );
    perCity.push({
      region: c.region,
      jobs: c.jobs,
      salary: s?.mean != null ? Math.round(Number(s.mean)) : null,
    });
    await sleep(150);
  }

  // 3. Histogram + Maharashtra-wide summary (sequential after the city loop).
  const histRaw = await getJSON(
    `${BASE}/histogram?${auth()}&location0=India&location1=Maharashtra&what=${what}`
  );
  await sleep(150);
  const mhRaw = await getJSON(
    `${BASE}/search/1?${auth()}&results_per_page=1&where=Maharashtra&what=${what}&category=${role.category}`
  );

  const geo: GeoPayload | null = perCity.length
    ? { regions: perCity, currency: "INR" }
    : null;

  let histogram: HistogramPayload | null = null;
  if (histRaw && histRaw.histogram && typeof histRaw.histogram === "object") {
    const buckets = Object.entries(histRaw.histogram as Record<string, number>)
      .map(([min, count]) => ({ min: Number(min), count: Number(count) }))
      .filter((b) => Number.isFinite(b.min))
      .sort((a, b) => a.min - b.min);
    if (buckets.length) histogram = { buckets, currency: "INR" };
  }

  const summary: SummaryPayload = {
    meanSalary: mhRaw?.mean != null ? Math.round(Number(mhRaw.mean)) : null,
    jobs: mhRaw?.count != null ? Number(mhRaw.count) : null,
    role: role.label,
  };

  return { geo, histogram, summary };
}

/** Read cached rows for a family. */
async function readCache(family: string) {
  const rows = await db
    .select({ kind: jobMarket.kind, payload: jobMarket.payload, fetchedAt: jobMarket.fetchedAt })
    .from(jobMarket)
    .where(eq(jobMarket.family, family));
  return rows;
}

async function writeCache(
  family: string,
  kind: string,
  payload: unknown
): Promise<void> {
  await db
    .insert(jobMarket)
    .values({ family, kind, payload: payload as object, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: [jobMarket.family, jobMarket.kind],
      set: { payload: payload as object, fetchedAt: new Date() },
    });
}

/**
 * Get job-market data for a branch family: serves cache, refreshes from Adzuna
 * when enabled and the cache is missing/stale. Returns nulls (with role label)
 * when Adzuna isn't configured and nothing is cached.
 */
export async function getJobMarket(family: string | null): Promise<JobMarket> {
  const fam = family ?? "Other";
  const role = roleForFamily(fam);

  const cached = await readCache(fam);
  const byKind = new Map(cached.map((r) => [r.kind, r]));
  const newest = cached.reduce<Date | null>(
    (acc, r) => (!acc || r.fetchedAt > acc ? r.fetchedAt : acc),
    null
  );
  const stale = !newest || Date.now() - newest.getTime() > TTL_MS;

  // Refresh path: only when configured and (missing or stale).
  if (adzunaEnabled && (cached.length === 0 || stale)) {
    const fresh = await fetchFromAdzuna(fam);
    if (fresh.geo || fresh.histogram || fresh.summary) {
      await Promise.all([
        fresh.geo && writeCache(fam, "geo", fresh.geo),
        fresh.histogram && writeCache(fam, "histogram", fresh.histogram),
        fresh.summary && writeCache(fam, "summary", fresh.summary),
      ]);
      return {
        geo: fresh.geo,
        histogram: fresh.histogram,
        summary: fresh.summary,
        role: role.label,
        fetchedAt: new Date().toISOString(),
        stale: false,
      };
    }
  }

  return {
    geo: (byKind.get("geo")?.payload as GeoPayload) ?? null,
    histogram: (byKind.get("histogram")?.payload as HistogramPayload) ?? null,
    summary: (byKind.get("summary")?.payload as SummaryPayload) ?? null,
    role: role.label,
    fetchedAt: newest ? newest.toISOString() : null,
    stale,
  };
}
