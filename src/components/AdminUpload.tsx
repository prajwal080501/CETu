"use client";

import { useMemo, useState, useTransition } from "react";
import { Upload, FileUp, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchColleges } from "@/lib/search";
import {
  uploadCollegeDocument,
  ingestCutoffPdf,
  approveCutoffBatch,
  rejectCutoffBatch,
} from "@/app/actions/admin-upload";

type Lite = { id: number; name: string; city: string | null };
type Batch = {
  id: number;
  title: string;
  year: number;
  round: number;
  pendingRows: number;
  sampleColleges: string[];
};
type Summary = { cutoffs: number; colleges: number; branches: number; categories: number };

export function AdminUpload({
  colleges,
  batches,
  s3Enabled,
}: {
  colleges: Lite[];
  batches: Batch[];
  s3Enabled: boolean;
}) {
  return (
    <div className="space-y-6">
      {!s3Enabled && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
          S3 storage isn&rsquo;t configured — set <code>AWS_REGION</code> and{" "}
          <code>AWS_S3_BUCKET</code> (+ credentials) in <code>.env.local</code> to
          enable uploads.
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <DocUploadForm colleges={colleges} disabled={!s3Enabled} />
        <CutoffIngestForm disabled={!s3Enabled} />
      </div>
      <PendingBatches batches={batches} />
    </div>
  );
}

// ---- general document upload ----------------------------------------------

function DocUploadForm({ colleges, disabled }: { colleges: Lite[]; disabled: boolean }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Lite | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "done" | "err">("idle");
  const [msg, setMsg] = useState("");

  const matches = useMemo(
    () => (q.trim() && !picked ? searchColleges(colleges, q, 6) : []),
    [q, picked, colleges]
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!picked) {
      setState("err");
      setMsg("Pick a college first.");
      return;
    }
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("collegeId", String(picked.id));
    setState("saving");
    const res = await uploadCollegeDocument(fd);
    if (res.ok) {
      setState("done");
      setMsg("Uploaded.");
      form.reset();
      setPicked(null);
      setQ("");
    } else {
      setState("err");
      setMsg(res.error ?? "Failed.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <FileUp className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Upload a document for a college</h3>
      </div>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        Placement reports, brochures, institutional-round PDFs. Stored in S3 and
        linked from the college page.
      </p>

      {/* college picker */}
      <div className="relative">
        <Input
          value={picked ? picked.name : q}
          onChange={(e) => {
            setPicked(null);
            setQ(e.target.value);
          }}
          placeholder="Search a college…"
          className="h-9"
        />
        {matches.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(c);
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

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Type
          <select name="docType" className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="placement">Placement report</option>
            <option value="institutional">Institutional / SPOT cutoff</option>
            <option value="cutoff">CAP cutoff</option>
            <option value="brochure">Brochure</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Year (optional)
          <Input name="year" type="number" placeholder="2025" className="h-9" />
        </label>
      </div>
      <label className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
        Title
        <Input name="title" placeholder="Placement Report 2024-25" className="h-9" required />
      </label>
      <label className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
        PDF file
        <input name="file" type="file" accept="application/pdf" required className="text-sm" />
      </label>

      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={disabled || state === "saving"} className="gap-1.5">
          {state === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {state === "saving" ? "Uploading…" : "Upload"}
        </Button>
        {msg && (
          <span className={state === "err" ? "text-sm text-destructive" : "text-sm text-emerald-600"}>
            {msg}
          </span>
        )}
      </div>
    </form>
  );
}

// ---- cutoff PDF ingestion --------------------------------------------------

function CutoffIngestForm({ disabled }: { disabled: boolean }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "err">("idle");
  const [msg, setMsg] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setState("saving");
    setSummary(null);
    setMsg("");
    const res = await ingestCutoffPdf(fd);
    if (res.ok) {
      setState("done");
      setSummary(res.summary as Summary);
      setMsg(`Parsed ${res.parsedRows} rows — loaded as pending. Approve below.`);
      form.reset();
    } else {
      setState("err");
      setMsg(res.error ?? "Failed.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Ingest a cutoff PDF</h3>
      </div>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        Official CAP / institutional-round cutoff PDF. Parsed into the DB as
        pending, then approve the batch to publish.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Year
          <Input name="year" type="number" placeholder="2025" className="h-9" required />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Round
          <Input name="round" type="number" placeholder="1" className="h-9" required />
        </label>
      </div>
      <label className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
        Title (optional)
        <Input name="title" placeholder="CAP Round 1 Cutoffs 2025" className="h-9" />
      </label>
      <label className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
        PDF file
        <input name="file" type="file" accept="application/pdf" required className="text-sm" />
      </label>

      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={disabled || state === "saving"} className="gap-1.5">
          {state === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
          {state === "saving" ? "Parsing…" : "Parse & load"}
        </Button>
        {msg && (
          <span className={state === "err" ? "text-sm text-destructive" : "text-sm text-emerald-600"}>
            {msg}
          </span>
        )}
      </div>
      {summary && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">{summary.cutoffs} cutoffs</span>
          <span className="rounded-full bg-muted px-2 py-0.5">{summary.colleges} colleges</span>
          <span className="rounded-full bg-muted px-2 py-0.5">{summary.branches} branches</span>
          <span className="rounded-full bg-muted px-2 py-0.5">{summary.categories} categories</span>
        </div>
      )}
    </form>
  );
}

// ---- pending cutoff batches ------------------------------------------------

function PendingBatches({ batches }: { batches: Batch[] }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const vis = batches.filter((b) => !done.has(b.id));

  if (vis.length === 0)
    return (
      <div className="rounded-xl border p-5">
        <h3 className="font-semibold">Pending cutoff ingestions</h3>
        <p className="mt-1 text-sm text-muted-foreground">No pending batches.</p>
      </div>
    );

  return (
    <div className="rounded-xl border p-5">
      <h3 className="font-semibold">Pending cutoff ingestions</h3>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        Review each parsed batch, then approve to publish or reject to discard.
      </p>
      <div className="space-y-2">
        {vis.map((b) => (
          <div key={b.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
            <div className="min-w-0">
              <div className="font-medium">
                {b.title} · {b.year} R{b.round}
              </div>
              <div className="text-muted-foreground">
                <b className="text-foreground">{b.pendingRows.toLocaleString()}</b> pending rows ·{" "}
                {(b.sampleColleges ?? []).join(", ")}
                {b.sampleColleges?.length >= 3 ? "…" : ""}
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => start(async () => { await approveCutoffBatch(b.id); setDone((s) => new Set(s).add(b.id)); })}
                className="gap-1 text-emerald-600"
              >
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => start(async () => { await rejectCutoffBatch(b.id); setDone((s) => new Set(s).add(b.id)); })}
                className="gap-1 text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
