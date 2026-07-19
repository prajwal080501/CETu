import { Sparkles } from "lucide-react";
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

// Latest year with verified closing cutoffs; we project to the next year.
const PREDICT_YEAR = 2025;
const TARGET_YEAR = 2026;

export default async function MakeMyListPage({
  searchParams,
}: {
  searchParams: Promise<{
    percentile?: string;
    category?: string;
    university?: string;
    city?: string;
  }>;
}) {
  const sp = await searchParams;
  const [{ categories, universities, offeringInfo }, cities] = await Promise.all([
    getPredictorMeta(),
    getPredictorCities(),
  ]);

  const percentile = sp.percentile ? Number(sp.percentile) : NaN;
  const categoryCode = sp.category ?? "GOPEN";
  const universityId = sp.university ? Number(sp.university) : NaN;
  const city = sp.city?.trim() || "";
  const hasInput =
    !Number.isNaN(percentile) && percentile > 0 && percentile <= 100;

  let results: ReturnType<typeof predictWithTrend> = [];
  if (hasInput) {
    const history = await loadCutoffHistory();
    results = predictWithTrend(
      {
        percentile,
        categoryCode,
        homeUniversityId: Number.isNaN(universityId) ? null : universityId,
      },
      history,
      TARGET_YEAR
    );
  }

  const flat: FlatResult[] = results.flatMap((r) => {
    const info = offeringInfo.get(r.collegeBranchId);
    if (!info) return [];
    if (city && (info.city ?? "").toLowerCase() !== city.toLowerCase()) return [];
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
          <strong className="text-foreground">Dream</strong>,{" "}
          <strong className="text-foreground">Target</strong> and{" "}
          <strong className="text-foreground">Safe</strong> options from{" "}
          {PREDICT_YEAR} CAP cutoffs. Order it, then share it as a branded image
          or PDF.
        </p>
      </div>

      <div className="mt-6">
        <PredictorForm
          categories={categories.map((c) => ({
            id: c.id,
            code: c.code,
            label: c.label,
          }))}
          universities={universities}
          cities={cities.map((c) => ({ city: c.city as string, n: c.n }))}
          defaults={{
            percentile: sp.percentile,
            category: categoryCode,
            university: sp.university,
            city,
          }}
        />
      </div>

      {hasInput &&
        (flat.length === 0 ? (
          <p className="mt-8 text-muted-foreground">
            No matching colleges for {categoryCode}
            {city ? ` in ${city}` : ""} ({PREDICT_YEAR}).{" "}
            {city
              ? "Try “Any location” or a different category."
              : "Try the Open category or a different university."}
          </p>
        ) : (
          <PredictorResults
            results={flat}
            year={PREDICT_YEAR}
            percentile={percentile}
            category={categoryCode}
            initialList={clerkEnabled ? await loadPreferenceList() : undefined}
            onPersist={clerkEnabled ? savePreferenceList : undefined}
          />
        ))}
    </div>
  );
}
