"use client";

import { useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { SEAT_TYPE_LABELS, type SeatType } from "@/lib/reference";
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
// Canonical category display order; anything else sorts after, alphabetically.
const CAT_ORDER = [
  "GOPEN", "LOPEN", "EWS", "TFWS", "GSC", "LSC", "GST", "LST", "GVJ", "LVJ",
  "GNT1", "GNT2", "GNT3", "GOBC", "LOBC", "GSEBC", "LSEBC", "ORPHAN", "MI",
];

export function CutoffMatrix({ year, rows }: { year: number; rows: MatrixRow[] }) {
  const seatTypes = useMemo(
    () =>
      SEAT_ORDER.filter((s) => rows.some((r) => r.seatType === s)),
    [rows]
  );
  const [seat, setSeat] = useState<string>(
    () => seatTypes.find((s) => s === "HU") ?? seatTypes[0] ?? "SL"
  );
  const [metric, setMetric] = useState<Metric>("percentile");

  const allBranches = useMemo(
    () =>
      [...new Set(rows.filter((r) => r.seatType === seat).map((r) => r.branchName))].sort(),
    [rows, seat]
  );
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const branches = allBranches.filter((b) => !hidden.has(b));

  const categories = useMemo(() => {
    const present = [
      ...new Map(
        rows
          .filter((r) => r.seatType === seat)
          .map((r) => [r.categoryCode, r.categoryLabel] as const)
      ),
    ];
    return present.sort((a, b) => {
      const ia = CAT_ORDER.indexOf(a[0]);
      const ib = CAT_ORDER.indexOf(b[0]);
      if (ia !== -1 || ib !== -1)
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a[0].localeCompare(b[0]);
    });
  }, [rows, seat]);

  const lookup = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (r.seatType !== seat) continue;
      const v = metric === "percentile" ? r.closingPercentile : r.closingMeritNo;
      if (v != null) m.set(`${r.categoryCode}|${r.branchName}`, v);
    }
    return m;
  }, [rows, seat, metric]);

  // heatmap bounds across visible cells (higher percentile OR lower rank = better)
  const values = branches.flatMap((b) =>
    categories.map(([c]) => lookup.get(`${c}|${b}`)).filter((v): v is number => v != null)
  );
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 100;
  const tint = (v: number) => {
    let t = hi === lo ? 0.5 : (v - lo) / (hi - lo);
    if (metric === "rank") t = 1 - t; // lower rank is stronger
    return `color-mix(in oklab, var(--primary) ${Math.round(8 + t * 34)}%, transparent)`;
  };
  const fmt = (v: number) =>
    metric === "percentile" ? v.toFixed(2) : v.toLocaleString();

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* seat-type tabs */}
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
          {seatTypes.map((s) => (
            <button
              key={s}
              onClick={() => setSeat(s)}
              title={SEAT_TYPE_LABELS[s as SeatType]}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                seat === s
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* percentile / rank toggle */}
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
          {(["percentile", "rank"] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                metric === m
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "rank" ? "Merit rank" : "Percentile"}
            </button>
          ))}
        </div>

        {/* branch filter */}
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

        <span className="ml-auto text-xs text-muted-foreground">
          Closing {metric === "rank" ? "merit rank" : "percentile"} ·{" "}
          {SEAT_TYPE_LABELS[seat as SeatType]} · {year}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium">
                Category
              </th>
              {branches.map((b) => (
                <th
                  key={b}
                  className="min-w-[92px] px-2 py-2 text-center align-bottom text-xs font-medium"
                >
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(([code, label]) => (
              <tr key={code} className="border-t">
                <th
                  className="sticky left-0 z-10 bg-background px-3 py-1.5 text-left font-medium"
                  title={label}
                >
                  {code}
                </th>
                {branches.map((b) => {
                  const v = lookup.get(`${code}|${b}`);
                  return (
                    <td
                      key={b}
                      className="px-2 py-1.5 text-center tabular-nums"
                      style={v != null ? { background: tint(v) } : undefined}
                    >
                      {v != null ? fmt(v) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
