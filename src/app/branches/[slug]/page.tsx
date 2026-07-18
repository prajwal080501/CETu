import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Building2, Users, TrendingUp } from "lucide-react";
import { getBranchBySlug, getBranchAnalysis } from "@/lib/branch";
import { getJobMarket, adzunaEnabled } from "@/lib/adzuna";
import { roleForFamily } from "@/lib/branch-roles";
import { guideForFamily } from "@/lib/branch-guide";
import { BookOpen, Layers, Wrench, Briefcase as BriefcaseIcon, Target as TargetIcon } from "lucide-react";
import {
  BranchInsightHeatmap,
  type CityInsight,
} from "@/components/BranchInsightHeatmap";
import { BarStat } from "@/components/charts/bar-stat";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
// Cold Adzuna fetch (per-city salary) can run several seconds — above the default.
export const maxDuration = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const b = await getBranchBySlug(slug);
  if (!b) return {};
  return {
    title: `${b.name} — Branch Analysis & Job Market`,
    description: `${b.name} in Maharashtra: seats and admission demand by city, top colleges, cutoff trends and a live job-market salary heatmap.`,
  };
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default async function BranchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const branch = await getBranchBySlug(slug);
  if (!branch) notFound();

  const [analysis, jm] = await Promise.all([
    getBranchAnalysis(branch.id),
    getJobMarket(branch.family),
  ]);
  const role = roleForFamily(branch.family);
  const guide = guideForFamily(branch.family);
  const { overview } = analysis;

  // Merge admission-demand (our CAP data) with live salary/jobs (Adzuna) into
  // one per-city dataset for the interactive insight map.
  const norm = (s: string) => s.trim().toLowerCase();
  const cityMap = new Map<string, CityInsight>();
  for (const c of analysis.byCity) {
    cityMap.set(norm(c.city), {
      city: c.city,
      demand: c.topCutoff,
      seats: c.seats,
      colleges: c.colleges,
      salary: null,
      jobs: null,
    });
  }
  for (const r of jm.geo?.regions ?? []) {
    const k = norm(r.region);
    const ex = cityMap.get(k);
    if (ex) {
      ex.salary = r.salary;
      ex.jobs = r.jobs;
    } else {
      cityMap.set(k, {
        city: r.region,
        demand: null,
        seats: 0,
        colleges: 0,
        salary: r.salary,
        jobs: r.jobs,
      });
    }
  }
  const cityInsights = [...cityMap.values()]
    .filter((c) => c.demand != null || c.salary != null || c.jobs != null)
    .sort((a, b) => b.seats - a.seats)
    .slice(0, 16);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/branches" className="text-sm text-primary hover:underline">
        ← All branches
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">{branch.name}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {branch.family && (
          <Badge variant="secondary" className="rounded-full">
            {branch.family}
          </Badge>
        )}
        <span>{branch.degree}</span>
        <span>· leads to {role.label.toLowerCase()}</span>
      </div>

      {/* Overview */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Building2 className="h-3.5 w-3.5" />} label="Colleges (MH)" value={String(overview.colleges)} />
        <Stat icon={<Users className="h-3.5 w-3.5" />} label="Total seats" value={overview.seats.toLocaleString()} />
        <Stat icon={<MapPin className="h-3.5 w-3.5" />} label="Cities" value={String(overview.cities)} />
        <Stat
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Top cutoff %ile"
          value={overview.topCutoff != null ? overview.topCutoff.toFixed(2) : "—"}
        />
      </section>

      {/* Get to know this branch — beginner-friendly overview */}
      <section className="mt-8 rounded-2xl border bg-gradient-to-br from-primary/[0.05] to-transparent p-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Get to know {branch.name}</h2>
        </div>
        <p className="mt-2 text-base font-medium text-primary">{guide.tagline}</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {guide.about}
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Layers className="h-4 w-4 text-primary" />
              Topics you&rsquo;ll study
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {guide.topics.map((t) => (
                <span
                  key={t}
                  className="rounded-full border bg-card px-2.5 py-1 text-xs font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Wrench className="h-4 w-4 text-primary" />
              Skills you&rsquo;ll build
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {guide.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <BriefcaseIcon className="h-4 w-4 text-primary" />
            Where it leads
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {guide.careers.map((c) => (
              <span
                key={c}
                className="rounded-full border border-primary/20 bg-primary/[0.06] px-2.5 py-1 text-xs font-medium"
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-sm">
          <TargetIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="font-medium">Good fit if: </span>
            {guide.goodFit}
          </span>
        </div>
      </section>

      {/* Interactive insight map: salary + jobs + demand per MH city, one view */}
      {cityInsights.length > 0 && (
        <BranchInsightHeatmap
          cities={cityInsights}
          role={role.label}
          family={branch.family}
          stateAvgSalary={jm.summary?.meanSalary ?? null}
          stateJobs={jm.summary?.jobs ?? null}
          histogram={jm.histogram?.buckets ?? null}
          fetchedAt={jm.fetchedAt}
          adzunaEnabled={adzunaEnabled}
        />
      )}

      {/* Cutoff trend */}
      {analysis.trend.filter((t) => t.avgCutoff != null).length > 1 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Cutoff trend</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">
            Average Open-category closing percentile across Maharashtra, by year.
          </p>
          <BarStat
            data={analysis.trend
              .filter((t) => t.avgCutoff != null)
              .map((t) => ({ label: String(t.year), value: Number(t.avgCutoff) }))}
            label="Avg closing %ile"
            color="var(--chart-3)"
          />
        </section>
      )}

      {/* Top colleges for this branch */}
      {analysis.topColleges.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Most competitive colleges</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">
            Ranked by 2025 Open-category closing percentile for this branch.
          </p>
          <div className="overflow-hidden rounded-xl border">
            <ul className="divide-y">
              {analysis.topColleges.map((c, i) => (
                <li key={c.slug}>
                  <Link
                    href={`/colleges/${c.slug}`}
                    className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-accent/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{c.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {c.city}
                          {c.seats != null ? ` · ${c.seats} seats` : ""}
                        </div>
                      </div>
                    </div>
                    {c.cutoff != null && (
                      <span className="shrink-0 text-right">
                        <span className="font-bold tabular-nums text-primary">
                          {c.cutoff.toFixed(2)}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          %ile
                        </span>
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
