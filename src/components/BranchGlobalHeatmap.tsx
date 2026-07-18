"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Target, Users, Briefcase } from "lucide-react";
import type { BranchMatrix } from "@/lib/branch";
import { CityEmployersDialog } from "@/components/CityEmployersDialog";

type Metric = "demand" | "seats";
const lpaShort = (v: number) => `₹${(v / 100000).toFixed(1)}L`;
const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

const CFG: Record<Metric, { label: string; short: string; hue: string; Icon: typeof Target; fmt: (v: number) => string }> = {
  demand: { label: "Admission demand (2025 Open %ile)", short: "Demand", hue: "var(--chart-1)", Icon: Target, fmt: (v) => v.toFixed(1) },
  seats: { label: "Sanctioned seats", short: "Seats", hue: "var(--chart-5)", Icon: Users, fmt: compact },
};

export function BranchGlobalHeatmap({ matrix }: { matrix: BranchMatrix }) {
  const [metric, setMetric] = useState<Metric>("demand");
  const [hover, setHover] = useState<{ f: string; c: string } | null>(null);
  const [sel, setSel] = useState<{ city: string; family: string | null } | null>(null);
  const cfg = CFG[metric];

  const { min, span } = useMemo(() => {
    const vals: number[] = [];
    for (const f of matrix.families)
      for (const c of matrix.cities) {
        const v = matrix.cells[f]?.[c]?.[metric];
        if (v != null) vals.push(v);
      }
    const mn = vals.length ? Math.min(...vals) : 0;
    const mx = vals.length ? Math.max(...vals) : 1;
    return { min: mn, span: mx - mn || 1 };
  }, [matrix, metric]);

  const cols = `minmax(150px,1.5fr) repeat(${matrix.cities.length}, minmax(52px,1fr))`;

  return (
    <section className="rounded-2xl border bg-card/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <LayoutGrid className="h-5 w-5 text-primary" />
          Branch × city heatmap
        </h2>
        <div className="inline-flex rounded-xl border bg-background p-1">
          {(["demand", "seats"] as Metric[]).map((m) => {
            const active = m === metric;
            const { Icon, short } = CFG[m];
            return (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {short}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Every branch family across Maharashtra&rsquo;s biggest cities at once —
        shade shows {cfg.label.toLowerCase()}. Hover a cell for detail; click a
        family to open its full interactive analysis.
      </p>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* header */}
          <div className="grid items-end gap-1 pb-1" style={{ gridTemplateColumns: cols }}>
            <div className="text-[11px] font-medium text-muted-foreground">Branch \ City</div>
            {matrix.cities.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSel({ city: c, family: null })}
                className={`truncate px-1 text-center text-[11px] font-medium underline-offset-2 transition-colors hover:text-primary hover:underline ${
                  hover?.c === c ? "text-primary" : "text-muted-foreground"
                }`}
                title={`Top employers in ${c}`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* rows */}
          {matrix.families.map((f, ri) => {
            const mk = matrix.market[f];
            const slug = matrix.slugs[f];
            return (
              <div
                key={f}
                className="grid animate-in fade-in slide-in-from-bottom-1 items-stretch gap-1 py-0.5"
                style={{ gridTemplateColumns: cols, animationDelay: `${ri * 40}ms` }}
              >
                <div className="flex min-w-0 flex-col justify-center pr-2">
                  <Link
                    href={slug ? `/branches/${slug}` : "/branches"}
                    className={`truncate text-sm font-medium transition-colors hover:text-primary ${
                      hover?.f === f ? "text-primary" : ""
                    }`}
                  >
                    {f}
                  </Link>
                  {mk && (mk.salary != null || mk.jobs != null) && (
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Briefcase className="h-2.5 w-2.5" />
                      {mk.salary != null ? lpaShort(mk.salary) : "—"}
                      {mk.jobs != null ? ` · ${compact(mk.jobs)} jobs` : ""}
                    </span>
                  )}
                </div>
                {matrix.cities.map((c) => {
                  const cell = matrix.cells[f]?.[c];
                  const v = cell?.[metric] ?? null;
                  const t = v != null ? (v - min) / span : 0;
                  const alpha = v != null ? 10 + Math.round(t * 74) : 0;
                  const strong = t >= 0.5 && v != null;
                  const isHover = hover?.f === f && hover?.c === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSel({ city: c, family: f })}
                      onMouseEnter={() => setHover({ f, c })}
                      onMouseLeave={() => setHover(null)}
                      title={
                        cell
                          ? `${f} · ${c}\nDemand: ${cell.demand != null ? cell.demand.toFixed(2) + " %ile" : "—"}\nSeats: ${cell.seats.toLocaleString()}\nClick for top employers`
                          : `${f} · ${c}: no data`
                      }
                      className={`relative grid h-11 place-items-center rounded-md text-[11px] font-semibold tabular-nums transition-[background-color,transform] duration-500 ${
                        isHover ? "z-10 scale-110 ring-2 ring-primary" : ""
                      } ${strong ? "text-primary-foreground" : v != null ? "" : "text-muted-foreground/40"}`}
                      style={{
                        backgroundColor:
                          v != null
                            ? `color-mix(in oklab, ${cfg.hue} ${alpha}%, var(--card))`
                            : "color-mix(in oklab, var(--muted) 40%, var(--card))",
                      }}
                    >
                      {v != null ? cfg.fmt(v) : "·"}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* legend */}
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>low</span>
        <span
          className="h-2 w-28 rounded-full"
          style={{
            background: `linear-gradient(to right, color-mix(in oklab, ${cfg.hue} 10%, var(--card)), color-mix(in oklab, ${cfg.hue} 84%, var(--card)))`,
          }}
        />
        <span>high</span>
        <span className="ml-1">{cfg.label}</span>
      </div>

      <CityEmployersDialog
        city={sel?.city ?? null}
        family={sel?.family ?? null}
        open={sel !== null}
        onOpenChange={(o) => !o && setSel(null)}
      />
    </section>
  );
}
