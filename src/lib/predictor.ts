import type { SeatType } from "./reference";
import { projectSeries, type TrendDirection } from "./trend";

/**
 * Rules-based MHT-CET college predictor.
 *
 * MHT-CET is percentile-based: a HIGHER percentile is better, and a course's
 * "closing percentile" is the LOWEST percentile that received an allotment.
 * So a student clears a course if their percentile >= that closing percentile.
 *
 * The Maharashtra-specific subtlety (the core differentiator):
 *  - A candidate competes for HOME UNIVERSITY (HU) seats only at colleges whose
 *    home university matches theirs.
 *  - At every other college they compete for OTHER-THAN-HOME-UNIVERSITY (OHU).
 *  - STATE LEVEL (SL) seats are open to everyone, everywhere.
 * We therefore evaluate a student against only the seat types actually available
 * to them, and report the best (easiest to clear) among those.
 */

export type Chance = "safe" | "moderate" | "reach";

export interface PredictorInput {
  percentile: number; // 0..100
  categoryCode: string; // e.g. "GOPEN"
  homeUniversityId: number | null;
}

/** One published closing cutoff row (already filtered to a single year). */
export interface CutoffRow {
  collegeBranchId: number;
  collegeId: number;
  collegeHomeUniversityId: number | null;
  seatType: SeatType;
  categoryCode: string;
  closingPercentile: number | null;
}

export interface PredictionResult {
  collegeBranchId: number;
  collegeId: number;
  chance: Chance;
  /** The seat type that gives the student their best shot. */
  viaSeatType: SeatType;
  closingPercentile: number;
  /** Student percentile minus closing (positive = above last year's cutoff). */
  margin: number;
  /**
   * Relative headroom = margin / (100 - closing). Percentiles compress near the
   * top (0.4 above a 99.5 cutoff is a big rank gap; above an 85 cutoff it isn't),
   * so we judge safety on the fraction of remaining room covered, not raw margin.
   */
  headroom: number;
  /** Estimated admission probability, 1–99 (logistic on headroom). */
  probability: number;
  /** Present when the prediction is trend-projected (predictWithTrend). */
  trend?: {
    direction: TrendDirection;
    /** Most recent actual closing (e.g. 2025). */
    latest: number;
    /** Projected closing for the target year (chance is computed on this). */
    projected: number;
    years: number;
  };
}

/** One offering's closing cutoff for a single (seatType, category, year). */
export interface CutoffHistoryRow {
  collegeBranchId: number;
  collegeId: number;
  collegeHomeUniversityId: number | null;
  seatType: SeatType;
  categoryCode: string;
  year: number;
  closingPercentile: number | null;
}

/**
 * Map headroom to an admission probability with a logistic curve calibrated so
 * headroom 0 ≈ 50%, +0.35 (safe threshold) ≈ 85%, −0.5 (reach floor) ≈ 8%.
 * A single-year estimate — labeled as such in the UI.
 */
export function admissionProbability(headroom: number): number {
  const p = 100 / (1 + Math.exp(-5 * headroom));
  return Math.min(99, Math.max(1, Math.round(p)));
}

export interface PredictorConfig {
  /** Headroom ratio at/above which a course is "safe". */
  safeHeadroom: number;
  /** Headroom ratio floor below which a course becomes a "reach". */
  reachHeadroom: number;
}

export const DEFAULT_CONFIG: PredictorConfig = {
  safeHeadroom: 0.35,
  reachHeadroom: -0.5,
};

/** margin / room-to-100, guarding against a closing pinned at 100. */
export function headroomRatio(percentile: number, closing: number): number {
  const gap = Math.max(100 - closing, 0.01);
  return (percentile - closing) / gap;
}

/**
 * Which seat types is this student eligible to be considered against at a given
 * college? SL (and AI) are universal; HU vs OHU depends on university match.
 */
export function eligibleSeatTypes(
  studentHomeUniversityId: number | null,
  collegeHomeUniversityId: number | null
): SeatType[] {
  const isHome =
    studentHomeUniversityId != null &&
    collegeHomeUniversityId != null &&
    studentHomeUniversityId === collegeHomeUniversityId;
  // Outside candidates also compete for Home-University seats that spill over to
  // other-than-home candidates (HU_OHU), in addition to OHU and State Level.
  return isHome ? ["HU", "SL", "AI"] : ["OHU", "HU_OHU", "SL", "AI"];
}

function classify(headroom: number, cfg: PredictorConfig): Chance {
  if (headroom >= cfg.safeHeadroom) return "safe";
  if (headroom >= cfg.reachHeadroom) return "moderate";
  return "reach";
}

/**
 * Predict chances for one college-branch offering given all its cutoff rows for
 * the chosen year. Returns null if no relevant (category + eligible seat type)
 * cutoff exists. Picks the seat type where the student's margin is largest.
 */
