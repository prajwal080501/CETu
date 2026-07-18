"use client";

import { useMemo, useState, useTransition } from "react";
import { Award, IndianRupee, Layers, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchColleges } from "@/lib/search";
import {
  setCollegeNaac,
  setCollegeAvgFee,
  getBranchFees,
  setBranchFees,
} from "@/app/actions/admin-meta";

type Lite = { id: number; name: string; city: string | null };
const GRADES = ["A++", "A+", "A", "B++", "B+", "B", "C"];

export function AdminMeta({ colleges }: { colleges: Lite[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <NaacForm colleges={colleges} />
      <AvgFeeForm colleges={colleges} />
      <div className="lg:col-span-2">
        <BranchFeesForm colleges={colleges} />
      </div>
    </div>
  );
}

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

function Msg({ err, text }: { err: boolean; text: string }) {
  if (!text) return null;
  return <span className={err ? "text-sm text-destructive" : "text-sm text-emerald-600"}>{text}</span>;
}

// ---- NAAC ------------------------------------------------------------------

function NaacForm({ colleges }: { colleges: Lite[] }) {
  const [picked, setPicked] = useState<Lite | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "err" | "done">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!picked) return setErr("Pick a college.");
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("collegeId", String(picked.id));
    setState("saving");
    const res = await setCollegeNaac(fd);
    if (res.ok) {
      setState("done");
      setMsg("Saved.");
      form.reset();
      setPicked(null);
    } else setErr(res.error ?? "Failed.");
  }
  function setErr(m: string) {
    setState("err");
    setMsg(m);
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <Award className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Set NAAC grade</h3>
      </div>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        Published immediately on the college page.
      </p>
      <div className="space-y-2">
        <CollegePicker colleges={colleges} picked={picked} onPick={setPicked} />
        <div className="grid grid-cols-2 gap-2">
          <select name="grade" required defaultValue="" className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="" disabled>Grade *</option>
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <Input name="cgpa" type="number" step="0.01" placeholder="CGPA / 4" className="h-9" />
          <Input name="validUpto" placeholder="Valid to (e.g. 2029)" className="h-9" />
          <Input name="source" placeholder="Source link" className="h-9" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={state === "saving"} className="gap-1.5">
          {state === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
        <Msg err={state === "err"} text={msg} />
      </div>
    </form>
  );
}

// ---- average fee -----------------------------------------------------------

function AvgFeeForm({ colleges }: { colleges: Lite[] }) {
  const [picked, setPicked] = useState<Lite | null>(null);
  const [amount, setAmount] = useState("");
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "err" | "done">("idle");
  const [msg, setMsg] = useState("");

  function save() {
    if (!picked) {
      setState("err");
      setMsg("Pick a college.");
      return;
    }
    start(async () => {
      const res = await setCollegeAvgFee(picked.id, amount ? Number(amount) : null);
      if (res.ok) {
        setState("done");
        setMsg("Saved.");
        setPicked(null);
        setAmount("");
      } else {
        setState("err");
        setMsg(res.error ?? "Failed.");
      }
    });
  }

  return (
    <div className="rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <IndianRupee className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Set average annual fee</h3>
      </div>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        College-wide average tuition (₹/yr). Shown on the college page.
      </p>
      <div className="space-y-2">
        <CollegePicker colleges={colleges} picked={picked} onPick={setPicked} />
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 145000"
          className="h-9"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={pending} className="gap-1.5">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
        <Msg err={state === "err"} text={msg} />
      </div>
    </div>
  );
}

// ---- branch-wise fees ------------------------------------------------------

type BranchFee = { collegeBranchId: number; branchName: string; fee: number | null };

function BranchFeesForm({ colleges }: { colleges: Lite[] }) {
  const [picked, setPicked] = useState<Lite | null>(null);
  const [rows, setRows] = useState<BranchFee[] | null>(null);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState("");
  const [err, setErrState] = useState(false);

  function pick(c: Lite | null) {
    setPicked(c);
    setRows(null);
    setMsg("");
    if (c)
      startLoad(async () => {
        const data = await getBranchFees(c.id);
        setRows(data.map((d) => ({ ...d, fee: d.fee ?? null })));
      });
  }

  function update(id: number, val: string) {
    setRows((rs) =>
      rs
        ? rs.map((r) => (r.collegeBranchId === id ? { ...r, fee: val ? Number(val) : null } : r))
        : rs
    );
  }

  function save() {
    if (!picked || !rows) return;
    startSave(async () => {
      const res = await setBranchFees(
        picked.id,
        rows.map((r) => ({ collegeBranchId: r.collegeBranchId, amount: r.fee }))
      );
      if (res.ok) {
        setErrState(false);
        setMsg(`Saved ${res.saved} branch fee(s).`);
      } else {
        setErrState(true);
        setMsg(res.error ?? "Failed.");
      }
    });
  }

  return (
    <div className="rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Set branch-wise fees</h3>
      </div>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        Annual tuition (₹/yr) per branch. Leave blank to clear a branch&rsquo;s fee.
      </p>
      <div className="max-w-md">
        <CollegePicker colleges={colleges} picked={picked} onPick={pick} />
      </div>
      {loading && <p className="mt-3 text-sm text-muted-foreground">Loading branches…</p>}
      {rows && rows.length > 0 && (
        <div className="mt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {rows.map((r) => (
              <label key={r.collegeBranchId} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{r.branchName}</span>
                <Input
                  type="number"
                  defaultValue={r.fee ?? ""}
                  onChange={(e) => update(r.collegeBranchId, e.target.value)}
                  placeholder="₹/yr"
                  className="h-8 w-28"
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save fees
            </Button>
            <Msg err={err} text={msg} />
          </div>
        </div>
      )}
      {rows && rows.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">This college has no branches.</p>
      )}
    </div>
  );
}
