# CETwiki — Further Scope Plan

Living plan for the **"Know Your Branch"** feature and the branch job-market
heatmap. Complements `ROADMAP.md` (product-wide). Written 2026-07.

---

## Where we are now (shipped)

- **`/branches`** index (grouped by branch family) + **`/branches/[slug]`** detail.
- **Interactive Maharashtra insight map** (`BranchInsightHeatmap.tsx`): one view
  showing **salary + open jobs + admission demand** per MH city, with a metric
  toggle that re-ranks + re-shades cells (FLIP animation), hover lift, staggered
  entrance, and an animated salary-distribution histogram.
- **Real data, two layers:**
  - *Admission demand / seats* — our own 5-yr CAP data (`lib/branch.ts`).
  - *Salary / jobs* — **Adzuna** live API (`lib/adzuna.ts`), cached 7 days in the
    `job_market` table, graceful-degraded on `ADZUNA_APP_ID/KEY`.
- Branch→role crosswalk (`lib/branch-roles.ts`), family → Adzuna category + role.
- **AI insights** (Gemini) already exist for colleges — not yet on branches.

### Known limitations to design around
- Adzuna India **geodata has no median salary** → we pull per-city salary via N
  `search` calls (sequential, rate-limited, capped to 6 cities). Cold fetch ~7s.
- Free tier trips 429 on bursts → **no client-triggered live refresh**; refresh is
  server-side + cached. A scheduled warm is the right long-term fix.
- Salary is **role-proxied by family**, not exact branch → clearly labelled
  "indicative market data, not college placements". Thane showed a ₹4L outlier —
  small-sample noise is real; consider a min-sample threshold.

---

## Near-term polish (1–2 sessions)

1. **AI branch outlook (Gemini).** Reuse the college insights pipeline: feed the
   merged demand+salary+jobs facts into `generateInsights`, add a branch-scoped
   prompt ("is this branch worth it, for whom, trade-offs"). Cache in a
   `branch_insights` table (or generalize `ai_insights` with a scope column).
2. **ROI lens.** Add a 4th metric: **salary ÷ indicative annual fee** by college
   type — the single most decision-useful number a student wants. All inputs
   already in DB (`FEE_BAND` + Adzuna salary).
3. **Min-sample guard on salary.** Drop/annotate city salaries backed by < N
   postings (Adzuna `count`) so outliers don't mislead the heatmap shade.
4. **Empty/edge states.** Families with thin data (Textile, Bio & Food) — verify
   the map degrades gracefully; fall back to demand-only cleanly.
5. **Mobile pass.** The 4-col grid → 2-col; verify FLIP + hover work on touch
   (hover → tap-to-expand a detail sheet).

## Data expansion (grounded in researched sources)

| Add | Source | Notes |
|---|---|---|
| Branch **median salary (institute)** | NIRF via **data.gov.in** OGD API / dataful.in | Official; cross-check against Adzuna market salary |
| **Experience-band salary** (fresher→senior) | Adzuna `histogram` + `search` w/ seniority terms | Show a fresher-vs-experienced split |
| **Top recruiters / companies** per role | Adzuna `search` results → company facet | "Who hires <branch> grads in MH" |
| **India-wide toggle** | Adzuna `geodata` `location0=India` | Compare MH vs national salary/demand |
| **Salary trend over time** | Adzuna `history` endpoint | Animated multi-year line |
| **Enrollment/output by discipline** | **AISHE** (MoE) | Supply-side context per branch |
| Sector employment context | **PLFS** (MoSPI) | Macro backdrop, not branch-granular |

## Heatmap / dataviz enhancements

- **Choropleth map view** of Maharashtra (district polygons) as an alternate to
  the grid — needs an inline GeoJSON (keep self-contained; no external tiles).
- **Metric compare mode**: small-multiples (salary map + jobs map + demand map
  side by side) for power users.
- **Animated time scrubber**: play cutoff/salary evolution year-by-year.
- **Cross-branch comparison**: pick 2–3 branches → overlay their city salary/demand.
- Accessibility: table view of the heatmap, colourblind-safe ramp check
  (`dataviz` skill validator), keyboard nav of the metric toggle.

## Cross-feature integration

- **Predictor × branch outlook**: on a predictor result, surface the branch's
  job-market snapshot ("this branch pays ~₹X in your city, Y open roles").
- **Compare page**: add a branch-level job-market row so college comparison can
  weigh outcomes, not just cutoffs.
- **Preference-list optimizer** (roadmap): weight suggestions by demand + salary,
  not cutoff alone.

## Data ops / reliability

- **Scheduled Adzuna warm**: a cron/route that refreshes the top ~10 families
  weekly during off-peak, so no user ever eats the 7s cold fetch. Budget the
  free-tier calls (families × (~9 calls)) against the daily cap.
- **Admin visibility**: show `job_market` freshness + last-fetch status in
  `/admin`; a manual "refresh family" button (server-side, rate-limited).
- **Fallback source**: if Adzuna quota is exhausted, fall back to OpenWeb Ninja
  (Glassdoor) free tier for salary, clearly attributed.
- **More placement PDFs**: continue per-college curation (Walchand pattern) to
  strengthen the *placement* signal alongside the *market* signal.

## Technical debt / cleanup

- `HeatGrid.tsx` and `JobMarketPanel.tsx` are now superseded by
  `BranchInsightHeatmap` on the branch page — keep if reused elsewhere, else prune.
- Generalize `ai_insights` to a `scope` (college | branch) instead of a second table.
- Adzuna response typing is loose (`Record<string, unknown>`) — add zod-free
  narrow parsers with unit tests against captured fixtures.
- Consider a tiny in-repo fixture of Adzuna responses so the parser can be
  tested without keys/network.

## Explicitly out of scope (for now)

Real-time job feeds, per-student personalized salary prediction, scraping
aggregators (ToS/fragility), paid Adzuna Intelligence API, non-engineering
streams. Revisit once the engineering MVP loop (research → predict → decide) is
tight.
