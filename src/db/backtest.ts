/**
 * Backtest the cutoff trend projection: for every (offering, category, seat type)
 * with enough history, fit on years BEFORE the holdout year, project the holdout,
 * and compare to the actual. Reports MAE and a "within N percentile" hit-rate —
 * an honest accuracy number for the forward-looking predictor.
 *
 * Also compares against a naive baseline (last-year-repeats) to show the trend
 * model actually helps.
 *
 * Run: DATABASE_URL=... tsx src/db/backtest.ts [holdoutYear=2025]
 */
import { loadCutoffHistory } from "@/lib/queries";
import { projectSeries } from "@/lib/trend";

async function main() {
  const holdout = Number(process.argv[2] ?? 2025);
  const history = await loadCutoffHistory();

  // Sweep a damping factor k: estimate = latest + k*(lineProjection - latest).
  // k=0 is the naive last-year baseline; k=1 is the full linear trend.
  const KS = [0, 0.1, 0.2, 0.3, 0.5, 0.75, 1];
  const errsByK = new Map<number, number[]>(KS.map((k) => [k, []]));

  for (const rows of history.values()) {
    const groups = new Map<string, { year: number; value: number | null }[]>();
    for (const r of rows) {
      const key = `${r.seatType}|${r.categoryCode}`;
      const list = groups.get(key) ?? [];
      list.push({ year: r.year, value: r.closingPercentile });
      groups.set(key, list);
    }
    for (const points of groups.values()) {
      const actual = points.find((p) => p.year === holdout)?.value;
      if (actual == null) continue;
      const train = points.filter((p) => p.year < holdout && p.value != null);
      if (train.length < 2) continue;
      const proj = projectSeries(train, holdout);
      if (!proj) continue;
      for (const k of KS) {
        const est = proj.latest + k * (proj.projected - proj.latest);
        errsByK.get(k)!.push(Math.abs(est - actual));
      }
    }
  }

  const mae = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
  const within = (xs: number[], t: number) =>
    (100 * xs.filter((x) => x <= t).length) / (xs.length || 1);

  const n = errsByK.get(0)!.length;
  console.log(`Backtest — holdout ${holdout}, ${n} series, damping sweep:`);
  let best = { k: 0, mae: Infinity };
  for (const k of KS) {
    const e = errsByK.get(k)!;
    const m = mae(e);
    if (m < best.mae) best = { k, mae: m };
    console.log(
      `  k=${k.toFixed(2)}  MAE ${m.toFixed(3)}  within ±1: ${within(e, 1).toFixed(1)}%  ±2: ${within(e, 2).toFixed(1)}%${k === 0 ? "  (naive)" : k === 1 ? "  (full trend)" : ""}`
    );
  }
  console.log(`\n  BEST damping k=${best.k} (MAE ${best.mae.toFixed(3)})`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
