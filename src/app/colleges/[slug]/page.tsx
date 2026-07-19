import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getCollegeBySlug,
  getCollegeBranches,
  getCollegeOverview,
  getCollegeCutoffMatrix,
  getCollegeNirf,
  getCollegePlacements,
  getCollegeAlumni,
  getCollegeDocuments,
} from "@/lib/queries";
import { FileText, Globe } from "lucide-react";
import { CutoffMatrix } from "@/components/CutoffMatrix";
import { SeatAllocation } from "@/components/SeatAllocation";
import { NaacSection } from "@/components/ContributePanel";
import { AlumniShowcase } from "@/components/AlumniShowcase";
import { AiInsights } from "@/components/AiInsights";
import { CollegeLogo } from "@/components/Logo";
import { aiEnabled } from "@/lib/ai";
import { getCachedInsights } from "@/lib/insights";

const TYPE_LABEL: Record<string, string> = {
  government: "Government",
  government_aided: "Govt. Aided",
  university_dept: "University Dept.",
  private_unaided: "Private (Unaided)",
  autonomous: "Autonomous",
  deemed: "Deemed University",
};

// Indicative FRA-regulated annual tuition band by college type (₹). Clearly
// labeled as indicative on the page — exact fees vary by branch and year.
const FEE_BAND: Record<string, string> = {
  government: "₹15,000 – ₹90,000",
  government_aided: "₹20,000 – ₹95,000",
  university_dept: "₹20,000 – ₹90,000",
  autonomous: "₹80,000 – ₹1,50,000",
  private_unaided: "₹1,00,000 – ₹1,75,000",
  deemed: "₹2,00,000 – ₹4,00,000",
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Glance({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums text-primary">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// The "Generate AI insights" server action (Gemini) runs under this page.
export const maxDuration = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const college = await getCollegeBySlug(slug);
  if (!college) return {};
  return {
    title: `${college.name} — MHT-CET Cutoffs & Branches`,
    description: `MHT-CET CAP cutoffs, branches, seats and details for ${college.name}${
      college.city ? `, ${college.city}` : ""
    }.`,
  };
}

export default async function CollegePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const college = await getCollegeBySlug(slug);
  if (!college) notFound();

  const [offerings, overview, matrix, nirf, placementRows, alumniRows, documents] =
    await Promise.all([
      getCollegeBranches(college.id),
      getCollegeOverview(college.id),
      getCollegeCutoffMatrix(college.id),
      getCollegeNirf(college.id),
      getCollegePlacements(college.id),
      getCollegeAlumni(college.id),
      getCollegeDocuments(college.id),
    ]);
  const feeBand = college.type ? FEE_BAND[college.type] : undefined;
  const avgFee = college.avgFeeAnnual;
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const hasBranchFees = offerings.some((o) => o.fee != null);
  const cachedInsights = aiEnabled ? await getCachedInsights(college.id) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <a href="/colleges" className="text-sm text-primary hover:underline">
        ← All colleges
      </a>
      <div className="mt-3 flex items-start gap-3">
        <CollegeLogo website={college.website} name={college.name} size={48} rounded="rounded-xl" />
        <h1 className="text-2xl font-bold tracking-tight">{college.name}</h1>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {college.city && <span>📍 {college.city}</span>}
        {college.university && <span>🎓 {college.university}</span>}
        {college.type && <span>🏛 {TYPE_LABEL[college.type] ?? college.type}</span>}
        {college.dteCode && <span>DTE Code: {college.dteCode}</span>}
      </div>

      {/* Approvals + rankings */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {college.aicteApproved && (
          <span className="rounded-full border border-green-600/30 bg-green-600/10 px-2.5 py-1 font-medium text-green-700 dark:text-green-400">
            ✓ AICTE Approved
          </span>
        )}
        <span className="rounded-full border border-violet-600/30 bg-violet-600/10 px-2.5 py-1 font-medium text-violet-700 dark:text-violet-400">
          NAAC: {college.naacGrade ?? "Not available"}
          {college.naacGrade && college.naacCgpa != null
            ? ` (${Number(college.naacCgpa).toFixed(2)})`
            : ""}
        </span>
        {nirf && (
          <span className="rounded-full border border-blue-600/30 bg-blue-600/10 px-2.5 py-1 font-medium text-blue-700 dark:text-blue-400">
            NIRF Engg {nirf.year}: {nirf.rank ?? nirf.band}
          </span>
        )}
        <Link
          href={`/compare?ids=${college.id}`}
          className="ml-auto rounded-full border px-2.5 py-1 font-medium hover:border-primary hover:text-primary"
        >
          + Compare
        </Link>
      </div>

      {/* Overview */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total seats" value={overview.totalSeats.toLocaleString()} />
        <Stat label="Branches" value={overview.branches} />
        <Stat
          label="Autonomy"
          value={college.isAutonomous ? "Autonomous" : "Affiliated"}
        />
        <Stat
          label={avgFee != null ? "Avg fees/yr" : "Indicative fees/yr"}
          value={avgFee != null ? inr(avgFee) : feeBand ?? "—"}
        />
      </section>

      {/* Placements at a glance (prominent, right under overview) */}
      {placementRows.length > 0 && (
        <section className="mt-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-primary">
              Placements at a glance
            </h2>
            <span className="text-xs text-muted-foreground">
              {placementRows[0].year}
              {placementRows[0].source ? (
                <>
                  {" · "}
                  <a href={placementRows[0].source} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    source ↗
                  </a>
                </>
              ) : null}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Glance
              label="Highest package"
              value={placementRows[0].highest ? `₹${Number(placementRows[0].highest).toFixed(1)}L` : "—"}
            />
            <Glance
              label={placementRows[0].median ? "Median package" : "Avg package"}
              value={
                placementRows[0].median
                  ? `₹${Number(placementRows[0].median).toFixed(1)}L`
                  : placementRows[0].avg
                    ? `₹${Number(placementRows[0].avg).toFixed(1)}L`
                    : "—"
              }
            />
            <Glance
              label="Placement rate"
              value={placementRows[0].rate ? `${Number(placementRows[0].rate)}%` : "—"}
            />
          </div>
        </section>
      )}

      {/* AI insights — grounded on this college's verified data (Gemini) */}
      {aiEnabled && (
        <AiInsights
          collegeId={college.id}
          slug={college.slug}
          initial={cachedInsights?.content ?? null}
        />
      )}

      {/* Branch-wise seat allocation */}
      {offerings.some((o) => o.totalIntake != null) && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Branch-wise seat allocation</h2>
          <div className="mt-1">
            <SeatAllocation
              offerings={offerings.map((o) => ({
                collegeBranchId: o.collegeBranchId,
                branchName: o.branchName,
                totalIntake: o.totalIntake,
                msSeats: o.msSeats,
                aiSeats: o.aiSeats,
                minoritySeats: o.minoritySeats,
                fee: o.fee,
              }))}
              totalSeats={overview.totalSeats}
              hasBranchFees={hasBranchFees}
              collegeName={college.name}
            />
          </div>
        </section>
      )}

      {/* College-wide cutoff matrix: categories × branches */}
      {matrix.year && matrix.rows.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Cutoff matrix</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">
            Closing percentile for every category (rows) across branches
            (columns). Switch seat type and filter branches.
          </p>
          <CutoffMatrix year={matrix.year} rows={matrix.rows} collegeName={college.name} />
        </section>
      )}


      {/* Fees */}
      <h2 className="mt-12 text-lg font-semibold">Fees</h2>
      <div className="mt-3 rounded-xl border border-border p-5">
        {avgFee != null ? (
          <>
            <div className="text-2xl font-semibold">{inr(avgFee)}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Average annual tuition.
              {feeBand ? ` Indicative band by college type: ${feeBand}.` : ""}
              {hasBranchFees
                ? " See the branch-wise table above for per-branch fees."
                : ""}
            </p>
          </>
        ) : (
          <>
            <div className="text-2xl font-semibold">{feeBand ?? "—"}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Indicative annual tuition (FRA-regulated). Actual fees vary by branch
              and year — confirm on the official fee-approval order.
            </p>
          </>
        )}
      </div>

      {/* Official documents (placement reports, institutional-round cutoffs) */}
      {documents.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Official documents</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">
            Placement reports and institute-level (SPOT) round cutoffs, linked
            directly from the college&rsquo;s official website.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {documents.map((d, i) => {
              const isPdf = /\.pdf(\?|#|$)/i.test(d.url);
              return (
              <a
                key={i}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 rounded-xl border p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                {isPdf ? (
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                    <FileText className="h-4 w-4" />
                    <span className="text-[7px] font-bold leading-none">PDF</span>
                  </span>
                ) : (
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Globe className="h-4 w-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="font-medium leading-snug group-hover:text-primary">
                    {d.title}
                  </div>
                  <div className="mt-0.5 text-xs capitalize text-muted-foreground">
                    {d.docType === "institutional"
                      ? "Institute-level round"
                      : d.docType}
                    {d.year ? ` · ${d.year}` : ""}
                    {isPdf ? " · opens PDF ↗" : " · opens link ↗"}
                  </div>
                </div>
              </a>
              );
            })}
          </div>
        </section>
      )}

      {/* NAAC accreditation (admin-set; display only) */}
      <div className="mt-12">
        <NaacSection
          grade={college.naacGrade}
          cgpa={college.naacCgpa == null ? null : Number(college.naacCgpa)}
          validUpto={college.naacValidUpto}
          source={college.naacSource}
        />
      </div>

      {/* Notable alumni (admin-curated, with photos) */}
      <AlumniShowcase alumni={alumniRows} />

      {/* Discussion deeplinks — jump into the relevant scoped threads */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold">Join the discussion</h2>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">
          Ask questions and compare notes with other aspirants.
        </p>
        <div className="flex flex-wrap gap-2">
          {college.city && (
            <Link
              href={`/discuss?scope=city&value=${encodeURIComponent(college.city)}`}
              className="rounded-full border px-3 py-1 text-sm transition-colors hover:border-primary hover:text-primary"
            >
              💬 {college.city} discussions
            </Link>
          )}
          {[...new Set(offerings.map((o) => o.branchName))]
            .slice(0, 6)
            .map((b) => (
              <Link
                key={b}
                href={`/discuss?scope=branch&value=${encodeURIComponent(b)}`}
                className="rounded-full border px-3 py-1 text-sm transition-colors hover:border-primary hover:text-primary"
              >
                💬 {b}
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
