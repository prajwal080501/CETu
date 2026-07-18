"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Briefcase, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Logo } from "@/components/Logo";
import { MacLoader } from "@/components/MacLoader";
import { fetchCityEmployers } from "@/app/actions/employers";
import type { CityEmployers } from "@/lib/employers";

/**
 * Controlled modal that loads and shows a city's top employers on demand (no
 * page navigation). Results are cached per city+scope so re-opening is instant;
 * a macOS spinner covers the live Adzuna + logo fetch on first open.
 */
export function CityEmployersDialog({
  city,
  family,
  open,
  onOpenChange,
}: {
  city: string | null;
  family: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = useState<CityEmployers | null>(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef<Map<string, CityEmployers>>(new Map());

  useEffect(() => {
    if (!open || !city) return;
    const key = `${city}|${family ?? ""}`;
    const hit = cache.current.get(key);
    if (hit) {
      setData(hit);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setData(null);
    fetchCityEmployers(city, family)
      .then((d) => {
        if (cancelled) return;
        cache.current.set(key, d);
        setData(d);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, city, family]);

  const max = Math.max(...(data?.employers.map((e) => e.count) ?? [1]), 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        {/* gradient header */}
        <div className="border-b bg-gradient-to-br from-primary/[0.08] to-transparent px-6 pb-4 pt-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Top employers in {city}
            </DialogTitle>
            <DialogDescription>
              {data
                ? `Companies hiring for ${data.role.toLowerCase()} — live via Adzuna`
                : "Live hiring data across Maharashtra"}
            </DialogDescription>
          </DialogHeader>
          {data && data.employers.length > 0 && (
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                <b className="text-foreground">{data.employers.length}</b> employers
              </span>
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                <b className="text-foreground">{data.totalPostings.toLocaleString()}</b> open postings
              </span>
            </div>
          )}
        </div>

        {/* body */}
        <div className="max-h-[55vh] overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="py-12">
              <MacLoader label="Finding who's hiring…" />
            </div>
          ) : !data || data.employers.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No live employer data for {city} right now.
            </div>
          ) : (
            <ol className="space-y-2 pt-4">
              {data.employers.map((e, i) => (
                <li
                  key={e.name}
                  className="flex animate-in fade-in slide-in-from-bottom-1 items-center gap-3 rounded-xl border p-2.5 transition-colors hover:border-primary/40"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <span className="w-4 shrink-0 text-center text-xs font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <Logo domain={e.domain} name={e.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {e.domain ? (
                        <a
                          href={`https://${e.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                        >
                          {e.name}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      ) : (
                        e.name
                      )}
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${(e.count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold tabular-nums text-primary">{e.count}</div>
                    <div className="text-[10px] text-muted-foreground">openings</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {data && data.employers.length > 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Live postings via Adzuna, logos via Clearbit. Counts are current
              openings, indicative of demand — not total headcount.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
