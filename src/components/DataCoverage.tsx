"use client";

import { useMemo, useState } from "react";
import { Check, X, Search } from "lucide-react";
import type { CollegeCoverage } from "@/lib/admin";

const FIELDS = [
  { key: "cutoffs", label: "Cutoffs" },
  { key: "placements", label: "Placements" },
  { key: "nirf", label: "NIRF" },
  { key: "naac", label: "NAAC" },
  { key: "fees", label: "Fees" },
  { key: "alumni", label: "Alumni" },
  { key: "university", label: "Univ." },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
const PAGE = 25;

/**
 * Per-college data availability matrix. Search by name, or filter to colleges
 * MISSING a given data type — the concrete "what still needs data" view.
 */
export function DataCoverage({
  rows,
  summary,
}: {
  rows: CollegeCoverage[];
  summary: Record<string, number> & { total: number };
}) {
  const [q, setQ] = useState("");
  const [missing, setMissing] = useState<FieldKey | "">("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (missing && r[missing]) return false;
      if (query && !`${r.name} ${r.city ?? ""}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [rows, q, missing]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pageCount);
  const shown = filtered.slice((current - 1) * PAGE, current * PAGE);

  return (
    <div>
      {/* summary chips */}
      <div className="flex flex-wrap gap-2">
        {FIELDS.map((f) => {
          const n = summary[f.key] ?? 0;
          const pct = summary.total ? Math.round((n / summary.total) * 100) : 0;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setMissing((m) => (m === f.key ? "" : f.key));
                setPage(1);
              }}
              className={`rounded-lg border px-3 py-1.5 text-left text-xs transition-colors ${
                missing === f.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 hover:bg-accent"
              }`}
              title={`Show ${summary.total - n} colleges missing ${f.label}`}
            >
              <div className="font-semibold">{f.label}</div>
              <div className="tabular-nums text-muted-foreground">
                {n}/{summary.total} · {pct}%
              </div>
            </button>
          );
        })}
      </div>

      {/* controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search college or city…"
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>
        {missing && (
          <button
            type="button"
            onClick={() => setMissing("")}
            className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Clear “missing {FIELDS.find((f) => f.key === missing)?.label}” filter
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtered.length} colleges
        </span>
      </div>

      {/* table */}
      <div className="mt-3 overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">College</th>
              {FIELDS.map((f) => (
                <th key={f.key} className="px-2 py-2 text-center font-medium">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2">
                  <div className="font-medium leading-tight">{r.name}</div>
                  {r.city && (
                    <div className="text-xs text-muted-foreground">{r.city}</div>
                  )}
                </td>
                {FIELDS.map((f) => (
                  <td key={f.key} className="px-2 py-2 text-center">
                    {r[f.key] ? (
                      <Check className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={FIELDS.length + 1} className="px-3 py-8 text-center text-muted-foreground">
                  No colleges match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={current === 1}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {current} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={current === pageCount}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
