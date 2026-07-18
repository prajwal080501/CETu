import Link from "next/link";
import { getRankedColleges, getAreaFacets } from "@/lib/landing";
import { CollegeBrowser } from "@/components/CollegeBrowser";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Engineering Colleges in Maharashtra — Ranked by Cutoff",
  description:
    "Browse Maharashtra MHT-CET engineering colleges ranked by competitiveness, with seats, cutoffs, home university, AICTE approval and NAAC grade. Filter by area.",
};

export default async function CollegesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; area?: string }>;
}) {
  const { q, area } = await searchParams;
  const [all, areas] = await Promise.all([
    getRankedColleges(area ? { area } : undefined),
    getAreaFacets(12),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Engineering Colleges
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {all.length} colleges{area ? ` in ${area}` : ""} · ranked by 2025 Open
        cutoff (most competitive first)
      </p>

      {/* area chips */}
      <div className="mt-6 flex flex-wrap gap-2">
        <AreaChip label="All areas" href="/colleges" active={!area} />
        {areas.map((a) => (
          <AreaChip
            key={a.city}
            label={`${a.city} (${a.colleges})`}
            href={`/colleges?area=${encodeURIComponent(a.city)}`}
            active={area === a.city}
          />
        ))}
      </div>

      <CollegeBrowser colleges={all} area={area} initialQuery={q ?? ""} />
    </div>
  );
}

function AreaChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link href={href}>
      <Badge
        variant={active ? "default" : "outline"}
        className="cursor-pointer rounded-full px-3 py-1 text-sm font-normal transition-colors hover:border-primary hover:text-primary data-[active=true]:hover:text-primary-foreground"
        data-active={active}
      >
        {label}
      </Badge>
    </Link>
  );
}
