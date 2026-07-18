import { Briefcase, TrendingUp } from "lucide-react";
import { HeatGrid } from "@/components/HeatGrid";
import type { JobMarket } from "@/lib/adzuna";

const lpa = (inr: number) => `₹${(inr / 100000).toFixed(1)}L`;

export function JobMarketPanel({
  jm,
  enabled,
}: {
  jm: JobMarket;
  enabled: boolean;
}) {
  const hasData = Boolean(jm.geo?.regions.length || jm.histogram?.buckets.length);

  if (!hasData) {
    return (
      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Briefcase className="h-5 w-5 text-primary" />
          Job-market heatmap
        </h2>
        <div className="mt-3 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          {enabled ? (
            <>Live job-market data is being fetched — check back shortly.</>
          ) : (
            <>
              Live salary &amp; demand data for{" "}
              <span className="font-medium text-foreground">{jm.role}</span> across
              Maharashtra isn&rsquo;t connected yet. Add a free Adzuna{" "}
              <code className="rounded bg-muted px-1">ADZUNA_APP_ID</code> /{" "}
              <code className="rounded bg-muted px-1">ADZUNA_APP_KEY</code> to
              light up a live median-salary heatmap and salary distribution here.
            </>
          )}
        </div>
      </section>
    );
  }

  const maxCount = jm.histogram
    ? Math.max(...jm.histogram.buckets.map((b) => b.count), 1)
    : 1;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Briefcase className="h-5 w-5 text-primary" />
          Job-market heatmap
        </h2>
        <span className="text-xs text-muted-foreground">
          {jm.role} · live via Adzuna
          {jm.fetchedAt
            ? ` · ${new Date(jm.fetchedAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}`
            : ""}
        </span>
      </div>
      <p className="mb-3 mt-1 text-sm text-muted-foreground">
        Mean open-market salary for {jm.role.toLowerCase()} by Maharashtra city
        {jm.summary?.meanSalary != null
          ? ` — state avg ${lpa(jm.summary.meanSalary)}`
          : ""}
        {jm.summary?.jobs != null
          ? ` across ${jm.summary.jobs.toLocaleString()} live postings`
          : ""}
        . Cell shade = salary; sub-label = open jobs. Indicative market data, not
        college placements.
      </p>

      {jm.geo?.regions.length ? (
        <HeatGrid
          hue="var(--chart-2)"
          items={jm.geo.regions
            .slice()
            .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0))
            .slice(0, 12)
            .map((r) => ({
              label: r.region,
              value: r.salary,
              sub: `${r.jobs.toLocaleString()} jobs`,
            }))}
          format={lpa}
        />
      ) : null}

      {jm.histogram?.buckets.length ? (
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            Salary distribution (Maharashtra)
          </div>
          <div className="space-y-1">
            {jm.histogram.buckets.map((b) => (
              <div key={b.min} className="flex items-center gap-2 text-xs">
                <span className="w-14 shrink-0 tabular-nums text-muted-foreground">
                  {lpa(b.min)}
                </span>
                <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-chart-2"
                    style={{ width: `${(b.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                  {b.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
