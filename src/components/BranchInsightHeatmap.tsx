"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { IndianRupee, Briefcase, Target, Sparkles } from "lucide-react";
import { CityEmployersDialog } from "@/components/CityEmployersDialog";

export type CityInsight = {
  city: string;
  salary: number | null; // mean annual INR
  jobs: number | null; // open postings
  demand: number | null; // toughest closing percentile
  seats: number;
  colleges: number;
};

type Metric = "salary" | "jobs" | "demand";

const lpa = (v: number) => `₹${(v / 100000).toFixed(1)}L`;

const CFG: Record<
  Metric,
  { label: string; short: string; hue: string; fmt: (v: number) => string; Icon: typeof IndianRupee }
> = {
  // Colour by the job it does: salary→green (money), jobs→amber (activity),
  // demand→blue (neutral magnitude). Red (chart-4) stays reserved for status.
  salary: { label: "Median salary", short: "Salary", hue: "var(--chart-3)", fmt: lpa, Icon: IndianRupee },
  jobs: { label: "Open jobs", short: "Jobs", hue: "var(--chart-2)", fmt: (v) => v.toLocaleString(), Icon: Briefcase },
  demand: { label: "Admission demand", short: "Demand", hue: "var(--chart-1)", fmt: (v) => `${v.toFixed(1)}%ile`, Icon: Target },
};
const ORDER: Metric[] = ["salary", "jobs", "demand"];

