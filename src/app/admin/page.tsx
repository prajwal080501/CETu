import {
  getPipelineStats,
  getCoverage,
  getCollegesMissingUniversity,
  getUnclassifiedBranches,
  getPendingContributions,
  getPendingCutoffBatches,
} from "@/lib/admin";
import { getCollegesLite } from "@/lib/compare";
import { s3Enabled } from "@/lib/s3";
import { aiEnabled } from "@/lib/ai";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin-auth";
import { adminLogout } from "@/app/actions/admin-auth";
import { ModerationQueue } from "@/components/ModerationQueue";
import { AdminUpload } from "@/components/AdminUpload";
import { AdminData } from "@/components/AdminData";
import { AdminMeta } from "@/components/AdminMeta";

export const metadata = { title: "Admin · Data Quality" };
export const dynamic = "force-dynamic";
// Gemini PDF extraction + cutoff ingest run via this page's server actions.
export const maxDuration = 60;

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && (
        <div className="mt-0.5 text-xs text-muted-foreground">
          {sub}
        </div>
      )}
    </div>
  );
}

export default async function AdminPage() {
  if (!(await isAdminAuthed())) redirect("/admin/login");

  const [
    { totals, counts, byYear },
    coverage,
    missingUniv,
    unclassified,
    pending,
    collegesLite,
    cutoffBatches,
  ] = await Promise.all([
    getPipelineStats(),
    getCoverage(),
    getCollegesMissingUniversity(),
    getUnclassifiedBranches(),
    getPendingContributions(),
    getCollegesLite(),
    getPendingCutoffBatches(),
  ]);

  const pct = (n: number, d: number) =>
    d === 0 ? "0%" : `${Math.round((100 * n) / d)}%`;
  const maxRows = Math.max(...byYear.map((y) => y.rows), 1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin console</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage colleges, alumni, placements and cutoffs; review coverage gaps.
          </p>
        </div>
        <form action={adminLogout}>
          <button className="shrink-0 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            Sign out
          </button>
        </form>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          Moderation queue{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({pending.placements.length + pending.alumni.length + pending.naac.length} pending)
          </span>
        </h2>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">
          Crowdsourced placements, alumni & NAAC grades — approve to publish on
          the college page.
        </p>
        <ModerationQueue
          placements={pending.placements}
          alumni={pending.alumni}
          naac={pending.naac}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Upload &amp; ingest PDFs</h2>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">
          Upload documents for a college, or parse a cutoff PDF straight into the
          database (loads as pending → approve the batch to publish).
        </p>
        <AdminUpload
          colleges={collegesLite}
          batches={cutoffBatches}
          s3Enabled={s3Enabled}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Alumni &amp; placements</h2>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">
          Add alumni manually with a photo, or let Gemini extract alumni and
          placement records from an official PDF (review before saving).
        </p>
        <AdminData
          colleges={collegesLite}
          aiEnabled={aiEnabled}
          s3Enabled={s3Enabled}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">NAAC &amp; fees</h2>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">
          Set a college&rsquo;s NAAC grade, its average annual fee, and per-branch
          fees — all shown on the college page.
        </p>
        <AdminMeta colleges={collegesLite} />
      </section>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Tile label="Colleges" value={counts.colleges} />
        <Tile label="Branches" value={counts.branches} />
        <Tile label="Offerings" value={counts.offerings} />
        <Tile label="Universities" value={counts.universities} />
        <Tile label="Cutoff rows" value={totals.cutoffs.toLocaleString()} />
        <Tile
          label="Verified"
          value={pct(totals.verified, totals.cutoffs)}
          sub={`${totals.verified.toLocaleString()} rows`}
        />
        <Tile
          label="Home university"
          value={pct(coverage.withUniversity, coverage.total)}
          sub={`${coverage.withUniversity}/${coverage.total} colleges`}
        />
        <Tile
          label="City"
          value={pct(coverage.withCity, coverage.total)}
          sub={`${coverage.withCity}/${coverage.total} colleges`}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Cutoffs by year</h2>
        <div className="mt-3 space-y-2">
          {byYear.map((y) => (
            <div key={y.year} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 tabular-nums">
                {y.year} · CAP{y.round}
              </span>
              <div className="h-5 flex-1 rounded bg-muted">
                <div
                  className="h-5 rounded bg-primary"
                  style={{ width: `${(100 * y.rows) / maxRows}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
                {y.rows.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          Colleges missing home university{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({missingUniv.length}) — have HU/OHU seats but no university
          </span>
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          These need the DTE institute directory (name doesn&rsquo;t resolve to a
          district). Predictor treats them as outside/OHU until fixed.
        </p>
        <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              {missingUniv.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {c.dteCode}
                  </td>
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.city ?? "—"}
                  </td>
                </tr>
              ))}
              {missingUniv.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-muted-foreground">All colleges mapped.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 mb-4">
        <h2 className="text-lg font-semibold">
          Unclassified branches{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({unclassified.length}) — fell into &ldquo;Other&rdquo;
          </span>
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {unclassified.map((b) => (
            <li
              key={b.id}
              className="rounded-full border border-input px-3 py-1 text-xs"
            >
              {b.name}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
