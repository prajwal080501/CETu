/**
 * Cutoff trend projection. Given a college·branch·category·seat-type's closing
 * percentile across years, fit a linear trend and project the next year — so the
 * predictor looks forward instead of assuming last year repeats. Volatility (the
 * fit's residual spread) tells us how much to trust the projection.
 */

export type TrendDirection = "rising" | "falling" | "stable";

export interface Projection {
  projected: number; // value at targetYear, clamped to [0,100]
  latest: number; // most recent actual value
  latestYear: number;
  slope: number; // per-year change (percentile points)
  direction: TrendDirection;
  volatility: number; // RMSE of residuals (0 for <3 points)
  years: number; // number of data points used
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// A cutoff that moves < this many percentile points/year is "stable".
const STABLE_SLOPE = 0.05;

export function projectSeries(
  points: { year: number; value: number | null }[],
  targetYear: number
): Projection | null {
  const pts = points
    .filter((p): p is { year: number; value: number } => p.value != null)
    .sort((a, b) => a.year - b.year);
  if (pts.length === 0) return null;

  const latest = pts[pts.length - 1].value;
  const latestYear = pts[pts.length - 1].year;
  if (pts.length === 1) {
    return {
      projected: latest,
      latest,
      latestYear,
      slope: 0,
      direction: "stable",
      volatility: 0,
      years: 1,
    };
  }

  // Least-squares linear fit (x = year, y = value).
  const n = pts.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of pts) {
    sx += p.year;
    sy += p.value;
    sxx += p.year * p.year;
    sxy += p.year * p.value;
  }
  const denom = n * sxx - sx * sx;
  const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;

  let projected = clamp(slope * targetYear + intercept, 0, 100);
  // Guard against wild extrapolation: never project further from the latest
  // actual than the observed spread of the series.
  const spread = Math.max(...pts.map((p) => p.value)) - Math.min(...pts.map((p) => p.value));
  projected = clamp(projected, latest - spread, latest + spread);

  let sse = 0;
  for (const p of pts) {
    const fit = slope * p.year + intercept;
    sse += (p.value - fit) ** 2;
  }
  const volatility = Math.sqrt(sse / n);

  const direction: TrendDirection =
    Math.abs(slope) < STABLE_SLOPE ? "stable" : slope > 0 ? "rising" : "falling";

  return { projected, latest, latestYear, slope, direction, volatility, years: n };
}

/**
 * Backtest helper: fit on all points strictly before holdoutYear, project the
 * holdout year, and return the absolute error vs the actual holdout value.
 * Returns null if there aren't enough points before the holdout or no actual.
 */
export function backtestPoint(
  points: { year: number; value: number | null }[],
  holdoutYear: number
): number | null {
  const actual = points.find((p) => p.year === holdoutYear)?.value;
  if (actual == null) return null;
  const train = points.filter((p) => p.year < holdoutYear);
  if (train.filter((p) => p.value != null).length < 2) return null;
  const proj = projectSeries(train, holdoutYear);
  if (!proj) return null;
  return Math.abs(proj.projected - actual);
}
