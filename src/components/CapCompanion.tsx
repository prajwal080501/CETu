"use client";

import { useEffect, useState } from "react";
import { Check, CalendarClock, ExternalLink, ListChecks, ArrowRight } from "lucide-react";
import {
  CAP_STAGES,
  CAP_DOCS_MANDATORY,
  extraDocsFor,
  type CapDoc,
} from "@/lib/cap";
import { scheduleState, type MilestoneState } from "@/lib/schedule";

const STAGE_KEY = "cet-cap-stages-v1";
const DOC_KEY = "cet-cap-docs-v1";
const CAT_KEY = "cet-cap-cat-v1";

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

const STATUS_STYLE: Record<MilestoneState["status"], string> = {
  past: "border-border bg-muted text-muted-foreground",
  live: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  upcoming: "border-primary/30 bg-primary/10 text-primary",
};

export function CapCompanion({
  categories,
}: {
  categories: { code: string; label: string }[];
}) {
  const [category, setCategory] = useState("GOPEN");
  const [doneStages, setDoneStages] = useState<Set<string>>(new Set());
  const [doneDocs, setDoneDocs] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    try {
      const s = localStorage.getItem(STAGE_KEY);
      if (s) setDoneStages(new Set(JSON.parse(s)));
      const d = localStorage.getItem(DOC_KEY);
      if (d) setDoneDocs(new Set(JSON.parse(d)));
      const c = localStorage.getItem(CAT_KEY);
      if (c) setCategory(c);
    } catch {
      /* ignore */
    }
    setLoaded(true);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STAGE_KEY, JSON.stringify([...doneStages]));
  }, [doneStages, loaded]);
  useEffect(() => {
    if (loaded) localStorage.setItem(DOC_KEY, JSON.stringify([...doneDocs]));
  }, [doneDocs, loaded]);
  useEffect(() => {
    if (loaded) localStorage.setItem(CAT_KEY, category);
  }, [category, loaded]);

  const sched = scheduleState(now ?? Date.now());
  const byKey = new Map(sched.map((m) => [m.key, m]));
  const toggle =
    (setFn: (u: (p: Set<string>) => Set<string>) => void) => (k: string) =>
      setFn((prev) => {
        const n = new Set(prev);
        if (n.has(k)) n.delete(k);
        else n.add(k);
        return n;
      });

  const extra = extraDocsFor(category);
  const allDocKeys = new Set([...CAP_DOCS_MANDATORY, ...extra].map((d) => d.key));
  const docsDone = [...doneDocs].filter((k) => allDocKeys.has(k)).length;
  const docPct = allDocKeys.size ? Math.round((docsDone / allDocKeys.size) * 100) : 0;
  const stagePct = Math.round((doneStages.size / CAP_STAGES.length) * 100);
  const nextStage = CAP_STAGES.find((s) => !doneStages.has(s.key));

  const DocRow = ({ d }: { d: CapDoc }) => {
    const on = doneDocs.has(d.key);
    return (
      <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/50">
        <input
          type="checkbox"
          checked={on}
          onChange={() => toggle(setDoneDocs)(d.key)}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <span className="min-w-0">
          <span className={`text-sm font-medium ${on ? "text-muted-foreground line-through" : ""}`}>
            {d.label}
          </span>
          {d.note && <span className="block text-xs text-muted-foreground">{d.note}</span>}
        </span>
      </label>
    );
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/50 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1.5">
          <label htmlFor="cap-cat" className="text-xs font-medium text-muted-foreground">
            Your category — personalises the document checklist
          </label>
          <select
            id="cap-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/20 sm:w-80"
          >
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
        </div>
        <a
          href="https://cetcell.mahacet.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Official CET Cell portal
        </a>
      </div>

      {/* Next step */}
      {nextStage && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-chart-2/10 px-4 py-3">
          <ArrowRight className="h-4 w-4 text-primary" />
          <span className="text-sm">
            <span className="text-muted-foreground">Your next step:</span>{" "}
            <strong>{nextStage.title}</strong>
          </span>
          {nextStage.scheduleKey && byKey.get(nextStage.scheduleKey) && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                STATUS_STYLE[byKey.get(nextStage.scheduleKey)!.status]
              }`}
            >
              {byKey.get(nextStage.scheduleKey)!.status === "live" ? "Open now · " : ""}
              {fmt(byKey.get(nextStage.scheduleKey)!.start)}
            </span>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* Workflow tracker */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarClock className="h-4 w-4 text-primary" /> CAP workflow
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">{stagePct}% done</span>
          </div>
          <ol className="relative space-y-1 border-l border-border/60 pl-1">
            {CAP_STAGES.map((s, i) => {
              const on = doneStages.has(s.key);
              const m = s.scheduleKey ? byKey.get(s.scheduleKey) : undefined;
              return (
                <li key={s.key} className="relative rounded-lg py-2 pl-6 pr-2">
                  <button
                    type="button"
                    onClick={() => toggle(setDoneStages)(s.key)}
                    aria-pressed={on}
                    className={`absolute -left-[13px] top-3 grid h-6 w-6 place-items-center rounded-full border text-[11px] font-bold transition-colors ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {on ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-medium ${on ? "text-muted-foreground line-through" : ""}`}>
                      {s.title}
                    </span>
                    {m && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[m.status]}`}
                      >
                        {fmt(m.start)}
                        {m.confirmed ? "" : " (est.)"}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.what}</p>
                  {s.where && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">On {s.where}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {/* Document checklist */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ListChecks className="h-4 w-4 text-primary" /> Document checklist
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {docsDone}/{allDocKeys.size} · {docPct}%
            </span>
          </div>

          <div className="rounded-xl border border-border/60 p-2">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Everyone needs
            </p>
            {CAP_DOCS_MANDATORY.map((d) => (
              <DocRow key={d.key} d={d} />
            ))}

            {extra.length > 0 && (
              <>
                <p className="mt-2 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  For {category}
                </p>
                {extra.map((d) => (
                  <DocRow key={d.key} d={d} />
                ))}
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Carry <strong>originals + 3–4 attested photocopies</strong> of every
            document. If you take a Home-University seat, your domicile must match
            that university&rsquo;s region.
          </p>
        </section>
      </div>

      <p className="mt-6 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        This is a study aid compiled from the CAP process and public guides. The
        authoritative source is the official Information Brochure and notices on{" "}
        <a href="https://cetcell.mahacet.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          cetcell.mahacet.org
        </a>
        {" "}— always verify documents, dates and rules there. Your progress is
        saved on this device.
      </p>
    </div>
  );
}
