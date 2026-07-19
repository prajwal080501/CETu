import { Suspense } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import {
  getPredictorMeta,
  loadCutoffHistory,
  getPredictorCities,
} from "@/lib/queries";
import { predictWithTrend } from "@/lib/predictor";
import type { SeatType } from "@/lib/reference";
import {
  PredictorResults,
  type FlatResult,
} from "@/components/PredictorResults";
import { PredictorForm } from "@/components/PredictorForm";
import { clerkEnabled } from "@/lib/auth";
import {
  loadPreferenceList,
  savePreferenceList,
} from "@/app/actions/preferences";

export const metadata = {
  title: "Make My List — MHT-CET Dream · Target · Safe College List",
  description:
    "Enter your MHT-CET percentile and build your personalised college list — Dream, Target and Safe options by seat type — then share it as a branded image or PDF.",
};

const PREDICT_YEAR = 2025;
const TARGET_YEAR = 2026;

/** Skeleton shown while the prediction (65k-row history + trend) is computed. */
function ResultsLoader() {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Building your list from {PREDICT_YEAR} CAP cutoffs…
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {[0, 1, 2].map((s) => (
            <div key={s}>
              <div className="mb-3 h-5 w-24 animate-pulse rounded bg-muted" />
              <div className="space-y-2">
                {[0, 1, 2].map((r) => (
                  <div key={r} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
                    <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="h-52 animate-pulse rounded-xl border border-border/50 bg-muted/40" />
      </div>
    </div>
  );
}

/** Heavy async part: awaits the cutoff history, predicts, and renders results. */
async function Results({
  percentile,
  categoryCode,
  universityId,
  loc,
  br,
}: {
  percentile: number;
  categoryCode: string;
  universityId: number;
  loc: string;
  br: string;
}) {
  const [{ offeringInfo }, history] = await Promise.all([
    getPredictorMeta(),
    loadCutoffHistory(),
  ]);

  const results = predictWithTrend(
    {
      percentile,
      categoryCode,
      homeUniversityId: Number.isNaN(universityId) ? null : universityId,
    },
    history,
    TARGET_YEAR
  );

  const locSet = new Set(loc ? loc.split(",").filter(Boolean) : []);
  const brSet = new Set(br ? br.split(",").filter(Boolean) : []);

  const flat: FlatResult[] = results.flatMap((r) => {
    const info = offeringInfo.get(r.collegeBranchId);
    if (!info) return [];
    if (locSet.size && !(info.city && locSet.has(info.city))) return [];
    if (brSet.size && !brSet.has(info.branchName)) return [];
    return [
      {
        collegeBranchId: r.collegeBranchId,
        collegeName: info.collegeName,
        collegeSlug: info.collegeSlug,
        branchName: info.branchName,
        city: info.city,
        chance: r.chance,
        viaSeatType: r.viaSeatType as SeatType,
        closingPercentile: r.closingPercentile,
        probability: r.probability,
        trend: r.trend,
      },
    ];
  });

  if (flat.length === 0) {
    return (
      <p className="mt-8 text-muted-foreground">
        No matching colleges for {categoryCode} ({PREDICT_YEAR})
        {loc || br ? " with those location/branch filters" : ""}. Try widening
        your filters, the Open category, or a different home university.
      </p>
    );
  }

  return (
    <PredictorResults
      results={flat}
      year={PREDICT_YEAR}
      percentile={percentile}
      category={categoryCode}
      initialList={clerkEnabled ? await loadPreferenceList() : undefined}
      onPersist={clerkEnabled ? savePreferenceList : undefined}
    />
  );
}

export default async function MakeMyListPage({
  searchParams,
}: {
  searchParams: Promise<{
    percentile?: string;
    category?: string;
    university?: string;
    loc?: string;
    br?: string;
  }>;
}) {
  const sp = await searchParams;
  const [{ categories, universities, offeringInfo }, cityRows] = await Promise.all([
    getPredictorMeta(),
    getPredictorCities(),
  ]);
  const cities = cityRows.map((c) => c.city as string);
  const branches = [
    ...new Set([...offeringInfo.values()].map((o) => o.branchName)),
  ].sort();

  const percentile = sp.percentile ? Number(sp.percentile) : NaN;
  const categoryCode = sp.category ?? "GOPEN";
  const universityId = sp.university ? Number(sp.university) : NaN;
  const loc = sp.loc ?? "";
  const br = sp.br ?? "";
  const hasInput = !Number.isNaN(percentile) && percentile > 0 && percentile <= 100;
  const key = `${percentile}|${categoryCode}|${universityId}|${loc}|${br}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Hero + tagline */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-background to-chart-2/5 p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Make My List
        </span>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          The{" "}
          <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
            bridge
          </span>{" "}
          between you and your{" "}
          <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
            dream college
          </span>
          .
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Enter your percentile and build your personalised list — sorted into{" "}
          <strong className="text-foreground">Safe</strong>,{" "}
          <strong className="text-foreground">Target</strong> and{" "}
          <strong className="text-foreground">Dream</strong> options from{" "}
          {PREDICT_YEAR} CAP cutoffs. Order it, then share it as a branded image
          or PDF.
        </p>
      </div>

      <div className="mt-6">
        <PredictorForm
          categories={categories.map((c) => ({ id: c.id, code: c.code, label: c.label }))}
          universities={universities}
          cities={cities}
          branches={branches}
          defaults={{
            percentile: sp.percentile,
            category: categoryCode,
            university: sp.university,
            loc,
            br,
          }}
        />
      </div>

      {hasInput && (
        <Suspense key={key} fallback={<ResultsLoader />}>
          <Results
            percentile={percentile}
            categoryCode={categoryCode}
            universityId={universityId}
            loc={loc}
            br={br}
          />
        </Suspense>
      )}
    </div>
  );
}
