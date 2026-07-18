# CETwiki — Product & Prediction Roadmap

Where we are, and the path to a robust product. Grouped by theme; each item notes
value and rough effort. Items marked ✅ are shipped.

## Prediction engine

The current predictor is a rules engine over the latest year's closing cutoffs,
with a calibrated **admission-probability %** (logistic on headroom) ✅ and
explicit HU/OHU/SL seat-type routing ✅. Next:

- ✅ **Trend signal (not projection).** We built + backtested linear projection
  (`src/lib/trend.ts`, `src/db/backtest.ts`): a damping sweep on held-out 2025
  showed last-year (k=0, MAE 9.6) beats every trend blend (full trend MAE 14.6) —
  cutoffs are a noisy near-random-walk, so extrapolation hurts. Decision:
  **predict on the latest actual cutoff, show the 5-yr trend as a directional
  signal only** (getting harder/easier). Backtesting stopped us shipping a worse
  model. *(Done.)*
- **Backtested probability calibration.** The overall MAE (~9.6) is inflated by
  volatile reserved-category seats; calibrate per category-tier and re-fit the
  logistic probability curve to real hit-rates. Needs allotment data (student
  percentile → seat) which we deliberately don't store (PII) — so this needs an
  aggregate, non-PII allotment feed. *(Med value, med effort.)*
- **Seat-count awareness.** A branch with 180 seats is safer at the same cutoff
  than one with 30. Fold `total_intake` into the probability. *(Med/med.)*
- **Round-wise prediction.** Predict which CAP round a choice is likely to close
  in (I/II/III), using round-wise cutoff movement. *(Med/high.)*
- **Rank ↔ percentile ↔ marks** converter, per year and category. *(Med/low.)*
- **"What should I change" suggestions.** If a target is a Reach, show the
  percentile or category-eligibility gap, and the nearest Safe alternative in the
  same branch family / city. *(High/med.)*

## Preference-list intelligence

Builds on the existing CAP preference-list builder ✅.

- **Auto-optimize the option form.** Given the shortlist, order it to maximize
  expected outcome (aspirational → safe), flag wasted/duplicate choices, and
  guarantee a safety floor. *(Flagship paid feature, med effort.)*
- **Balanced-mix generator.** One click → a ready list of N choices spanning
  reach/moderate/safe across chosen branches & cities. *(High/med.)*
- **Export to official choice-code format** for the CAP portal. *(Med/low.)*

## Data depth & freshness

- **Complete the seat + college master.** 245 offerings still lack seats and 37
  colleges lack a home university (institutes absent from 2025 CAP-I). Backfill
  from earlier rounds/years and the DTE institute directory. *(High/med.)*
- **All CAP rounds** (not just the final) → round-wise cutoffs & vacancy trends.
- **NAAC grades + more approvals** from the NAAC public accredited-institutions
  list (currently AICTE-only). *(Med/med.)*
- **Placements, fees, alumni** via a moderated **contribute** flow (auth-gated) —
  the honest source for data not in CAP PDFs. Verification badges. *(High/high.)*
- **Live CAP-season updates** — auto-ingest each round within hours of release.

## Product features

- **Compare colleges/branches** side-by-side (cutoffs, seats, fees, placements).
- **AI counselor** — RAG over the verified cutoff DB + official CAP rulebook,
  grounded with citations (uses a current Claude model). Answers eligibility,
  document, and strategy questions without hallucinating.
- **Alerts** — CAP calendar + email/WhatsApp/push for registration, document
  verification, seat allotment, freeze/float/slide deadlines.
- **Senior connect / Q&A** — verified students per college, structured Q&A.
- **Document & eligibility checklist** — domicile, caste validity, EWS/non-creamy,
  TFWS income, PWD — personalized by category.
- **Saved searches & shortlists** across devices (auth ✅ scaffolded).
- **Marathi UI** and **PWA/offline** — underserved, mobile-first audience.

## Trust, moderation, ops

- **Verification admin write-actions** — promote parsed rows, fix the 37 colleges,
  moderate contributions (read-only dashboard exists ✅).
- **Provenance everywhere** — each datapoint links to its source PDF + ingest date.
- **Automated data-quality tests** in CI (golden-file parser tests, coverage
  thresholds, anomaly flags).

## Monetization (freemium)

- Free: search, college pages, basic cutoffs & predictor.
- Paid (seasonal): full trends, unlimited predictor, preference-list optimizer,
  compare, alerts, AI counselor, priority senior connect.

## Near-term sequence (suggested)

1. Trend-adjusted projection + backtested calibration (makes predictions credibly
   "advanced").
2. Preference-list optimizer (flagship paid feature).
3. Compare colleges.
4. Complete seat/college master + NAAC.
5. Contribute flow (placements/alumni) + moderation.
