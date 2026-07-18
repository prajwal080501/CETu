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
  title: "MHT-CET College Predictor",
  description:
    "Enter your MHT-CET percentile, category and home university to see which Maharashtra engineering colleges you can realistically get — by seat type.",
};

// Latest year with verified closing cutoffs; we project to the next year.
const PREDICT_YEAR = 2025;
const TARGET_YEAR = 2026;

export default async function PredictorPage({
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

  // Flatten to a serializable shape the client component can render + persist.
  const flat: FlatResult[] = results.flatMap((r) => {
    const info = offeringInfo.get(r.collegeBranchId);
    if (!info) return [];
    // Location filter: keep only colleges in the chosen city.
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
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        College Predictor
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your percentile to see colleges by chance, with an estimated
        admission probability. Predictions use {PREDICT_YEAR} closing cutoffs
        (backtested as the most accurate basis), and each shows whether the
        college&rsquo;s cutoff has been <strong>trending harder or easier</strong>{" "}
        over {PREDICT_YEAR - 4}–{PREDICT_YEAR}.
      </p>

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
            // When Clerk is on, hand the client its DB-backed list + save action;
            // otherwise it falls back to localStorage.
            initialList={clerkEnabled ? await loadPreferenceList() : undefined}
            onPersist={clerkEnabled ? savePreferenceList : undefined}
          />
        ))}
    </div>
  );
}