export function BranchInsightHeatmap({
  cities,
  role,
  family,
  stateAvgSalary,
  stateJobs,
  histogram,
  fetchedAt,
  adzunaEnabled,
}: {
  cities: CityInsight[];
  role: string;
  family?: string | null;
  stateAvgSalary: number | null;
  stateJobs: number | null;
  histogram: { min: number; count: number }[] | null;
  fetchedAt: string | null;
  adzunaEnabled: boolean;
}) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const avail = (m: Metric) => cities.some((c) => c[m] != null);
  const salaryOn = avail("salary");
  const [metric, setMetric] = useState<Metric>(salaryOn ? "salary" : "demand");
  const cfg = CFG[metric];

  const sorted = useMemo(
    () =>
      cities
        .slice()
        .sort((a, b) => (b[metric] ?? -Infinity) - (a[metric] ?? -Infinity)),
    [cities, metric]
  );
  const vals = sorted
    .map((c) => c[metric])
    .filter((v): v is number => v != null);
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 1;
  const span = max - min || 1;

  // FLIP: animate cells to their new positions when the metric re-sorts them.
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const prev = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const now = new Map<string, DOMRect>();
    nodes.current.forEach((el, k) => now.set(k, el.getBoundingClientRect()));
    nodes.current.forEach((el, k) => {
      const p = prev.current.get(k);
      const n = now.get(k)!;
      if (p) {
        const dx = p.left - n.left;
        const dy = p.top - n.top;
        if (dx || dy) {
          el.animate(
            [
              { transform: `translate(${dx}px, ${dy}px)` },
              { transform: "translate(0, 0)" },
            ],
            { duration: 450, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
          );
        }
      }
    });
    prev.current = now;
  }, [metric, sorted]);

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" />
          Maharashtra insight map
        </h2>
        <span className="text-xs text-muted-foreground">
          {role}
          {fetchedAt
            ? ` · live via Adzuna · ${new Date(fetchedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
            : ""}
        </span>
      </div>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Every Maharashtra city at a glance — salary, open jobs and admission
        demand together. Pick a lens; cells re-rank and re-shade live.
      </p>

      {/* Metric toggle + state summary */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border bg-card p-1">
          {ORDER.map((m) => {
            const on = avail(m);
            const active = m === metric;
            const { Icon, short } = CFG[m];
            return (
              <button
                key={m}
                disabled={!on}
                onClick={() => on && setMetric(m)}
                title={on ? undefined : "Add Adzuna keys to enable"}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : on
                      ? "text-muted-foreground hover:text-foreground"
                      : "cursor-not-allowed text-muted-foreground/40"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {short}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {stateAvgSalary != null && (
            <span>
              MH avg <b className="text-foreground">{lpa(stateAvgSalary)}</b>
            </span>
          )}
          {stateJobs != null && (
            <span>
              <b className="text-foreground">{stateJobs.toLocaleString()}</b> jobs
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      {vals.length > 0 && (
        <div className="mb-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{cfg.fmt(min)}</span>
          <span
            className="h-2 w-32 rounded-full"
            style={{
              background: `linear-gradient(to right, color-mix(in oklab, ${cfg.hue} 10%, var(--card)), color-mix(in oklab, ${cfg.hue} 82%, var(--card)))`,
            }}
          />
          <span>{cfg.fmt(max)}</span>
          <span className="ml-1">{cfg.label}</span>
        </div>
      )}

      {/* City cells */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((c, i) => {
          const v = c[metric];
          const t = v != null ? (v - min) / span : 0;
          const alpha = v != null ? 10 + Math.round(t * 72) : 0;
          const strong = t >= 0.5 && v != null;
          const txt = strong ? "text-primary-foreground" : "";
          const sub = strong ? "text-primary-foreground/75" : "text-muted-foreground";
          return (
            <div
              key={c.city}
              ref={(el) => {
                if (el) nodes.current.set(c.city, el);
                else nodes.current.delete(c.city);
              }}
              className="group relative animate-in fade-in slide-in-from-bottom-2 rounded-xl border p-3 duration-500 will-change-transform hover:z-10 hover:-translate-y-1 hover:scale-[1.03] hover:shadow-xl"
              style={{
                animationDelay: `${i * 45}ms`,
                transitionProperty: "background-color, border-color, box-shadow, transform",
                transitionDuration: "500ms",
                backgroundColor:
                  v != null
                    ? `color-mix(in oklab, ${cfg.hue} ${alpha}%, var(--card))`
                    : "var(--muted)",
                borderColor:
                  v != null
                    ? `color-mix(in oklab, ${cfg.hue} ${Math.min(alpha + 12, 70)}%, var(--border))`
                    : "var(--border)",
              }}
            >
              {i === 0 && v != null && (
                <span className="absolute right-2 top-2 rounded-full bg-background/70 px-1.5 py-0.5 text-[9px] font-bold text-foreground">
                  #1
                </span>
              )}
              <button
                type="button"
                onClick={() => setSelectedCity(c.city)}
                className={`block truncate text-left text-sm font-semibold underline-offset-2 hover:underline ${txt}`}
                title={`Top employers in ${c.city}`}
              >
                {c.city} ↗
              </button>
              <div
                key={metric}
                className={`mt-0.5 animate-in fade-in text-xl font-bold tabular-nums duration-300 ${txt}`}
              >
                {v != null ? cfg.fmt(v) : "—"}
              </div>
              <div className={`mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] ${sub}`}>
                <MiniStat on={metric === "salary"} label="Sal" v={c.salary != null ? lpa(c.salary) : "—"} strong={strong} />
                <MiniStat on={metric === "jobs"} label="Jobs" v={c.jobs != null ? c.jobs.toLocaleString() : "—"} strong={strong} />
                <MiniStat on={metric === "demand"} label="%ile" v={c.demand != null ? c.demand.toFixed(1) : "—"} strong={strong} />
                <MiniStat on={false} label="Seats" v={c.seats ? c.seats.toLocaleString() : "—"} strong={strong} />
              </div>
            </div>
          );
        })}
      </div>

      {!salaryOn && !adzunaEnabled && (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing admission demand only. Add a free Adzuna{" "}
          <code className="rounded bg-muted px-1">ADZUNA_APP_ID</code>/
          <code className="rounded bg-muted px-1">ADZUNA_APP_KEY</code> to unlock
          the live salary &amp; jobs lenses.
        </p>
      )}

      {histogram && histogram.length > 0 && (
        <SalaryDistribution buckets={histogram} />
      )}

      <CityEmployersDialog
        city={selectedCity}
        family={family ?? null}
        open={selectedCity !== null}
        onOpenChange={(o) => !o && setSelectedCity(null)}
      />
    </section>
  );
}

function MiniStat({
  on,
  label,
  v,
  strong,
}: {
  on: boolean;
  label: string;
  v: string;
  strong: boolean;
}) {
  return (
    <span className={on ? (strong ? "font-bold" : "font-semibold text-foreground") : ""}>
      {label} <span className="tabular-nums">{v}</span>
    </span>
  );
}

function SalaryDistribution({ buckets }: { buckets: { min: number; count: number }[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div className="mt-6 rounded-xl border p-4">
      <div className="mb-3 text-xs font-medium text-muted-foreground">
        Salary distribution across Maharashtra
      </div>
      <div className="flex h-28 items-end gap-1.5">
        {buckets.map((b, i) => (
          <div key={b.min} className="group relative flex flex-1 flex-col items-center justify-end">
            <div
              className="w-full origin-bottom rounded-t bg-chart-3 transition-transform duration-700 ease-out"
              style={{
                height: `${(b.count / maxCount) * 100}%`,
                transform: mounted ? "scaleY(1)" : "scaleY(0)",
                transitionDelay: `${i * 40}ms`,
              }}
            />
            <div className="pointer-events-none absolute -top-6 z-10 whitespace-nowrap rounded bg-popover px-1.5 py-0.5 text-[10px] opacity-0 shadow transition-opacity group-hover:opacity-100">
              {b.count} @ ₹{(b.min / 100000).toFixed(1)}L
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>₹{(buckets[0].min / 100000).toFixed(1)}L</span>
        <span>₹{(buckets[buckets.length - 1].min / 100000).toFixed(1)}L+</span>
      </div>
    </div>
  );
}