export function predictOffering(
  input: PredictorInput,
  rows: CutoffRow[],
  cfg: PredictorConfig = DEFAULT_CONFIG
): PredictionResult | null {
  if (rows.length === 0) return null;
  const { collegeBranchId, collegeId, collegeHomeUniversityId } = rows[0];
  const eligible = new Set(
    eligibleSeatTypes(input.homeUniversityId, collegeHomeUniversityId)
  );

  let best: PredictionResult | null = null;
  for (const row of rows) {
    if (row.categoryCode !== input.categoryCode) continue;
    if (!eligible.has(row.seatType)) continue;
    if (row.closingPercentile == null) continue;

    const closing = row.closingPercentile;
    const headroom = headroomRatio(input.percentile, closing);
    // Best route = the eligible seat type with the most headroom.
    if (best == null || headroom > best.headroom) {
      best = {
        collegeBranchId,
        collegeId,
        chance: classify(headroom, cfg),
        viaSeatType: row.seatType,
        closingPercentile: closing,
        margin: input.percentile - closing,
        headroom,
        probability: admissionProbability(headroom),
      };
    }
  }
  return best;
}

/**
 * Predict across many offerings. `rowsByOffering` groups cutoff rows per
 * collegeBranchId. Results are sorted best-first (safe, then by margin).
 */
export function predict(
  input: PredictorInput,
  rowsByOffering: Map<number, CutoffRow[]>,
  cfg: PredictorConfig = DEFAULT_CONFIG
): PredictionResult[] {
  const out: PredictionResult[] = [];
  for (const rows of rowsByOffering.values()) {
    const r = predictOffering(input, rows, cfg);
    if (r) out.push(r);
  }
  // Within a tier, show the MOST competitive college first (highest closing
  // percentile) — the best option the student can still get — not the one with
  // the biggest margin, which would surface undersubscribed low-cutoff colleges.
  const order: Record<Chance, number> = { safe: 0, moderate: 1, reach: 2 };
  return out.sort(
    (a, b) =>
      order[a.chance] - order[b.chance] ||
      b.closingPercentile - a.closingPercentile
  );
}

/**
 * Prediction for one offering using its multi-year history. The chance +
 * probability are judged against the LATEST actual closing — our backtest
 * (src/db/backtest.ts) showed last-year is a better estimator than linear
 * extrapolation (cutoffs are a noisy near-random-walk). The multi-year fit is
 * still used to attach a `trend` DIRECTION (getting harder / easier) as context,
 * which never moves the prediction. `targetYear` labels the trend arrow.
 */
export function predictOfferingWithTrend(
  input: PredictorInput,
  history: CutoffHistoryRow[],
  targetYear: number,
  cfg: PredictorConfig = DEFAULT_CONFIG
): PredictionResult | null {
  if (history.length === 0) return null;
  const { collegeBranchId, collegeId, collegeHomeUniversityId } = history[0];
  const eligible = new Set(
    eligibleSeatTypes(input.homeUniversityId, collegeHomeUniversityId)
  );

  // group this category's rows by seat type
  const bySeat = new Map<SeatType, { year: number; value: number | null }[]>();
  for (const r of history) {
    if (r.categoryCode !== input.categoryCode) continue;
    if (!eligible.has(r.seatType)) continue;
    const list = bySeat.get(r.seatType) ?? [];
    list.push({ year: r.year, value: r.closingPercentile });
    bySeat.set(r.seatType, list);
  }

  let best: PredictionResult | null = null;
  for (const [seatType, points] of bySeat) {
    const proj = projectSeries(points, targetYear);
    if (!proj) continue;
    // Predict on the latest actual (backtest-validated), not the projection.
    const closing = proj.latest;
    const headroom = headroomRatio(input.percentile, closing);
    if (best == null || headroom > best.headroom) {
      best = {
        collegeBranchId,
        collegeId,
        chance: classify(headroom, cfg),
        viaSeatType: seatType,
        closingPercentile: closing,
        margin: input.percentile - closing,
        headroom,
        probability: admissionProbability(headroom),
        trend: {
          direction: proj.direction,
          latest: proj.latest,
          projected: proj.projected,
          years: proj.years,
        },
      };
    }
  }
  return best;
}

/** Predict across offerings using history (latest-actual cutoff + trend signal). */
export function predictWithTrend(
  input: PredictorInput,
  historyByOffering: Map<number, CutoffHistoryRow[]>,
  targetYear: number,
  cfg: PredictorConfig = DEFAULT_CONFIG
): PredictionResult[] {
  const out: PredictionResult[] = [];
  for (const rows of historyByOffering.values()) {
    const r = predictOfferingWithTrend(input, rows, targetYear, cfg);
    if (r) out.push(r);
  }
  const order: Record<Chance, number> = { safe: 0, moderate: 1, reach: 2 };
  return out.sort(
    (a, b) =>
      order[a.chance] - order[b.chance] ||
      b.closingPercentile - a.closingPercentile
  );
}
