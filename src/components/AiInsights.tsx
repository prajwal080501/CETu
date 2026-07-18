"use client";

import { useState, useTransition } from "react";
import { Sparkles, RefreshCw, TrendingUp, AlertTriangle, Target } from "lucide-react";
import { generateCollegeInsights } from "@/app/actions/insights";
import type { CollegeInsights } from "@/lib/ai";

export function AiInsights({
  collegeId,
  slug,
  initial,
}: {
  collegeId: number;
  slug: string;
  initial: CollegeInsights | null;
}) {
  const [insights, setInsights] = useState<CollegeInsights | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(force: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await generateCollegeInsights(collegeId, slug, force);
      if (res.ok) setInsights(res.insights);
      else setError(res.error);
    });
  }

  return (
    <section className="mt-12">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            AI insights
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Gemini · grounded on verified CETu data
            </span>
            {insights && (
              <button
                onClick={() => run(true)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
                Regenerate
              </button>
            )}
          </div>
        </div>

        {!insights && !pending && !error && (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              Generate a neutral, data-driven read of this college — strengths,
              trade-offs and who it&rsquo;s a fit for — reasoned strictly from its
              cutoffs, seats, NIRF and placement data.
            </p>
            <button
              onClick={() => run(false)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" />
              Generate insights
            </button>
          </div>
        )}

        {pending && !insights && (
          <div className="mt-4 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
            <p className="pt-1 text-xs text-muted-foreground">
              Analysing this college&rsquo;s data…
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}{" "}
            <button onClick={() => run(false)} className="font-medium underline">
              Try again
            </button>
          </div>
        )}

        {insights && (
          <div className={`mt-4 space-y-5 ${pending ? "opacity-50" : ""}`}>
            <p className="text-sm leading-relaxed">{insights.summary}</p>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-400">
                  <TrendingUp className="h-4 w-4" />
                  Strengths
                </h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {insights.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-green-600" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Consider
                </h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {insights.considerations.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {insights.bestFor && (
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] p-3 text-sm">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  <span className="font-medium">Best for: </span>
                  {insights.bestFor}
                </span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              AI-generated from verified data. Numbers are indicative — confirm on
              the official CAP portal and the college&rsquo;s disclosures.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
