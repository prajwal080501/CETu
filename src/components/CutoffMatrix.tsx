"use client";

import { useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal, ImageDown } from "lucide-react";
import { SEAT_TYPE_LABELS, type SeatType } from "@/lib/reference";
import { ShareImageModal } from "@/components/ShareImageModal";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MatrixRow {
  branchName: string;
  branchFamily: string | null;
  categoryCode: string;
  categoryLabel: string;
  categoryGroup: string;
  seatType: string;
  closingPercentile: number | null;
  closingMeritNo: number | null;
}

type Metric = "percentile" | "rank";

const SEAT_ORDER: SeatType[] = ["HU", "HU_OHU", "OHU", "SL", "AI", "MI", "INST"];
const CAT_ORDER = [
  "GOPEN", "LOPEN", "EWS", "TFWS", "GSC", "LSC", "GST", "LST", "GVJ", "LVJ",
  "GNT1", "GNT2", "GNT3", "GOBC", "LOBC", "GSEBC", "LSEBC", "ORPHAN", "MI",
];

/** One heatmapped grid for a single metric (percentile OR merit rank). */
function MatrixGrid({
  rows,
  seat,
  metric,
  branches,
  categories,
  variant,
}: {
  rows: MatrixRow[];
  seat: string;
  metric: Metric;
  branches: string[];
  categories: [string, string][];
  variant: "app" | "brand";
}) {
  const lookup = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (r.seatType !== seat) continue;
      const v = metric === "percentile" ? r.closingPercentile : r.closingMeritNo;
      if (v != null) m.set(`${r.categoryCode}|${r.branchName}`, v);
    }
    return m;
  }, [rows, seat, metric]);

  const values = branches.flatMap((b) =>
    categories.map(([c]) => lookup.get(`${c}|${b}`)).filter((v): v is number => v != null)
  );
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 100;
  // 0..1 strength, higher = stronger (percentile high OR rank low is better)
  const strength = (v: number) => {
    let t = hi === lo ? 0.5 : (v - lo) / (hi - lo);
    if (metric === "rank") t = 1 - t;
    return t;
  };
  const fmt = (v: number) =>
    metric === "percentile" ? v.toFixed(2) : v.toLocaleString();

  if (variant === "brand") {
    const tint = (v: number) => `rgba(79,70,229,${(0.06 + strength(v) * 0.34).toFixed(3)})`;
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: "11px", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 8px", background: "#eef2ff", fontWeight: 600 }}>Category</th>
              {branches.map((b) => (
                <th key={b} style={{ padding: "6px 6px", background: "#eef2ff", minWidth: 62, textAlign: "center", fontWeight: 600 }}>{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(([code]) => (
              <tr key={code}>
                <th style={{ textAlign: "left", padding: "5px 8px", fontWeight: 700, background: "#ffffff" }}>{code}</th>
                {branches.map((b) => {
                  const v = lookup.get(`${code}|${b}`);
                  return (
                    <td key={b} style={{ padding: "5px 6px", textAlign: "center", background: v != null ? tint(v) : undefined, fontVariantNumeric: "tabular-nums" }}>
                      {v != null ? fmt(v) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const tint = (v: number) =>
    `color-mix(in oklab, var(--primary) ${Math.round(8 + strength(v) * 34)}%, transparent)`;
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium">Category</th>
            {branches.map((b) => (
              <th key={b} className="min-w-[92px] px-2 py-2 text-center align-bottom text-xs font-medium">{b}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map(([code, label]) => (
            <tr key={code} className="border-t">
              <th className="sticky left-0 z-10 bg-background px-3 py-1.5 text-left font-medium" title={label}>{code}</th>
              {branches.map((b) => {
                const v = lookup.get(`${code}|${b}`);
                return (
                  <td key={b} className="px-2 py-1.5 text-center tabular-nums" style={v != null ? { background: tint(v) } : undefined}>
                    {v != null ? fmt(v) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CutoffMatrix({
  year,
  rows,
  collegeName,
}: {
  year: number;
  rows: MatrixRow[];
  collegeName?: string;
}) {
  const [share, setShare] = useState(false);
  const seatTypes = useMemo(
    () => SEAT_ORDER.filter((s) => rows.some((r) => r.seatType === s)),
    [rows]
  );
  const [seat, setSeat] = useState<string>(
    () => seatTypes.find((s) => s === "HU") ?? seatTypes[0] ?? "SL"
  );

  const allBranches = useMemo(
    () => [...new Set(rows.filter((r) => r.seatType === seat).map((r) => r.branchName))].sort(),
    [rows, seat]
  );
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const branches = allBranches.filter((b) => !hidden.has(b));

  const categories = useMemo<[string, string][]>(() => {
    const present = [
      ...new Map(
        rows.filter((r) => r.seatType === seat).map((r) => [r.categoryCode, r.categoryLabel] as const)
      ),
    ];
    return present.sort((a, b) => {
      const ia = CAT_ORDER.indexOf(a[0]);
      const ib = CAT_ORDER.indexOf(b[0]);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a[0].localeCompare(b[0]);
    });
  }, [rows, seat]);

  // Only show the merit-rank table if that seat actually has any rank data.
  const hasRank = useMemo(
    () => rows.some((r) => r.seatType === seat && r.closingMeritNo != null),
    [rows, seat]
  );

  return (
    <div>
      {share && (
        <ShareImageModal
          title="Cutoff matrix"
          subtitle={`${collegeName ? collegeName + " · " : ""}${SEAT_TYPE_LABELS[seat as SeatType]} · ${year}`}
          filename={`cetu-cutoffs-${year}`}
          onClose={() => setShare(false)}
        >
          <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#4f46e5" }}>
            Closing percentile
          </div>
          <div className="mt-1">
            <MatrixGrid rows={rows} seat={seat} metric="percentile" branches={branches} categories={categories} variant="brand" />
          </div>
          {hasRank && (
            <>
              <div className="mt-4 text-[11px] font-bold uppercase tracking-wide" style={{ color: "#4f46e5" }}>
                Closing merit rank
              </div>
              <div className="mt-1">
                <MatrixGrid rows={rows} seat={seat} metric="rank" branches={branches} categories={categories} variant="brand" />
              </div>
            </>
          )}
        </ShareImageModal>
      )}

      {/* shared controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
          {seatTypes.map((s) => (
            <button
              key={s}
              onClick={() => setSeat(s)}
              title={SEAT_TYPE_LABELS[s as SeatType]}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                seat === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Branches ({branches.length}/{allBranches.length})
            <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Show branches</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allBranches.map((b) => (
                <DropdownMenuCheckboxItem
                  key={b}
                  checked={!hidden.has(b)}
                  closeOnClick={false}
                  onCheckedChange={(on) =>
                    setHidden((prev) => {
                      const next = new Set(prev);
                      if (on) next.delete(b);
                      else next.add(b);
                      return next;
                    })
                  }
                >
                  {b}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={() => setShare(true)}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium shadow-xs transition-colors hover:bg-accent"
          title="Share these tables as a branded image"
        >
          <ImageDown className="h-3.5 w-3.5" />
          Share
        </button>
        <span className="w-full text-right text-xs text-muted-foreground sm:w-auto">
          {SEAT_TYPE_LABELS[seat as SeatType]} · {year}
        </span>
      </div>

      {/* percentile table */}
      <h3 className="mb-2 text-sm font-semibold">Closing percentile</h3>
      <MatrixGrid rows={rows} seat={seat} metric="percentile" branches={branches} categories={categories} variant="app" />

      {/* merit rank table */}
      {hasRank && (
        <>
          <h3 className="mb-2 mt-8 text-sm font-semibold">Closing merit rank</h3>
          <p className="mb-2 -mt-1 text-xs text-muted-foreground">
            The CAP merit number (state merit rank) at which each category closed —
            lower is more competitive.
          </p>
          <MatrixGrid rows={rows} seat={seat} metric="rank" branches={branches} categories={categories} variant="app" />
        </>
      )}
    </div>
  );
}
