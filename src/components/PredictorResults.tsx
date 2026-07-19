"use client";

import { useEffect, useMemo, useState } from "react";
import { SEAT_TYPE_LABELS, type SeatType } from "@/lib/reference";
import type { Chance } from "@/lib/predictor";
import { ShareList } from "./ShareList";

export interface FlatResult {
  collegeBranchId: number;
  collegeName: string;
  collegeSlug: string;
  branchName: string;
  city: string | null;
  chance: Chance;
  viaSeatType: SeatType;
  closingPercentile: number;
  probability: number;
  trend?: {
    direction: "rising" | "falling" | "stable";
    latest: number;
    projected: number;
    years: number;
  };
}

const STORAGE_KEY = "cet-preference-list-v1";

const CHANCE_STYLE: Record<Chance, string> = {
  safe: "bg-green-600/10 text-green-700 dark:text-green-400 border-green-600/30",
  moderate:
    "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  reach: "bg-red-600/10 text-red-700 dark:text-red-400 border-red-600/30",
};
const CHANCE_LABEL: Record<Chance, string> = {
  safe: "Safe",
  moderate: "Target",
  reach: "Dream",
};
// Display order: Target (your realistic best-fit) first, then Safe, then Dream.
const CHANCE_ORDER: Chance[] = ["moderate", "safe", "reach"];

const CHANCE_DOT: Record<Chance, string> = {
  safe: "bg-green-500",
  moderate: "bg-yellow-500",
  reach: "bg-rose-500",
};

