# Data Ingestion Pipeline (MHT-CET Engineering / CAP)

Turns official State CET Cell / DTE cutoff PDFs into verified rows in Postgres.
This is the product's moat and its hardest problem, so the pipeline is a
**five-stage flow with a human verification gate** — never publish unverified
government-PDF parses straight to production.

```
 ingest  ->  parse  ->  normalize  ->  VERIFY (human)  ->  publish
 (PDF)      (rows)      (canonical ids)  (admin review)    (verifiedAt set)
```

## Status

- **ingest** — `ingest.py`, working (real per-round URLs + provenance manifest).
- **parse** — `parse_cutoff.py`, **working and validated on the real 2024 CAP1
  PDF**: 31,561 cutoff rows across 2,007 choice codes, 0 unparsed blocks, 100%
  of categories normalized to known codes. Spot-checked against the PDF (e.g.
  GCoE Amravati CSE, GOPEN, State Level → merit 7872 / percentile 97.3911937).
- **normalize (crosswalk) / verify / publish** — designed below; next to build.

## The real PDF structure (verified, not assumed)

`pdftotext -layout` is enough — the layout output column-aligns the grid, so we
drive Poppler instead of a heavy table library. One repeating unit:

```
01002 - Government College of Engineering, Amravati        <- institute: 5-digit code + name
0100224210 - Computer Science and Engineering             <- choice code: 10-digit + branch
Status: Government Autonomous  Home University : ...        <- metadata (ignored)
  State Level                                               <- SEAT SECTION header
      Stage   GOPENS   GSCS   ...   EWS                     <- category header row (columns)
       I      7872     17571  ...   13851                   <- Stage row: state merit numbers
              (97.39)  (94.17) ...  (95.39)                 <- percentile row (parentheses)
```

Non-obvious facts the parser had to handle (each cost a bug against real data):

1. **Category tokens encode seat level in a suffix** — `GOPENS`=State, `GOPENH`
   =Home University, `GOPENO`=Other-Than-HU, `…AI`=All-India. Seat type is taken
   from the section header (authoritative); the suffix is stripped to recover the
   base category. Atomic codes (`EWS`, `TFWS`, `ORPHAN`, `MI`) are never stripped.
2. **Four seat-section variants**, not three — "Home University Seats Allotted to
   Home University Candidates", "…to Other Than Home University Candidates" (HU
   seats spilled outward), and the two Other-Than-HU variants. The suffix follows
   the *seat* kind, not the candidate.
3. **Values are laid out by COLUMN across multiple `Stage` rows (I, II, …)** with
   blanks where a category wasn't allotted that stage. Index-based zipping is
   wrong; the parser assigns each value to the header column nearest its character
   offset, so `LVJO` allotted only in Stage II lands in the right column.

## Stages in detail

1. **ingest** (`ingest.py`) — download per-round PDFs to `./archive/<year>/`,
   append provenance to `archive/manifest.jsonl` (url, sha256, bytes, timestamp).
   Maps 1:1 to `source_documents` rows. URLs live in a per-cycle `SOURCES`
   registry a human updates each year (the `fe<portalYear>` host and filename
   casing shift; a tiny registry beats scraping the portal menu).
2. **parse** (`parse_cutoff.py`) — `pdftotext -layout` → column-aligned rows,
   emitted as JSONL: institute code/name, choice code, branch, seat section,
   raw + base category, merit no, percentile. Blocks whose columns can't be
   matched are flagged (not silently dropped) for the verification gate.
3. **normalize** (to build) — map to canonical ids via a maintained crosswalk:
   - institute_code (5-digit) → `colleges.dte_code`
   - branch string → `branches` (fuzzy-match the ~30 canonical branch names;
     the file has spelling variants like "Electronics and Telecommunication Engg")
   - base_category → `categories.code` (expand the categories seed to the full
     ~40 real codes incl. L*/PWD*/DEF*/PWDR*/DEFR* variants)
   - seat_section → `seat_type` enum (add `HU_OHU`, or fold per the eligibility
     model in `src/lib/predictor.ts`)
   - choice_code drifts year to year → append-only crosswalk table, reviewed.
4. **verify** — parsed/normalized rows land in a staging table; a curator
   spot-checks against the source PDF in an internal admin UI, then promotes.
5. **publish** — promoted rows get `verified_at` + `source_document_id`. Only
   `verified_at IS NOT NULL` rows are read by the web app (`src/lib/queries.ts`).

## Why hybrid (not pure-scrape, not pure-manual)

Government PDFs drift in format and wrap long tokens; some rounds are scanned.
Full automation is brittle; pure manual can't cover ~350 institutes × many
branches × ~40 categories × 3 rounds. Automate extraction, keep a cheap human
gate on correctness. The parser is built to **flag** what it can't confidently
place rather than guess.

## Official sources

- State CET Cell — https://cetcell.mahacet.org (rules, brochure, notifications)
- DTE Maharashtra — https://dtemaharashtra.gov.in (seat matrix, institute list)
- CAP portal (per year) — `fe<portalYear>.mahacet.org`, e.g. 2024 data at
  `https://fe2025.mahacet.org/2024/2024ENGG_CAP1_CutOff.pdf`

## Legal

Republish public government data with source attribution and a clear
"not affiliated with DTE / State CET Cell" disclaimer. Prefer published static
PDFs; do not scrape behind logins. Predictor output is labeled an estimate.
Confirm with a lawyer before public launch (DPDP Act 2023).

## Run

```bash
# parser needs only Poppler's pdftotext (brew install poppler); ingest needs requests.
cd pipeline
python3 ingest.py --year 2024 --round 1
python3 parse_cutoff.py archive/2024/2024ENGG_CAP1_MHMI.pdf --year 2024 --round 1 \
        --out rows.jsonl --sample 3
# -> rows.jsonl (+ rows.jsonl.flags.json), then normalize -> verify -> publish
```
