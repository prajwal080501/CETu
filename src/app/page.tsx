import Link from "next/link";
import { TrendingUp, MapPin, Briefcase } from "lucide-react";
import {
  getLandingStats,
  getSeatsByFamily,
  getAreaFacets,
  getRankedColleges,
  getTopPlacements,
  getSearchIndex,
} from "@/lib/landing";
import { BarStat } from "@/components/charts/bar-stat";
import { CollegeCard } from "@/components/CollegeCard";
import { CollegeSearch } from "@/components/CollegeSearch";
import { QuickPredict } from "@/components/QuickPredict";
import { AdmissionCountdown } from "@/components/AdmissionCountdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Each landing query is cached (see src/lib/landing.ts); allSettled means a
  // single slow/failed query degrades only its own widget instead of crashing
  // the whole page render.
  const [statsR, seatsR, areasR, collegesR, placementsR, indexR] =
    await Promise.allSettled([
      getLandingStats(),
      getSeatsByFamily(),
      getAreaFacets(8),
      getRankedColleges({ limit: 6 }),
      getTopPlacements(6),
      getSearchIndex(),
    ]);

  const stats = statsR.status === "fulfilled" ? statsR.value : null;
  const seatsByFamily = seatsR.status === "fulfilled" ? seatsR.value : [];
  const areas = areasR.status === "fulfilled" ? areasR.value : [];
  const topColleges = collegesR.status === "fulfilled" ? collegesR.value : [];
  const topPlacements =
    placementsR.status === "fulfilled" ? placementsR.value : [];
  const searchIndex = indexR.status === "fulfilled" ? indexR.value : [];

  const statTiles = stats
    ? [
        { label: "Colleges", value: stats.colleges.toLocaleString() },
        { label: "Seats", value: stats.seats.toLocaleString() },
        { label: "Branches", value: stats.branches.toLocaleString() },
        { label: "Cutoff records", value: stats.cutoffs.toLocaleString() },
        { label: "Years of data", value: String(stats.years) },
      ]
    : [];

  return (
    <div className="relative">
      {/* ambient gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-10rem] h-[32rem] w-[52rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute right-[10%] top-[2rem] h-[20rem] w-[20rem] rounded-full bg-chart-2/20 blur-[100px]" />
      </div>

      <div className="mx-auto max-w-6xl px-4">
        {/* Hero */}
        <section className="pt-16 pb-10 sm:pt-24">
          <Badge variant="secondary" className="mb-4 rounded-full">
            <TrendingUp className="mr-1 h-3 w-3" />
            {stats ? `${stats.years} years of MHT-CET CAP data` : "MHT-CET CAP data"}
          </Badge>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Every Maharashtra engineering college,{" "}
            <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              ranked and researched
            </span>{" "}
            in one place.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Search colleges by area, compare {stats ? `${stats.years} years` : "multiple years"} of CAP cutoffs,
            see branch-wise seats — and predict where your percentile can get you.
          </p>

          {/* Live typeahead search — results as you type */}
          <div className="mt-8">
            <CollegeSearch docs={searchIndex} />
          </div>

          {/* Area chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Browse by area:</span>
            {areas.map((a) => (
              <Link key={a.city} href={`/colleges?area=${encodeURIComponent(a.city)}`}>
                <Badge
                  variant="outline"
                  className="cursor-pointer gap-1 rounded-full py-1 transition-colors hover:border-primary hover:text-primary"
                >
                  <MapPin className="h-3 w-3" />
                  {a.city}
                  <span className="text-muted-foreground">{a.colleges}</span>
                </Badge>
              </Link>
            ))}
          </div>
        </section>

        {/* Live MHT-CET admission countdown */}
        <AdmissionCountdown />

        {/* Stat tiles */}
        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 empty:hidden">
          {statTiles.map((s) => (
            <Card key={s.label} className="border-border/60">
              <CardContent className="px-5">
                <div className="text-2xl font-bold tabular-nums text-primary">
                  {s.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {s.label}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Quick predictor + Top placements widgets */}
        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <QuickPredict />
          </div>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                Top placements
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Highest packages from official college reports
              </p>
            </CardHeader>
            <CardContent>
              {topPlacements.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Placement data coming soon.
                </p>
              ) : (
                <ol className="divide-y">
                  {topPlacements.map((p, i) => (
                    <li key={p.slug}>
                      <Link
                        href={`/colleges/${p.slug}`}
                        className="group flex items-center justify-between gap-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium group-hover:text-primary">
                              {p.name}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {p.city}
                              {p.median || p.avg
                                ? ` · median/avg ₹${Number(p.median ?? p.avg).toFixed(1)}L`
                                : ""}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 text-right">
                          <span className="font-bold tabular-nums text-primary">
                            ₹{Number(p.highest).toFixed(0)}L
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            highest
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Charts */}
        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Seats by branch family</CardTitle>
              <p className="text-xs text-muted-foreground">
                Total sanctioned CAP seats across Maharashtra
              </p>
            </CardHeader>
            <CardContent>
              <BarStat
                data={seatsByFamily.map((d) => ({ label: d.family, value: d.seats }))}
                label="Seats"
                color="var(--chart-1)"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Colleges by area</CardTitle>
              <p className="text-xs text-muted-foreground">
                Top cities by number of engineering colleges
              </p>
            </CardHeader>
            <CardContent>
              <BarStat
                data={areas.map((d) => ({ label: d.city, value: d.colleges }))}
                label="Colleges"
                color="var(--chart-2)"
              />
            </CardContent>
          </Card>
        </section>

        {/* Top colleges */}
        <section className="mt-12 mb-16">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Top colleges</h2>
            <Link
              href="/colleges"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all{stats ? ` ${stats.colleges}` : ""} →
            </Link>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by 2025 Open-category closing percentile.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topColleges.map((c, i) => (
              <CollegeCard key={c.id} college={c} rank={i + 1} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
