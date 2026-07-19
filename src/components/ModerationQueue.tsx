"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  approvePlacement,
  rejectPlacement,
  approveAlumnus,
  approveNaac,
  rejectNaac,
} from "@/app/actions/contribute";

type PendingPlacement = {
  id: number;
  college: string;
  year: number;
  median: number | null;
  highest: number | null;
  rate: number | null;
  recruiters: string | null;
  source: string | null;
};
type PendingAlum = {
  id: number;
  college: string;
  name: string;
  achievement: string | null;
};
type PendingNaac = {
  id: number;
  college: string;
  grade: string;
  cgpa: number | null;
  validUpto: string | null;
  source: string | null;
};

export function ModerationQueue({
  placements,
  alumni,
  naac = [],
}: {
  placements: PendingPlacement[];
  alumni: PendingAlum[];
  naac?: PendingNaac[];
}) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const mark = (key: string) => setDone((s) => new Set(s).add(key));

  const visP = placements.filter((p) => !done.has(`p${p.id}`));
  const visA = alumni.filter((a) => !done.has(`a${a.id}`));
  const visN = naac.filter((n) => !done.has(`n${n.id}`));

  if (visP.length === 0 && visA.length === 0 && visN.length === 0)
    return (
      <p className="text-sm text-muted-foreground">No pending contributions.</p>
    );

  return (
    <div className="space-y-4">
      {visP.map((p) => (
        <div
          key={p.id}
          className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
        >
          <div>
            <div className="font-medium">{p.college} · Placement {p.year}</div>
            <div className="text-muted-foreground">
              {[
                p.median && `median ₹${Number(p.median).toFixed(1)}L`,
                p.highest && `highest ₹${Number(p.highest).toFixed(1)}L`,
                p.rate && `${Number(p.rate)}% placed`,
              ]
                .filter(Boolean)
                .join(" · ")}
              {p.recruiters ? ` · ${p.recruiters}` : ""}
            </div>
            {p.source && (
              <div className="text-xs text-muted-foreground">source: {p.source}</div>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => start(async () => { await approvePlacement(p.id); mark(`p${p.id}`); })}
              className="gap-1 text-emerald-600"
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => start(async () => { await rejectPlacement(p.id); mark(`p${p.id}`); })}
              className="gap-1 text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
      {visA.map((a) => (
        <div
          key={a.id}
          className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
        >
          <div>
            <div className="font-medium">{a.college} · Alumnus</div>
            <div className="text-muted-foreground">
              {a.name}
              {a.achievement ? ` — ${a.achievement}` : ""}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => start(async () => { await approveAlumnus(a.id); mark(`a${a.id}`); })}
            className="shrink-0 gap-1 text-emerald-600"
          >
            <Check className="h-3.5 w-3.5" /> Approve
          </Button>
        </div>
      ))}
      {visN.map((n) => (
        <div
          key={n.id}
          className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
        >
          <div>
            <div className="font-medium">{n.college} · NAAC {n.grade}</div>
            <div className="text-muted-foreground">
              {[n.cgpa && `CGPA ${Number(n.cgpa).toFixed(2)}`, n.validUpto && `valid to ${n.validUpto}`]
                .filter(Boolean)
                .join(" · ")}
            </div>
            {n.source && (
              <div className="text-xs text-muted-foreground">
                source:{" "}
                <a href={n.source} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {n.source}
                </a>
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => start(async () => { await approveNaac(n.id); mark(`n${n.id}`); })}
              className="gap-1 text-emerald-600"
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => start(async () => { await rejectNaac(n.id); mark(`n${n.id}`); })}
              className="gap-1 text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
