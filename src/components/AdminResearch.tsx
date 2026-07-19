"use client";

import { useMemo, useState } from "react";
import { Sparkles, ExternalLink, Loader2, Check } from "lucide-react";
import { researchCollegeData, commitResearchedNirf, commitResearchedNaac } from "@/app/actions/admin-research";
import { commitPlacements } from "@/app/actions/admin-data";
import type { PlacementRecord } from "@/lib/ai-extract";
import type { NirfRecord, NaacResearch } from "@/lib/ai-research";

type Lite = { id: number; name: string; city: string | null };
const NAAC_GRADES = ["A++", "A+", "A", "B++", "B+", "B", "C"];

/**
 * AI web-research console: pick a college, let Gemini (with Google Search) DRAFT
 * missing placements / NIRF / NAAC, then review + edit + save each section. The
 * draft is never auto-published — the admin commits it explicitly.
 */
export function AdminResearch({ colleges }: { colleges: Lite[] }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Lite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [placements, setPlacements] = useState<PlacementRecord[]>([]);
  const [nirf, setNirf] = useState<NirfRecord[]>([]);
  const [naac, setNaac] = useState<NaacResearch | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [savedMsg, setSavedMsg] = useState<Record<string, string>>({});

  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query || selected?.name === q) return [];
    return colleges
      .filter((c) => `${c.name} ${c.city ?? ""}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [q, colleges, selected]);

  async function runResearch() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setSavedMsg({});
    setPlacements([]);
    setNirf([]);
    setNaac(null);
    setSources([]);
    setNotes("");
    const res = await researchCollegeData(selected.id);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPlacements(res.placements);
    setNirf(res.nirf);
    setNaac(res.naac);
    setSources(res.sources);
    setNotes(res.notes);
  }

  const note = (k: string, m: string) => setSavedMsg((s) => ({ ...s, [k]: m }));

  return (
    <div className="rounded-xl border border-border p-4">
      {/* college picker */}
      <div className="relative max-w-md">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSelected(null);
          }}
          placeholder="Search a college to research…"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-background shadow-lg">
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(c);
                    setQ(c.name);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  {c.name}
                  {c.city && <span className="text-muted-foreground"> · {c.city}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={runResearch}
        disabled={!selected || loading}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "Researching the web…" : "Research with AI"}
      </button>
      <p className="mt-2 text-xs text-muted-foreground">
        AI-drafted from public web sources — <strong>review and correct every
        figure</strong> before saving. Nothing is published until you save it.
      </p>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {(placements.length > 0 || nirf.length > 0 || naac || notes) && (
        <div className="mt-5 space-y-6">
          {notes && (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <strong>Model note:</strong> {notes}
            </p>
          )}

          {/* Placements */}
          {placements.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Placements</h4>
                <SaveButton
                  label="Save placements"
                  saved={savedMsg.placements}
                  onSave={async () => {
                    if (!selected) return;
                    const r = await commitPlacements(selected.id, placements);
                    note("placements", r.ok ? `Saved ${placements.length}` : r.error || "Failed");
                  }}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      {["Year", "Avg", "Median", "Highest", "Rate %", "Recruiters", ""].map((h) => (
                        <th key={h} className="px-1.5 py-1 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {placements.map((p, i) => (
                      <tr key={i}>
                        {(["year", "avgLpa", "medianLpa", "highestLpa", "ratePct"] as const).map((f) => (
                          <td key={f} className="px-1 py-1">
                            <input
                              type="number"
                              value={p[f] ?? ""}
                              onChange={(e) => {
                                const v = e.target.value === "" ? null : Number(e.target.value);
                                setPlacements((rows) => rows.map((row, j) => (j === i ? { ...row, [f]: v } : row)));
                              }}
                              className="w-16 rounded border border-input bg-background px-1.5 py-1"
                            />
                          </td>
                        ))}
                        <td className="px-1 py-1">
                          <input
                            value={p.recruiters ?? ""}
                            onChange={(e) =>
                              setPlacements((rows) => rows.map((row, j) => (j === i ? { ...row, recruiters: e.target.value || null } : row)))
                            }
                            className="w-48 rounded border border-input bg-background px-1.5 py-1"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <button type="button" onClick={() => setPlacements((rows) => rows.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* NIRF */}
          {nirf.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">NIRF ranking</h4>
                <SaveButton
                  label="Save NIRF"
                  saved={savedMsg.nirf}
                  onSave={async () => {
                    if (!selected) return;
                    const r = await commitResearchedNirf(selected.id, nirf);
                    note("nirf", r.ok ? `Saved ${r.saved}` : r.error || "Failed");
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                {nirf.map((n, i) => (
                  <div key={i} className="flex items-center gap-1 rounded-lg border border-border/60 p-2 text-xs">
                    {(["year", "rank", "score"] as const).map((f) => (
                      <label key={f} className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground">{f}</span>
                        <input
                          type="number"
                          value={n[f] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? null : Number(e.target.value);
                            setNirf((rows) => rows.map((row, j) => (j === i ? { ...row, [f]: v } : row)));
                          }}
                          className="w-16 rounded border border-input bg-background px-1.5 py-1"
                        />
                      </label>
                    ))}
                    <label className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground">band</span>
                      <input
                        value={n.band ?? ""}
                        onChange={(e) => setNirf((rows) => rows.map((row, j) => (j === i ? { ...row, band: e.target.value || null } : row)))}
                        className="w-20 rounded border border-input bg-background px-1.5 py-1"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NAAC */}
          {naac && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">NAAC</h4>
                <SaveButton
                  label="Save NAAC"
                  saved={savedMsg.naac}
                  onSave={async () => {
                    if (!selected) return;
                    const r = await commitResearchedNaac(selected.id, naac);
                    note("naac", r.ok ? "Saved" : r.error || "Failed");
                  }}
                />
              </div>
              <div className="flex flex-wrap items-end gap-3 text-xs">
                <label className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground">grade</span>
                  <select
                    value={naac.grade ?? ""}
                    onChange={(e) => setNaac({ ...naac, grade: e.target.value || null })}
                    className="rounded border border-input bg-background px-2 py-1.5"
                  >
                    <option value="">—</option>
                    {NAAC_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </label>
                <label className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground">cgpa</span>
                  <input type="number" step="0.01" value={naac.cgpa ?? ""} onChange={(e) => setNaac({ ...naac, cgpa: e.target.value === "" ? null : Number(e.target.value) })} className="w-20 rounded border border-input bg-background px-1.5 py-1" />
                </label>
                <label className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground">valid upto</span>
                  <input value={naac.validUpto ?? ""} onChange={(e) => setNaac({ ...naac, validUpto: e.target.value || null })} className="w-24 rounded border border-input bg-background px-1.5 py-1" />
                </label>
                <label className="flex flex-1 flex-col">
                  <span className="text-[10px] text-muted-foreground">source URL</span>
                  <input value={naac.source ?? ""} onChange={(e) => setNaac({ ...naac, source: e.target.value || null })} className="min-w-[12rem] rounded border border-input bg-background px-1.5 py-1" />
                </label>
              </div>
            </div>
          )}

          {/* Sources */}
          {sources.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Sources used</h4>
              <ul className="space-y-0.5">
                {sources.map((s) => (
                  <li key={s}>
                    <a href={s} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" />
                      {s.replace(/^https?:\/\//, "").slice(0, 70)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SaveButton({ label, saved, onSave }: { label: string; saved?: string; onSave: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <span className="flex items-center gap-2">
      {saved && <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" />{saved}</span>}
      <button
        type="button"
        disabled={busy}
        onClick={async () => { setBusy(true); await onSave(); setBusy(false); }}
        className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
      >
        {busy ? "Saving…" : label}
      </button>
    </span>
  );
}
