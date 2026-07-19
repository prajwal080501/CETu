# Deploying CETu to Vercel

CETu is a Next.js 16 app. It deploys to Vercel, but a few parts are built for a
local machine and need attention first. Read **Known constraints** before you start.

---

## Known constraints (Vercel is serverless)

1. **Database** — dev uses Postgres in Docker (`localhost:5433`); Vercel can't
   reach it. Use a **hosted Postgres** (Neon recommended). See Step 1.
2. **Cutoff-PDF ingestion won't run on Vercel.** It shells out to Python +
   Poppler (`pipeline/parse_cutoff.py`, `pdftotext`), which don't exist on
   Vercel's runtime. The action degrades gracefully ("parser not available").
   **Run cutoff ingestion locally against the production DB** instead — it's a
   once-per-CAP-round task (Step 6). Everything else works on Vercel: search,
   predictor, branches + job-market, Gemini alumni/placement extraction, S3
   uploads, fees, NAAC, admin.
3. **Upload size ~4.5 MB.** Vercel caps a serverless request body at ~4.5 MB
   regardless of the app's 25 MB Next setting. Small PDFs/photos upload fine;
   larger files would need a direct-to-S3 presigned-upload flow (future work).
4. **Function timeouts.** Cold Adzuna fetches (~7 s) and Gemini extraction exceed
   the default limit. `maxDuration = 60` is already set on the branch, college,
   and admin pages (Hobby allows up to 60 s).

---

## Step 1 — Hosted Postgres (Neon)

1. Create a project at https://neon.tech and copy the **pooled** connection
   string (host contains `-pooler`, ends with `?sslmode=require`).
2. Migrate local data → Neon in one shot:
   ```bash
   docker exec cet-pg pg_dump -U postgres -d college_analyser \
     --no-owner --no-privileges > cet.sql
   psql "postgresql://…-pooler…/neondb?sslmode=require" < cet.sql
   ```
   (The dump includes schema + all data — no separate `drizzle-kit push` needed.)

The DB client (`src/db/index.ts`) uses `max: 10` and disables prepared statements
(`prepare: false`) in production, which the hosted transaction pooler requires.

**Use a session pooler / port 5432 connection string, not the transaction pooler
(port 6543).** On free-tier compute the transaction pooler cancelled the landing
aggregate queries (`57014 canceling statement due to statement timeout`). The
Supabase **session pooler** (`aws-1-<region>.pooler.supabase.com:5432`) or Neon's
pooled string runs them reliably. The landing/reference queries are also cached
for 1 h (`src/lib/landing.ts`) and the homepage degrades gracefully if any single
query still times out, so a slow DB can no longer crash the page.

---

## Step 2 — Put the project on GitHub

`.env*` is gitignored, so secrets stay local.

```bash
git init && git add -A && git commit -m "CETu"
# then create a repo and push, e.g.:
gh repo create cetu --private --source=. --push
```

---

## Step 3 — Import to Vercel

1. https://vercel.com → **New Project** → import the repo (Next.js auto-detected).
2. Add **Environment Variables** (Production) before the first deploy:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string |
| `GEMINI_API_KEY` | AI insights + alumni/placement PDF extraction |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | job-market heatmap + city employers |
| `AWS_REGION` (`us-east-1`), `AWS_S3_BUCKET` (`cet-wiki`), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | PDF/photo uploads |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | admin login — use a strong password + a fresh 64-char secret (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | optional — app runs fully without them |

3. Click **Deploy**.

> Any integration whose keys you omit degrades gracefully (Gemini/Adzuna/S3/Clerk
> features simply hide or show a "not configured" notice).

---

## Step 4 — Verify after deploy

- Home + search (try `pvg`, `coep`, `mmcoe`).
- A college page → logo, fees, NAAC, official-document PDF badges.
- A branch page → interactive heatmap; click a city → employer dialog (Adzuna).
- `/admin/login` → sign in → the NAAC/fees/alumni/upload tools appear.
- **S3 read:** if opening an uploaded document fails, add `s3:GetObject` to the
  IAM user (presigned reads need it; `s3:PutObject` covers writes).

---

## Step 5 — IAM / S3 checklist

The IAM user needs, on the `cet-wiki` bucket:
- `s3:PutObject` (uploads), `s3:GetObject` (presigned document/photo reads).

The bucket can stay **private** — the app serves objects via short-lived
presigned URLs.

---

## Step 6 — Load cutoffs (locally, against production)

Because the Python parser isn't available on Vercel, run ingestion from your
machine pointed at the production DB:

```bash
# parse a CAP cutoff PDF locally (needs python3 + poppler installed)
python3 pipeline/parse_cutoff.py <pdf> --year 2025 --round 3 --out rows.jsonl

# load into production (verified rows)
DATABASE_URL="<neon-url>" tsx src/db/load-cutoffs.ts rows.jsonl
```

Everything else (alumni/placement PDFs via Gemini, NAAC, fees, uploads) is done
through the deployed `/admin` console.

---

## Future hardening (optional)

- **Direct-to-S3 uploads** (presigned PUT from the browser) to bypass Vercel's
  4.5 MB body limit for large PDFs.
- **Tighten admin auth** (currently a single username/password) — e.g. rate-limit
  logins, rotate `ADMIN_SESSION_SECRET`.
- **Cron warm** for the Adzuna job-market cache so no user hits the cold fetch.
