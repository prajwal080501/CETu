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

## Further scope: phased product roadmap

This product can grow from a **cutoff + predictor utility** into a
**full-stack admission decision platform** for Maharashtra engineering aspirants.
The best expansion path is to deepen trust first, then add workflow tools, then
layer community and monetization on top.

### Phase 1: Become the default research destination (0-3 months)

Goal: make CETwiki the place students open first when shortlisting colleges.

- **Complete the college research graph.** Fill missing seats, fees, approvals,
  NAAC, placement reports, and official documents for every college page.
- **Better branch intelligence.** Show branch difficulty, seat movement,
  historical trend direction, and similar-branch alternatives.
- **High-trust compare mode.** Make compare genuinely decision-grade: cutoffs,
  seats, fees, placements, location, autonomy, approvals, alumni, and source
  links in one board.
- **Explainable prediction.** Each prediction should show *why* it is safe /
  moderate / reach: percentile gap, seat type, category, trend signal, and seat
  count.
- **Saved lists + decision workspace.** Let students save colleges, branches,
  and notes so the product becomes part of their actual admission workflow.

Why this matters:

- Stronger retention than one-off search.
- Better trust than content sites and random YouTube advice.
- Creates the cleanest base for later paid features.

### Phase 2: Own the CAP choice-filling workflow (3-6 months)

Goal: move from research tool to action tool during admission season.

- **Preference-list builder v2.** Drag/drop, duplicate detection, safety-gap
  warnings, branch-family balancing, and export in official choice-code format.
- **List optimizer.** Suggest the ideal ordering for a student's percentile,
  category, region, and preferences.
- **Scenario simulator.** "If I move Pune above Mumbai", "if I prioritize CSE
  over city", "if I only want autonomous colleges" — show the tradeoff.
- **Round strategy engine.** Recommend whether a choice is better attempted in
  Round I / II / III and how volatility changes by branch or category.
- **Deadline and document workflow.** Personalized checklist, reminders, and
  status tracking for CAP milestones.

Why this matters:

- This is the strongest wedge for monetization.
- Students pay more readily for outcome-improving workflow than for raw data.
- It creates seasonal urgency and clear conversion moments.

### Phase 3: Build the student trust network (6-12 months)

Goal: add the human layer competitors cannot scrape.

- **Verified student voices.** College-wise AMA, branch reviews, placement
  reality checks, hostel/campus/lab insights, and "would you choose this again?"
  responses.
- **Structured contribution system.** Alumni and students can submit placements,
  fees, internships, facilities, and campus proof with moderation + trust
  badges.
- **Senior connect.** Paid or gated access to verified seniors by college /
  branch.
- **Outcome stories.** Show example journeys: percentile, category, college
  chosen, later placement outcome.

Why this matters:

- Creates network effects and defensibility.
- Solves the "official data is not enough" gap.
- Makes the product useful even outside peak CAP dates.

### Phase 4: Expand from admissions to career outcomes (12-18 months)

Goal: help users choose not just a college, but an ROI path.

- **Branch-to-career mapping.** For each branch, show typical roles, employers,
  higher-study paths, and salary bands.
- **City and employer heatmaps.** Tie colleges to likely employer clusters and
  regional job ecosystems.
- **ROI scoring.** Combine fees, travel/living context, placement outcomes, and
  branch demand into a "value for money" signal.
- **Skill roadmap by branch.** "If you pick EXTC / Mechanical / IT, what should
  you learn in year 1?" content and AI guidance.
- **Internship and scholarship layer.** Surface scholarships, lateral entry,
  transfer opportunities, and branch-specific prep resources.

Why this matters:

- Broadens the product beyond a narrow CAP-season window.
- Increases organic search surface.
- Opens partnerships with training, scholarship, and career platforms.

### Phase 5: Platform expansion (18+ months)

Goal: turn CETwiki into the operating system for state-level college decisioning.

- **Other streams.** Pharmacy, MBA/MMS, MCA, architecture, diploma-to-degree, or
  other Maharashtra counseling workflows.
- **Other states / exams.** Reuse the ingestion + verification moat for COMEDK,
  KCET, AP EAMCET, TS EAMCET, REAP, etc.
- **Counselor dashboard.** B2B workflow for schools, tuition centers, and
  independent admission counselors.
- **Institution analytics.** Premium dashboards for colleges to benchmark their
  competitiveness, branch demand, and peer positioning.
- **API / embeddable widgets.** Cutoff search, prediction, and compare widgets
  for coaching sites or education publishers.

## Product moat to intentionally build

If we execute well, the moat is not "AI" and not just "more data". It is the
combination of:

- **Verified structured cutoff data pipeline** from messy government PDFs.
- **Decision workflow ownership** during CAP season.
- **Student-contributed ground truth** moderated onto official data.
- **Explainable prediction + optimization** instead of black-box advice.
- **Localized focus** for Maharashtra first, rather than generic India-wide
  edtech clutter.

## Suggested execution order now

If we want the highest leverage path from the current product state, build in
this order:

1. Complete data coverage and admin verification flow.
2. Ship robust compare + saved shortlist.
3. Upgrade the predictor into an explainable decision assistant.
4. Build preference-list optimizer and official export.
5. Add alerts, checklists, and CAP workflow tracking.
6. Launch verified contribution + senior connect.
7. Expand into ROI, careers, and adjacent exams.
