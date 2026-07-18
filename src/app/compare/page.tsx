import {
  getCompareColleges,
  getCommonBranches,
  getCompareBranch,
  getCollegesLite,
} from "@/lib/compare";
import { CompareBoard } from "@/components/compare/CompareBoard";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Compare Engineering Colleges",
  description:
    "Compare Maharashtra engineering colleges side by side — NIRF, NAAC, seats, fees, placements, and branch-wise MHT-CET cutoffs (percentile & closing rank).",
};

function parseIds(s?: string): number[] {
  if (!s) return [];
  return [
    ...new Set(
      s
        .split(",")
        .map((x) => parseInt(x, 10))
        .filter((n) => Number.isFinite(n))
    ),
  ].slice(0, 4);
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{
    ids?: string;
    branch?: string;
    seat?: string;
    metric?: string;
  }>;
}) {
  const sp = await searchParams;
  const ids = parseIds(sp.ids);
  const branchId = sp.branch ? parseInt(sp.branch, 10) : null;

  const [collegesData, allColleges, commonBranches] = await Promise.all([
    getCompareColleges(ids),
    getCollegesLite(),
    getCommonBranches(ids),
  ]);
  const branch =
    branchId && ids.length
      ? await getCompareBranch(ids, branchId)
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Compare colleges
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Put up to 4 colleges head-to-head — rankings, seats, fees, placements,
        and branch-wise cutoffs. Shareable via the URL.
      </p>

      <CompareBoard
        colleges={collegesData}
        allColleges={allColleges}
        commonBranches={commonBranches}
        selectedBranchId={branchId}
        branch={
          branch
            ? {
                year: branch.year,
                cells: branch.cells,
                seats: Object.fromEntries(branch.seats),
              }
            : null
        }
        seat={sp.seat ?? "SL"}
        metric={sp.metric === "rank" ? "rank" : "percentile"}
      />
    </div>
  );
}
