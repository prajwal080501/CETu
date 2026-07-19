import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { memo } from "react";
import type { RankedCollege } from "@/lib/landing";
import { CollegeLogo } from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TYPE_LABEL: Record<string, string> = {
  government: "Government",
  government_aided: "Govt. Aided",
  university_dept: "University Dept.",
  private_unaided: "Private",
  autonomous: "Autonomous",
  deemed: "Deemed",
};

/** College card with hover lift + a detail row that reveals on hover. */
function CollegeCardBase({
  college,
  rank,
}: {
  college: RankedCollege;
  rank?: number;
}) {
  const c = college;
  return (
    <Link href={`/colleges/${c.slug}`} className="group block">
      <Card className="relative h-full gap-0 overflow-hidden py-5 transition-all duration-200 group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-xl group-hover:shadow-primary/5">
        {/* top accent line on hover */}
        <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary to-chart-2 transition-transform duration-300 group-hover:scale-x-100" />

        {rank != null && (
          <span className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-chart-2 text-xs font-bold text-primary-foreground shadow-sm">
            {rank}
          </span>
        )}

        <div className="px-5">
          <div className="flex items-start gap-3 pr-8">
            <CollegeLogo website={c.website} name={c.name} size={40} rounded="rounded-lg" />
            <h3 className="font-semibold leading-snug transition-colors group-hover:text-primary">
              {c.name}
            </h3>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {[c.city, c.university].filter(Boolean).join(" · ")}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.type && <Badge variant="secondary">{TYPE_LABEL[c.type] ?? c.type}</Badge>}
            {c.aicteApproved && (
              <Badge className="border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                AICTE ✓
              </Badge>
            )}
            {c.naacGrade && <Badge variant="outline">NAAC {c.naacGrade}</Badge>}
            {c.isAutonomous && <Badge variant="outline">Autonomous</Badge>}
          </div>

          <div className="mt-4 flex items-stretch gap-2">
            <MiniStat value={c.totalSeats.toLocaleString()} label="seats" />
            <MiniStat value={String(c.branchCount)} label="branches" />
            <div className="flex-1 rounded-lg bg-primary/10 px-3 py-2 text-center">
              <div className="text-lg font-bold tabular-nums text-primary">
                {c.topCutoff != null ? c.topCutoff.toFixed(2) : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">top %ile</div>
            </div>
          </div>

          {/* hover-revealed detail */}
          <div className="grid grid-rows-[0fr] transition-all duration-300 group-hover:mt-3 group-hover:grid-rows-[1fr]">
            <div className="overflow-hidden">
              <div className="flex items-center gap-1 border-t pt-2 text-xs text-muted-foreground">
                {c.topBranch ? (
                  <span className="truncate">
                    Most competitive:{" "}
                    <span className="font-medium text-foreground">
                      {c.topBranch}
                    </span>
                  </span>
                ) : (
                  <span>View branches, seats &amp; details</span>
                )}
                <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export const CollegeCard = memo(CollegeCardBase, (prev, next) => {
  // Only re-render if college data or rank changes
  return (
    prev.college.slug === next.college.slug &&
    prev.college.name === next.college.name &&
    prev.rank === next.rank
  );
});

const MiniStatBase = ({ value, label }: { value: string; label: string }) => (
  <div className="flex-1 rounded-lg bg-muted/60 px-3 py-2 text-center">
    <div className="font-semibold tabular-nums">{value}</div>
    <div className="text-[11px] text-muted-foreground">{label}</div>
  </div>
);

const MiniStat = memo(MiniStatBase);