/** Trend signal (context only): rising cutoff = getting harder over 2021–2025. */
function TrendArrow({
  t,
}: {
  t: { direction: "rising" | "falling" | "stable"; years: number };
}) {
  if (t.direction === "stable" || t.years < 2)
    return <span className="text-muted-foreground">· → stable trend</span>;
  const rising = t.direction === "rising";
  return (
    <span
      className={`· ${rising ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
      title="Trend over 2021–2025 (context only; prediction uses 2025 cutoff)"
    >
      {rising ? "↑ trending harder" : "↓ easing"}
    </span>
  );
}

export function PredictorResults({
  results,
  year,
  percentile,
  category,
  initialList,
  onPersist,
}: {
  results: FlatResult[];
  year: number;
  percentile?: number;
  category?: string;
  /** Server-loaded list for signed-in users; undefined = anonymous. */
  initialList?: FlatResult[];
  /** Server action to persist the list (present only when signed in). */
  onPersist?: (items: FlatResult[]) => Promise<void>;
}) {
  const synced = !!onPersist;
  // Signed-in users are backed by the DB; anonymous users by localStorage.
  const [list, setList] = useState<FlatResult[]>(initialList ?? []);
  const [loaded, setLoaded] = useState(synced);

  useEffect(() => {
    if (synced) return; // server-provided initialList is the source of truth
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setList(JSON.parse(raw));
    } catch {
      /* ignore corrupt storage */
    }
    setLoaded(true);
  }, [synced]);

  useEffect(() => {
    if (!loaded) return;
    if (synced) onPersist?.(list);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }, [list, loaded, synced, onPersist]);

  const inList = useMemo(
    () => new Set(list.map((r) => r.collegeBranchId)),
    [list]
  );

  const add = (r: FlatResult) =>
    setList((prev) =>
      prev.some((x) => x.collegeBranchId === r.collegeBranchId)
        ? prev
        : [...prev, r]
    );
  const remove = (id: number) =>
    setList((prev) => prev.filter((r) => r.collegeBranchId !== id));
  const move = (id: number, dir: -1 | 1) =>
    setList((prev) => {
      const i = prev.findIndex((r) => r.collegeBranchId === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const clear = () => setList([]);

  // Within each bucket, show the BEST college first — highest closing percentile
  // = the strongest option you can still get. Sorting by probability instead
  // would tie all "Safe" colleges at ~99% and float low-cutoff safety-nets
  // (e.g. closing 57) to the top for a high-percentile student.
  const byClosing = (a: FlatResult, b: FlatResult) =>
    b.closingPercentile - a.closingPercentile;
  const buckets: Record<Chance, FlatResult[]> = {
    safe: results.filter((r) => r.chance === "safe").sort(byClosing),
    moderate: results.filter((r) => r.chance === "moderate").sort(byClosing),
    reach: results.filter((r) => r.chance === "reach").sort(byClosing),
  };

  const [visibleChances, setVisibleChances] = useState<Set<Chance>>(
    () => new Set(CHANCE_ORDER)
  );
  const toggleChance = (c: Chance) =>
    setVisibleChances((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  return (
    <>
      {/* Filters — tier, location & branch. Apply to everything below. */}
      <div className="mt-8 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/60 p-3">
          <span className="text-xs font-medium text-muted-foreground">Show</span>
          {CHANCE_ORDER.map((c) => {
            const on = visibleChances.has(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleChance(c)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  on ? CHANCE_STYLE[c] : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {CHANCE_LABEL[c]}
                <span className="tabular-nums opacity-70">{buckets[c].length}</span>
              </button>
            );
          })}
      </div>

      {/* Results + preference sidebar */}
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* results */}
        <div className="min-w-0">
        {CHANCE_ORDER.filter((c) => visibleChances.has(c)).map((chance) => (
          <section key={chance} className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <span
                className={`rounded-md border px-2 py-0.5 text-xs ${CHANCE_STYLE[chance]}`}
              >
                {CHANCE_LABEL[chance]}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {buckets[chance].length} option
                {buckets[chance].length === 1 ? "" : "s"}
              </span>
            </h2>
            {buckets[chance].length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="divide-y divide-border">
                {buckets[chance].map((r) => (
                  <li
                    key={r.collegeBranchId}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`mt-1 h-2.5 w-2.5 shrink-0 self-start rounded-full ${CHANCE_DOT[r.chance]}`}
                        title={CHANCE_LABEL[r.chance]}
                      />
                      <div className="min-w-0">
                        <a
                          href={`/colleges/${r.collegeSlug}`}
                          className="block break-words font-medium hover:text-primary"
                        >
                          {r.collegeName}
                        </a>
                        <div className="truncate text-sm text-muted-foreground">
                          {r.branchName}
                          {r.city ? ` · ${r.city}` : ""} · via {r.viaSeatType}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                          <span className="font-medium text-foreground tabular-nums">
                            {r.closingPercentile.toFixed(2)}
                          </span>
                          <span className="text-muted-foreground">2025 cutoff</span>
                          {r.trend && <TrendArrow t={r.trend} />}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => add(r)}
                      disabled={inList.has(r.collegeBranchId)}
                      className="shrink-0 rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-40"
                    >
                      {inList.has(r.collegeBranchId) ? "Added" : "+ Add"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
        {visibleChances.size === 0 && (
          <p className="text-sm text-muted-foreground">
            Select a filter above to see options.
          </p>
        )}
      </div>

      {/* preference list panel */}
      <PreferencePanel
        list={list}
        year={year}
        percentile={percentile}
        category={category}
        onRemove={remove}
        onMove={move}
        onClear={clear}
      />
      </div>
    </>
  );
}

function PreferencePanel({
  list,
  year,
  percentile,
  category,
  onRemove,
  onMove,
  onClear,
}: {
  list: FlatResult[];
  year: number;
  percentile?: number;
  category?: string;
  onRemove: (id: number) => void;
  onMove: (id: number, dir: -1 | 1) => void;
  onClear: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [share, setShare] = useState(false);

  const safeCount = list.filter((r) => r.chance === "safe").length;
  const reachOnly = list.length > 0 && safeCount === 0;

  const asText = () =>
    list
      .map(
        (r, i) =>
          `${i + 1}. ${r.collegeName} — ${r.branchName} (cutoff ${r.closingPercentile.toFixed(
            2
          )} via ${r.viaSeatType})`
      )
      .join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `My MHT-CET CAP preference list (${year} cutoffs)\n\n${asText()}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      {share && (
        <ShareList
          list={list}
          percentile={percentile}
          category={category}
          onClose={() => setShare(false)}
        />
      )}
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">My college list</h3>
          <span className="text-xs text-muted-foreground">
            {list.length} choice{list.length === 1 ? "" : "s"}
          </span>
        </div>

        {list.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Add options from the left to build your CAP option form. In CAP you
            list choices most-preferred first — order them here, then export.
          </p>
        ) : (
          <>
            {reachOnly && (
              <p className="mt-3 rounded-md border border-red-600/30 bg-red-600/10 p-2 text-xs text-red-700 dark:text-red-400">
                ⚠ No “Safe” choices in your list. Add a few safety options lower
                down so you don’t risk going unallotted.
              </p>
            )}
            <ol className="mt-3 space-y-2">
              {list.map((r, i) => (
                <li
                  key={r.collegeBranchId}
                  className="rounded-lg border border-border p-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {i + 1}. {r.collegeName}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.branchName} · {r.closingPercentile.toFixed(2)} /{" "}
                        {r.viaSeatType}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        aria-label="Move up"
                        onClick={() => onMove(r.collegeBranchId, -1)}
                        disabled={i === 0}
                        className="rounded px-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        aria-label="Move down"
                        onClick={() => onMove(r.collegeBranchId, 1)}
                        disabled={i === list.length - 1}
                        className="rounded px-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        aria-label="Remove"
                        onClick={() => onRemove(r.collegeBranchId)}
                        className="rounded px-1 text-red-600 hover:bg-red-600/10"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setShare(true)}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Share / Download
              </button>
              <button
                onClick={copy}
                className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                {copied ? "Copied!" : "Copy text"}
              </button>
              <button
                onClick={onClear}
                className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-600/10"
              >
                Clear
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
