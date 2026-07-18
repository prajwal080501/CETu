import Link from "next/link";
import { Building2, Briefcase, TrendingUp, MapPin, ArrowLeft } from "lucide-react";
import { getCityEmployers } from "@/lib/employers";
import { adzunaEnabled } from "@/lib/adzuna";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const name = decodeURIComponent(city);
  return {
    title: `Top Employers in ${name} — Who's Hiring`,
    description: `Top companies hiring in ${name}, Maharashtra — live job counts, hiring trends and company details.`,
  };
}

export default async function CityPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ family?: string }>;
}) {
  const { city: raw } = await params;
  const { family } = await searchParams;
  const city = decodeURIComponent(raw);
  const data = await getCityEmployers(city, family ? decodeURIComponent(family) : null);

  const maxCount = Math.max(...data.employers.map((e) => e.count), 1);
  const prior = data.history[1]; // previous snapshot, if any
  const priorMap = new Map(prior?.top.map((t) => [t.name, t.count]));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/branches" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Branches
      </Link>

      <div className="mt-3 flex items-center gap-2">
        <MapPin className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Top employers in {city}
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Companies hiring for {data.role.toLowerCase()} in {city}
        {data.live || data.fetchedAt ? " · live via Adzuna" : ""}
        {data.fetchedAt
          ? ` · ${new Date(data.fetchedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
          : ""}
        .
      </p>

      {data.employers.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed p-8 text-sm text-muted-foreground">
          {adzunaEnabled
            ? `No live employer data for ${city} right now.`
            : "Connect a free Adzuna API key (ADZUNA_APP_ID / ADZUNA_APP_KEY) to load live top employers here."}
        </div>
      ) : (
        <>
          {/* Summary */}
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat icon={<Building2 className="h-4 w-4" />} label="Employers listed" value={String(data.employers.length)} />
            <Stat icon={<Briefcase className="h-4 w-4" />} label="Open postings" value={data.totalPostings.toLocaleString()} />
            <Stat icon={<TrendingUp className="h-4 w-4" />} label="Snapshots tracked" value={String(data.history.length)} />
          </section>

          {/* Employer leaderboard */}
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Who&rsquo;s hiring</h2>
            <div className="space-y-2">
              {data.employers.map((e, i) => {
                const was = priorMap.get(e.name);
                const delta = was != null ? e.count - was : null;
                return (
                  <div
                    key={e.name}
                    className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40"
                  >
                    <span className="w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <Logo domain={e.domain} name={e.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {e.domain ? (
                          <a
                            href={`https://${e.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate font-medium hover:text-primary hover:underline"
                          >
                            {e.name}
                          </a>
                        ) : (
                          <span className="truncate font-medium">{e.name}</span>
                        )}
                        {delta != null && delta !== 0 && (
                          <span
                            className={`text-[10px] font-medium ${
                              delta > 0 ? "text-green-600" : "text-muted-foreground"
                            }`}
                          >
                            {delta > 0 ? `▲${delta}` : `▼${-delta}`}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(e.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-bold tabular-nums text-primary">{e.count}</div>
                      <div className="text-[10px] text-muted-foreground">openings</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Live postings via Adzuna; company logos via Clearbit. Counts reflect
              current openings, not total headcount. Indicative market data.
            </p>
          </section>

          {/* Past data / history */}
          {data.history.length > 1 && (
            <section className="mt-8">
              <h2 className="mb-3 text-lg font-semibold">Hiring over time</h2>
              <div className="space-y-3">
                {data.history.map((h) => (
                  <div key={h.date} className="rounded-xl border p-3">
                    <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {new Date(h.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {h.top.map((t) => (
                        <span key={t.name} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {t.name} <b className="tabular-nums">{t.count}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mt-8">
            <Link
              href={`/colleges?area=${encodeURIComponent(city)}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              See engineering colleges in {city} →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
