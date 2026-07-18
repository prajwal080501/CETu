"use client";

import { useMemo, useState, useTransition } from "react";
import { UserPlus, Sparkles, Loader2, Check, X, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchColleges } from "@/lib/search";
import {
  addAlumnusManual,
  extractAlumniPdf,
  extractPlacementsPdf,
  commitAlumni,
  commitPlacements,
} from "@/app/actions/admin-data";
import type { AlumniRecord, PlacementRecord } from "@/lib/ai-extract";

type Lite = { id: number; name: string; city: string | null };

export function AdminData({
  colleges,
  aiEnabled,
  s3Enabled,
}: {
  colleges: Lite[];
  aiEnabled: boolean;
  s3Enabled: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ManualAlumnus colleges={colleges} s3Enabled={s3Enabled} />
        <AlumniFromPdf colleges={colleges} aiEnabled={aiEnabled} />
      </div>
      <PlacementsFromPdf colleges={colleges} aiEnabled={aiEnabled} />
    </div>
  );
}

// ---- shared college picker -------------------------------------------------

function CollegePicker({
  colleges,
  picked,
  onPick,
}: {
  colleges: Lite[];
  picked: Lite | null;
  onPick: (c: Lite | null) => void;
}) {
  const [q, setQ] = useState("");
  const matches = useMemo(
    () => (q.trim() && !picked ? searchColleges(colleges, q, 6) : []),
    [q, picked, colleges]
  );
  return (
    <div className="relative">
      <Input
        value={picked ? picked.name : q}
        onChange={(e) => {
          onPick(null);
          setQ(e.target.value);
        }}
        placeholder="Search a college…"
        className="h-9"
      />
      {matches.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(c);
                  setQ("");
                }}
                className="w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {c.name}
                {c.city ? <span className="text-muted-foreground"> · {c.city}</span> : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Msg({ state, text }: { state: string; text: string }) {
  if (!text) return null;
  return (
    <span className={state === "err" ? "text-sm text-destructive" : "text-sm text-emerald-600"}>
      {text}
    </span>
  );
}

// ---- manual alumnus --------------------------------------------------------

function ManualAlumnus({ colleges, s3Enabled }: { colleges: Lite[]; s3Enabled: boolean }) {
  const [picked, setPicked] = useState<Lite | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "done" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!picked) {
      setState("err");
      setMsg("Pick a college.");
      return;
    }
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("collegeId", String(picked.id));
    setState("saving");
    const res = await addAlumnusManual(fd);
    if (res.ok) {
      setState("done");
      setMsg("Added.");
      form.reset();
      setPicked(null);
    } else {
      setState("err");
      setMsg(res.error ?? "Failed.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Add an alumnus (manual)</h3>
      </div>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        With photo &amp; details. Published immediately on the college page.
      </p>
      <div className="space-y-2">
        <CollegePicker colleges={colleges} picked={picked} onPick={setPicked} />
        <div className="grid grid-cols-2 gap-2">
          <Input name="name" placeholder="Full name *" className="h-9" required />
          <Input name="batchYear" type="number" placeholder="Batch year" className="h-9" />
          <Input name="company" placeholder="Company" className="h-9" />
          <Input name="role" placeholder="Role / title" className="h-9" />
        </div>
        <Input name="linkedin" placeholder="LinkedIn URL (optional)" className="h-9" />
        <Input name="achievement" placeholder="Notable achievement (optional)" className="h-9" />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Photo {s3Enabled ? "" : "(S3 not configured — will be skipped)"}
          <input name="photo" type="file" accept="image/*" className="text-sm" disabled={!s3Enabled} />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={state === "saving"} className="gap-1.5">
          {state === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
          {state === "saving" ? "Adding…" : "Add alumnus"}
        </Button>
        <Msg state={state} text={msg} />
      </div>
    </form>
  );
}

// ---- alumni from PDF (Gemini) ----------------------------------------------

function AlumniFromPdf({ colleges, aiEnabled }: { colleges: Lite[]; aiEnabled: boolean }) {
  const [picked, setPicked] = useState<Lite | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "err">("idle");
  const [msg, setMsg] = useState("");
  const [records, setRecords] = useState<AlumniRecord[] | null>(null);
  const [saving, startSave] = useTransition();

  async function onExtract(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!picked) {
      setState("err");
      setMsg("Pick a college.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    setState("loading");
    setMsg("");
    setRecords(null);
    const res = await extractAlumniPdf(fd);
    if (res.ok) {
      setRecords(res.records);
      setState("idle");
      setMsg(`Found ${res.records.length}. Review, then save.`);
    } else {
      setState("err");
      setMsg(res.error);
    }
  }

  function save() {
    if (!picked || !records) return;
    startSave(async () => {
      const res = await commitAlumni(picked.id, records);
      if (res.ok) {
        setRecords(null);
        setMsg(`Saved ${res.count} alumni.`);
      } else {
        setState("err");
        setMsg(res.error ?? "Failed.");
      }
    });
  }

  return (
    <div className="rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Add alumni from a PDF (Gemini)</h3>
      </div>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        Upload an alumni PDF — Gemini extracts &amp; formats records. Review before saving.
      </p>
      <form onSubmit={onExtract} className="space-y-2">
        <CollegePicker colleges={colleges} picked={picked} onPick={setPicked} />
        <input name="file" type="file" accept="application/pdf" required className="text-sm" />
        <Button type="submit" size="sm" disabled={!aiEnabled || state === "loading"} className="gap-1.5">
          {state === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {state === "loading" ? "Reading…" : "Extract"}
        </Button>
        {!aiEnabled && <span className="ml-2 text-xs text-muted-foreground">Set GEMINI_API_KEY to enable.</span>}
      </form>
      <div className="mt-2">
        <Msg state={state} text={msg} />
      </div>
      {records && records.length > 0 && (
        <div className="mt-3">
          <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border p-2">
            {records.map((r, i) => (
              <div key={i} className="text-xs">
                <b>{r.name}</b>
                {r.role ? ` · ${r.role}` : ""}
                {r.company ? ` @ ${r.company}` : ""}
                {r.batchYear ? ` · ${r.batchYear}` : ""}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={save} disabled={saving} className="gap-1 text-emerald-50">
              <Check className="h-3.5 w-3.5" /> Save {records.length}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRecords(null)} className="gap-1">
              <X className="h-3.5 w-3.5" /> Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- placements from PDF (Gemini) ------------------------------------------

function PlacementsFromPdf({ colleges, aiEnabled }: { colleges: Lite[]; aiEnabled: boolean }) {
  const [picked, setPicked] = useState<Lite | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "err">("idle");
  const [msg, setMsg] = useState("");
  const [records, setRecords] = useState<PlacementRecord[] | null>(null);
  const [saving, startSave] = useTransition();

  async function onExtract(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!picked) {
      setState("err");
      setMsg("Pick a college.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    setState("loading");
    setMsg("");
    setRecords(null);
    const res = await extractPlacementsPdf(fd);
    if (res.ok) {
      setRecords(res.records);
      setState("idle");
      setMsg(`Found ${res.records.length} year(s). Review, then save.`);
    } else {
      setState("err");
      setMsg(res.error);
    }
  }

  function save() {
    if (!picked || !records) return;
    startSave(async () => {
      const res = await commitPlacements(picked.id, records);
      if (res.ok) {
        setRecords(null);
        setMsg(`Saved ${res.count} placement record(s).`);
      } else {
        setState("err");
        setMsg(res.error ?? "Failed.");
      }
    });
  }

  return (
    <div className="rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Add placements from a PDF (Gemini)</h3>
      </div>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        Upload a placement report — Gemini extracts per-year avg/median/highest/rate + recruiters.
      </p>
      <form onSubmit={onExtract} className="flex flex-wrap items-end gap-2">
        <div className="w-64">
          <CollegePicker colleges={colleges} picked={picked} onPick={setPicked} />
        </div>
        <input name="file" type="file" accept="application/pdf" required className="text-sm" />
        <Button type="submit" size="sm" disabled={!aiEnabled || state === "loading"} className="gap-1.5">
          {state === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {state === "loading" ? "Reading…" : "Extract"}
        </Button>
        {!aiEnabled && <span className="text-xs text-muted-foreground">Set GEMINI_API_KEY to enable.</span>}
      </form>
      <div className="mt-2">
        <Msg state={state} text={msg} />
      </div>
      {records && records.length > 0 && (
        <div className="mt-3">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-2 py-1.5">Year</th>
                  <th className="px-2 py-1.5">Avg</th>
                  <th className="px-2 py-1.5">Median</th>
                  <th className="px-2 py-1.5">Highest</th>
                  <th className="px-2 py-1.5">Rate</th>
                  <th className="px-2 py-1.5">Recruiters</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1 font-medium">{r.year}</td>
                    <td className="px-2 py-1">{r.avgLpa ?? "—"}</td>
                    <td className="px-2 py-1">{r.medianLpa ?? "—"}</td>
                    <td className="px-2 py-1">{r.highestLpa ?? "—"}</td>
                    <td className="px-2 py-1">{r.ratePct ?? "—"}</td>
                    <td className="max-w-[200px] truncate px-2 py-1 text-muted-foreground">{r.recruiters ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={save} disabled={saving} className="gap-1">
              <Check className="h-3.5 w-3.5" /> Save {records.length}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRecords(null)} className="gap-1">
              <X className="h-3.5 w-3.5" /> Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
