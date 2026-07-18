import "server-only";
import { db } from "@/db";
import { cityEmployers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { adzunaEnabled } from "./adzuna";
import { roleForFamily } from "./branch-roles";

/**
 * Top employers per city, from Adzuna's `top_companies` leaderboard (live job
 * postings), enriched with a resolved company domain (Clearbit autocomplete) so
 * we can show logos. Cached per (city, scope) with a small dated history so the
 * page can show hiring over time. Graceful: nulls when Adzuna isn't configured.
 */

const APP_ID = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;
const BASE = "https://api.adzuna.com/v1/api/jobs/in";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Employer = { name: string; count: number; domain: string | null };
export type EmployerHistory = { date: string; top: { name: string; count: number }[] };
export type CityEmployers = {
  city: string;
  role: string;
  employers: Employer[];
  totalPostings: number;
  history: EmployerHistory[];
  fetchedAt: string | null;
  live: boolean;
};

/** Resolve a company name → primary web domain via Clearbit autocomplete (free). */
async function resolveDomain(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const arr = (await res.json()) as { domain?: string }[];
    return arr?.[0]?.domain ?? null;
  } catch {
    return null;
  }
}

async function fetchLeaderboard(
  city: string,
  what: string
): Promise<{ name: string; count: number }[]> {
  try {
    const res = await fetch(
      `${BASE}/top_companies?app_id=${APP_ID}&app_key=${APP_KEY}&what=${encodeURIComponent(
        what
      )}&where=${encodeURIComponent(city)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      leaderboard?: { canonical_name?: string; count?: number }[];
    };
    return (data.leaderboard ?? [])
      .map((l) => ({ name: String(l.canonical_name ?? "").trim(), count: Number(l.count ?? 0) }))
      .filter((l) => l.name && l.count > 0);
  } catch {
    return [];
  }
}

export async function getCityEmployers(
  city: string,
  family?: string | null
): Promise<CityEmployers> {
  const scope = family ?? "all";
  const role = roleForFamily(family);

  const [cached] = await db
    .select({ payload: cityEmployers.payload, fetchedAt: cityEmployers.fetchedAt })
    .from(cityEmployers)
    .where(and(eq(cityEmployers.city, city), eq(cityEmployers.scope, scope)))
    .limit(1);

  const cachedPayload = cached?.payload as
    | { employers: Employer[]; totalPostings: number; history: EmployerHistory[] }
    | undefined;
  const fresh = cached && Date.now() - cached.fetchedAt.getTime() < TTL_MS;

  if (adzunaEnabled && !fresh) {
    const board = await fetchLeaderboard(city, role.what);
    if (board.length) {
      const top = board.slice(0, 15);
      // Resolve domains sequentially (best-effort, spaced) for logos.
      const employers: Employer[] = [];
      for (const c of top) {
        const domain = await resolveDomain(c.name);
        employers.push({ name: c.name, count: c.count, domain });
        await sleep(80);
      }
      const totalPostings = board.reduce((s, c) => s + c.count, 0);
      const history: EmployerHistory[] = [
        { date: new Date().toISOString(), top: top.slice(0, 8).map(({ name, count }) => ({ name, count })) },
        ...(cachedPayload?.history ?? []),
      ].slice(0, 6);

      const payload = { employers, totalPostings, history };
      await db
        .insert(cityEmployers)
        .values({ city, scope, payload, fetchedAt: new Date() })
        .onConflictDoUpdate({
          target: [cityEmployers.city, cityEmployers.scope],
          set: { payload, fetchedAt: new Date() },
        });

      return {
        city,
        role: role.label,
        employers,
        totalPostings,
        history,
        fetchedAt: new Date().toISOString(),
        live: true,
      };
    }
  }

  return {
    city,
    role: role.label,
    employers: cachedPayload?.employers ?? [],
    totalPostings: cachedPayload?.totalPostings ?? 0,
    history: cachedPayload?.history ?? [],
    fetchedAt: cached ? cached.fetchedAt.toISOString() : null,
    live: false,
  };
}
