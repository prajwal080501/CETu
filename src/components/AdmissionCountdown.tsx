"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Circle } from "lucide-react";
import {
  upcomingMilestones,
  MHTCET_YEAR,
  type MilestoneState,
} from "@/lib/schedule";

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (ms: string) =>
  new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function parts(ms: number) {
  return {
    d: Math.floor(ms / 86_400_000),
    h: Math.floor(ms / 3_600_000) % 24,
    m: Math.floor(ms / 60_000) % 60,
    s: Math.floor(ms / 1000) % 60,
  };
}

function CountBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[3.25rem] flex-col items-center rounded-xl border border-border/60 bg-background/70 px-2.5 py-1.5 shadow-sm backdrop-blur">
      <span className="text-2xl font-bold tabular-nums leading-none">{pad(value)}</span>
      <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Live MHT-CET admission countdown for the landing page. Counts down to the next
 * (or currently-live) milestone, with a strip of what's coming after. Time only
 * ticks after mount, so SSR and first client render match (no hydration mismatch).
 */
export function AdmissionCountdown() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const upcoming = upcomingMilestones(now ?? Date.now());
  if (upcoming.length === 0) return null; // season concluded — hide

  const primary: MilestoneState = upcoming[0];
  const rest = upcoming.slice(1, 4);
  const remaining = now == null ? null : Math.max(0, primary.countTo - now);
  const p = remaining == null ? null : parts(remaining);
  const live = primary.status === "live";

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/8 via-background to-chart-2/8">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-5 py-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">MHT-CET {MHTCET_YEAR} · Engineering admissions</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              primary.confirmed
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}
          >
            {primary.confirmed ? "Official date" : "Estimated"}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">Live · IST</span>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {live && <Circle className="h-2 w-2 animate-pulse fill-rose-500 text-rose-500" />}
            {live ? "Happening now — closes in" : "Next up — starts in"}
          </div>
          <div className="mt-1 text-lg font-bold leading-tight">{primary.label}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {fmt(primary.start)}
            {primary.end ? ` – ${fmt(primary.end)}` : ""}
            {primary.detail ? ` · ${primary.detail}` : ""}
          </div>
        </div>

        <div className="flex gap-2 sm:justify-end">
          {p ? (
            <>
              <CountBox value={p.d} label="Days" />
              <CountBox value={p.h} label="Hrs" />
              <CountBox value={p.m} label="Min" />
              <CountBox value={p.s} label="Sec" />
            </>
          ) : (
            <div className="self-center text-sm text-muted-foreground">{fmt(primary.start)}</div>
          )}
        </div>
      </div>

      {rest.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 px-5 py-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Then
          </span>
          {rest.map((e) => (
            <span
              key={e.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs"
            >
              <span className="font-medium">{e.label.replace(/ —.*/, "")}</span>
              <span className="text-muted-foreground">
                {fmt(e.start)}
                {e.confirmed ? "" : " (est.)"}
              </span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
