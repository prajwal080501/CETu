import Link from "next/link";
import { GraduationCap, ArrowRight } from "lucide-react";
import { listBranches } from "@/lib/branch";
import { guideForFamily } from "@/lib/branch-guide";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Know Your Branch — Engineering Branch Guide",
  description:
    "Get to know every MHT-CET engineering branch: what it's about, the topics you study, skills you build and where it leads — plus seats, demand and a live job-market view.",
};

export default async function BranchesPage() {
  const branches = await listBranches();

  // Group by family, families ordered by total seats.
  const byFamily = new Map<string, typeof branches>();
  for (const b of branches) {
    const key = b.family ?? "Other";
    (byFamily.get(key) ?? byFamily.set(key, []).get(key)!).push(b);
  }
  const families = [...byFamily.entries()].sort(
    (a, b) =>
      b[1].reduce((s, x) => s + x.seats, 0) -
      a[1].reduce((s, x) => s + x.seats, 0)
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Know Your Branch
        </h1>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        New to engineering branches? Start here. Each group below explains what
        the branch is about and the topics you&rsquo;ll study — pick one to dive
        into seats, cutoffs, top colleges and its live job market.
      </p>

      <div className="mt-8 space-y-6">
        {families.map(([family, list]) => {
          const guide = guideForFamily(family);
          return (
            <section key={family} className="rounded-2xl border p-5">
              <h2 className="text-base font-semibold">{family}</h2>
              <p className="mt-0.5 text-sm font-medium text-primary">
                {guide.tagline}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">{guide.about}</p>

              {/* topics covered — brief */}
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Topics you&rsquo;ll study
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {guide.topics.slice(0, 7).map((t) => (
                    <span
                      key={t}
                      className="rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs"
                    >
                      {t}
                    </span>
                  ))}
                  {guide.topics.length > 7 && (
                    <span className="rounded-full px-2 py-0.5 text-xs text-muted-foreground">
                      +{guide.topics.length - 7} more
                    </span>
                  )}
                </div>
              </div>

              {/* branch cards */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {list.map((b) => (
                  <Link
                    key={b.id}
                    href={`/branches/${b.slug}`}
                    className="group flex items-center justify-between gap-3 rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium group-hover:text-primary">
                        {b.name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="rounded-full">
                          {b.seats.toLocaleString()} seats
                        </Badge>
                        <Badge variant="secondary" className="rounded-full">
                          {b.colleges} colleges
                        </Badge>
                        {b.avgCutoff != null && (
                          <Badge variant="secondary" className="rounded-full">
                            ~{b.avgCutoff.toFixed(1)} avg %ile
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
