"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, Search, ArrowUpDown, FileText } from "lucide-react";
import type { CompareCollege } from "@/lib/compare";
import { SEAT_TYPE_LABELS, type SeatType } from "@/lib/reference";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Lite = { id: number; name: string; city: string | null };
type BranchData = {
  year: number | null;
  cells: {
    collegeId: number;
    categoryCode: string;
    seatType: string;
    closingPercentile: number | null;
    closingMeritNo: number | null;
  }[];
  seats: Record<number, number | null>;
};

const FEE_BAND: Record<string, string> = {
  government: "₹15k–90k",
  government_aided: "₹20k–95k",
  university_dept: "₹20k–90k",
  autonomous: "₹80k–1.5L",
  private_unaided: "₹1–1.75L",
  deemed: "₹2–4L",
};
const CAT_ORDER = ["GOPEN", "LOPEN", "EWS", "TFWS", "GSC", "GST", "GOBC", "GVJ", "GNT1", "GNT2", "GNT3", "GSEBC"];

export function CompareBoard({
  colleges,
  allColleges,
  commonBranches,
  selectedBranchId,
  branch,
  seat,
  metric,
}: {
  colleges: CompareCollege[];
  allColleges: Lite[];
  commonBranches: { id: number; name: string; colleges: number }[];
  selectedBranchId: number | null;
  branch: BranchData | null;
  seat: string;
  metric: "percentile" | "rank";
}) {
  const router = useRouter();
  const ids = colleges.map((c) => c.id);

  const push = (next: Partial<{ ids: number[]; branch: number | null; seat: string; metric: string }>) => {
    const p = new URLSearchParams();
    const nextIds = next.ids ?? ids;
    if (nextIds.length) p.set("ids", nextIds.join(","));
    const b = next.branch !== undefined ? next.branch : selectedBranchId;
    if (b) p.set("branch", String(b));
    p.set("seat", next.seat ?? seat);
    p.set("metric", next.metric ?? metric);
    router.push(`/compare?${p.toString()}`);
  };

  const add = (id: number) => ids.length < 4 && !ids.includes(id) && push({ ids: [...ids, id] });
  const remove = (id: number) => push({ ids: ids.filter((x) => x !== id) });

  if (colleges.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed p-10 text-center">
        <p className="mb-4 text-muted-foreground">
          Add colleges to start comparing.
        </p>
        <div className="mx-auto max-w-md">
          <Picker allColleges={allColleges} selected={ids} onAdd={add} />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-8">
      {/* selected chips + picker */}
      <div className="flex flex-wrap items-center gap-2">
        {colleges.map((c) => (
          <Badge key={c.id} variant="secondary" className="gap-1.5 py-1 pr-1">
            {c.name.slice(0, 28)}
            <button onClick={() => remove(c.id)} className="rounded-full p-0.5 hover:bg-background">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {colleges.length < 4 && (
          <div className="w-64">
            <Picker allColleges={allColleges} selected={ids} onAdd={add} />
          </div>
        )}
      </div>

      <CollegeTable colleges={colleges} />

      {/* Branch-level comparison */}
      <section className="rounded-2xl border p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Compare a branch</h2>
          <Select
            value={selectedBranchId ? String(selectedBranchId) : ""}
            onValueChange={(v) => push({ branch: v ? Number(v) : null })}
          >
            <SelectTrigger className="h-9 w-72">
              <SelectValue placeholder="Pick a branch to compare cutoffs" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {commonBranches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name} ({b.colleges})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedBranchId && (
            <>
              <button
                onClick={() => push({ metric: metric === "percentile" ? "rank" : "percentile" })}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {metric === "rank" ? "Merit rank" : "Percentile"}
              </button>
              <Select value={seat} onValueChange={(v) => push({ seat: v ?? "SL" })}>
                <SelectTrigger className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["HU", "OHU", "SL", "AI"] as SeatType[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SEAT_TYPE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        {!selectedBranchId ? (
          <p className="text-sm text-muted-foreground">
            Choose a branch offered by these colleges to compare its cutoffs by
            category.
          </p>
        ) : (
          <BranchTable colleges={colleges} branch={branch} seat={seat} metric={metric} />
        )}
      </section>
    </div>
  );
}

// ---- college-level parameter table ----------------------------------------

function CollegeTable({ colleges }: { colleges: CompareCollege[] }) {
  const fmtL = (n: number | null) => (n == null ? "—" : `₹${n.toFixed(1)}L`);
  const rows: {
    label: string;
    get: (c: CompareCollege) => React.ReactNode;
    num?: (c: CompareCollege) => number | null;
    better?: "hi" | "lo";
  }[] = [
    {
      label: "NIRF (Engg, 2025)",
      get: (c) => c.latestNirf ? (c.latestNirf.rank ?? c.latestNirf.band) : "—",
      num: (c) => c.latestNirf ? (c.latestNirf.rank ?? 250) : null,
      better: "lo",
    },
    { label: "NAAC grade", get: (c) => c.naacGrade ?? "—" },
    { label: "Type", get: (c) => c.type?.replace(/_/g, " ") ?? "—" },
    { label: "Total seats", get: (c) => c.totalSeats.toLocaleString(), num: (c) => c.totalSeats, better: "hi" },
    { label: "Branches", get: (c) => c.branchCount, num: (c) => c.branchCount, better: "hi" },
    {
      label: "Top cutoff (2025 %ile)",
      get: (c) => (c.topCutoff != null ? c.topCutoff.toFixed(2) : "—"),
      num: (c) => c.topCutoff,
      better: "hi",
    },
    { label: "Fees / yr (indicative)", get: (c) => (c.type ? FEE_BAND[c.type] ?? "—" : "—") },
    {
      label: "Median package",
      get: (c) => fmtL(c.placement?.median ?? null),
      num: (c) => c.placement?.median ?? null,
      better: "hi",
    },
    {
      label: "Highest package",
      get: (c) => fmtL(c.placement?.highest ?? null),
      num: (c) => c.placement?.highest ?? null,
      better: "hi",
    },
    {
      label: "Placement rate",
      get: (c) => (c.placement?.rate != null ? `${c.placement.rate}%` : "—"),
      num: (c) => c.placement?.rate ?? null,
      better: "hi",
    },
    { label: "Campus (acres)", get: (c) => c.campusAcres ?? "—", num: (c) => c.campusAcres, better: "hi" },
    { label: "Location", get: (c) => [c.city, c.university].filter(Boolean).join(" · ") || "—" },
    { label: "AICTE", get: (c) => (c.aicteApproved ? "✓ Approved" : "—") },
    {
      label: "Cutoff PDFs",
      get: (c) =>
        c.cutoffDocs.length ? (
          <div className="flex flex-col gap-1">
            {c.cutoffDocs.map((d, i) => (
              <a
                key={i}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                title={d.title}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                {d.docType === "institutional" ? "SPOT" : "CAP"}
                {d.year ? ` ${d.year}` : ""} ↗
              </a>
            ))}
          </div>
        ) : (
          "—"
        ),
    },
  ];

  const bestId = (r: (typeof rows)[number]) => {
    if (!r.num || !r.better) return null;
    let best: { id: number; v: number } | null = null;
    for (const c of colleges) {
      const v = r.num(c);
      if (v == null) continue;
      if (!best || (r.better === "hi" ? v > best.v : v < best.v)) best = { id: c.id, v };
    }
    return best?.id ?? null;
  };

  return (
    <div className="overflow-x-auto rounded-2xl border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="sticky left-0 z-10 min-w-[160px] bg-muted/50 px-4 py-3 text-left font-medium">
              Parameter
            </th>
            {colleges.map((c) => (
              <th key={c.id} className="min-w-[180px] px-4 py-3 text-left align-top font-medium">
                <Link href={`/colleges/${c.slug}`} className="hover:text-primary">
                  {c.name}
                </Link>
                <div className="text-xs font-normal text-muted-foreground">{c.city}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const winner = bestId(r);
            return (
              <tr key={r.label} className="border-t">
                <th className="sticky left-0 z-10 bg-background px-4 py-2.5 text-left font-medium text-muted-foreground">
                  {r.label}
                </th>
                {colleges.map((c) => (
                  <td
                    key={c.id}
                    className={`px-4 py-2.5 tabular-nums ${
                      winner === c.id ? "font-semibold text-primary" : ""
                    }`}
                  >
                    {r.get(c)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- branch-level cutoff table --------------------------------------------

function BranchTable({
  colleges,
  branch,
  seat,
  metric,
}: {
  colleges: CompareCollege[];
  branch: BranchData | null;
  seat: string;
  metric: "percentile" | "rank";
}) {
  const cells = branch?.cells.filter((c) => c.seatType === seat) ?? [];
  const cats = useMemo(() => {
    const present = [...new Set(cells.map((c) => c.categoryCode))];
    return present.sort((a, b) => {
      const ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });
  }, [cells]);
  const lookup = new Map<string, number | null>();
  for (const c of cells)
    lookup.set(`${c.categoryCode}|${c.collegeId}`, metric === "percentile" ? c.closingPercentile : c.closingMeritNo);
  const fmt = (v: number | null) =>
    v == null ? "—" : metric === "percentile" ? v.toFixed(2) : v.toLocaleString();

  if (cells.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No {SEAT_TYPE_LABELS[seat as SeatType]} cutoffs for this branch across the
        selected colleges{branch?.year ? ` (${branch.year})` : ""}. Try another
        seat type.
      </p>
    );

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium">
              Seats →
            </th>
            {colleges.map((c) => (
              <th key={c.id} className="min-w-[120px] px-3 py-2 text-center text-xs font-medium">
                {c.name.slice(0, 22)}
                <div className="font-normal text-muted-foreground">
                  {branch?.seats[c.id] ?? "—"} seats
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cats.map((cat) => (
            <tr key={cat} className="border-t">
              <th className="sticky left-0 z-10 bg-background px-3 py-1.5 text-left font-medium">
                {cat}
              </th>
              {colleges.map((c) => (
                <td key={c.id} className="px-3 py-1.5 text-center tabular-nums">
                  {fmt(lookup.get(`${cat}|${c.id}`) ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- college picker (typeahead) -------------------------------------------

function Picker({
  allColleges,
  selected,
  onAdd,
}: {
  allColleges: Lite[];
  selected: number[];
  onAdd: (id: number) => void;
}) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return allColleges
      .filter(
        (c) =>
          !selected.includes(c.id) &&
          (c.name.toLowerCase().includes(query) ||
            (c.city ?? "").toLowerCase().includes(query))
      )
      .slice(0, 8);
  }, [q, allColleges, selected]);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Add a college…"
        className="h-9 pl-8"
      />
      {matches.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => {
                  onAdd(c.id);
                  setQ("");
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">
                  {c.name}
                  {c.city ? <span className="text-muted-foreground"> · {c.city}</span> : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
