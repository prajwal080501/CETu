"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Building2, GraduationCap, Send, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitPlacement, submitAlumnus, submitNaac } from "@/app/actions/contribute";

type Placement = {
  year: number;
  avg: string | null;
  median: string | null;
  highest: string | null;
  rate: string | null;
  recruiters: string | null;
  source: string | null;
};
type Alum = { name: string; achievement: string | null };

export function PlacementsSection({
  collegeId,
  clerkOn,
  placements,
}: {
  collegeId: number;
  clerkOn: boolean;
  placements: Placement[];
}) {
  return (
    <section className="rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">Placements</h2>
      </div>
      {placements.length > 0 ? (
        <div className="mt-3 space-y-2 text-sm">
          {placements.map((p) => (
            <div key={p.year} className="rounded-lg bg-muted/50 p-3">
              <div className="font-medium">{p.year}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                {p.median && <span>Median ₹{Number(p.median).toFixed(1)}L</span>}
                {!p.median && p.avg && <span>Avg ₹{Number(p.avg).toFixed(1)}L</span>}
                {p.highest && <span>Highest ₹{Number(p.highest).toFixed(1)}L</span>}
                {p.rate && <span>{Number(p.rate)}% placed</span>}
              </div>
              {p.recruiters && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Recruiters: {p.recruiters}
                </div>
              )}
              {p.source && (
                <a
                  href={p.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs text-primary hover:underline"
                >
                  Source ↗
                </a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No verified placement data yet — official CAP data doesn&rsquo;t include
          it. Contribute below; moderators verify before it appears.
        </p>
      )}
      {clerkOn && <PlacementForm collegeId={collegeId} />}
    </section>
  );
}

function PlacementForm({ collegeId }: { collegeId: number }) {
  const { isSignedIn } = useUser();
  const [state, setState] = useState<"idle" | "saving" | "done" | "err">("idle");
  const [msg, setMsg] = useState("");

  if (!isSignedIn)
    return (
      <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
        Sign in to contribute placement data.
      </p>
    );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState("saving");
    const res = await submitPlacement({
      collegeId,
      year: Number(fd.get("year")),
      medianPackageLpa: fd.get("median") ? Number(fd.get("median")) : undefined,
      highestPackageLpa: fd.get("highest") ? Number(fd.get("highest")) : undefined,
      placementRatePct: fd.get("rate") ? Number(fd.get("rate")) : undefined,
      topRecruiters: (fd.get("recruiters") as string) || undefined,
      source: (fd.get("source") as string) || undefined,
    });
    if (res.ok) {
      setState("done");
      setMsg("Thanks! Submitted for moderator review.");
      (e.target as HTMLFormElement).reset();
    } else {
      setState("err");
      setMsg(res.error ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 border-t pt-4">
      <div className="mb-2 text-sm font-medium">Contribute placement data</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Field name="year" label="Year" type="number" required placeholder="2025" />
        <Field name="median" label="Median (₹L)" type="number" placeholder="12.5" />
        <Field name="highest" label="Highest (₹L)" type="number" placeholder="45" />
        <Field name="rate" label="Placed %" type="number" placeholder="92" />
        <div className="col-span-2 sm:col-span-3">
          <Field name="recruiters" label="Top recruiters" placeholder="TCS, Infosys, …" />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <Field name="source" label="Source (link)" placeholder="official placement report URL" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={state === "saving"} className="gap-1.5">
          <Send className="h-3.5 w-3.5" />
          {state === "saving" ? "Submitting…" : "Submit"}
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

const NAAC_GRADES = ["A++", "A+", "A", "B++", "B+", "B", "C"];

export function NaacSection({
  grade,
  cgpa,
  validUpto,
  source,
}: {
  grade: string | null;
  cgpa: number | null;
  validUpto: string | null;
  source: string | null;
}) {
  if (!grade) return null; // display-only; nothing to show until an admin sets it
  return (
    <section className="rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <Award className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">NAAC Accreditation</h2>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-lg font-bold text-primary">
          {grade}
        </span>
        {cgpa != null && (
          <span className="text-muted-foreground">CGPA {cgpa.toFixed(2)} / 4.00</span>
        )}
        {validUpto && <span className="text-muted-foreground">· valid to {validUpto}</span>}
        {source && (
          <a href={source} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
            Source ↗
          </a>
        )}
      </div>
    </section>
  );
}

function NaacForm({ collegeId }: { collegeId: number }) {
  const { isSignedIn } = useUser();
  const [state, setState] = useState<"idle" | "saving" | "done" | "err">("idle");
  const [msg, setMsg] = useState("");

  if (!isSignedIn)
    return (
      <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
        Sign in to contribute a NAAC grade.
      </p>
    );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState("saving");
    const res = await submitNaac({
      collegeId,
      grade: String(fd.get("grade") ?? ""),
      cgpa: fd.get("cgpa") ? Number(fd.get("cgpa")) : undefined,
      validUpto: (fd.get("validUpto") as string) || undefined,
      source: (fd.get("source") as string) || undefined,
    });
    if (res.ok) {
      setState("done");
      setMsg("Thanks! Submitted for moderator review.");
      (e.target as HTMLFormElement).reset();
    } else {
      setState("err");
      setMsg(res.error ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 border-t pt-4">
      <div className="mb-2 text-sm font-medium">Contribute NAAC grade</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Grade</span>
          <select
            name="grade"
            required
            defaultValue=""
            className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-primary/50"
          >
            <option value="" disabled>
              Grade
            </option>
            {NAAC_GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <Field name="cgpa" label="CGPA (/4)" type="number" placeholder="3.51" />
        <Field name="validUpto" label="Valid to" placeholder="2029" />
        <div className="col-span-2 sm:col-span-3">
          <Field name="source" label="Source (official link)" placeholder="NAAC certificate / college page URL" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={state === "saving"} className="gap-1.5">
          <Send className="h-3.5 w-3.5" />
          {state === "saving" ? "Submitting…" : "Submit"}
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

export function AlumniSection({
  collegeId,
  clerkOn,
  alumni,
}: {
  collegeId: number;
  clerkOn: boolean;
  alumni: Alum[];
}) {
  return (
    <section className="rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">Notable alumni</h2>
      </div>
      {alumni.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {alumni.map((a, i) => (
            <li key={i}>
              <span className="font-medium">{a.name}</span>
              {a.achievement && (
                <span className="text-muted-foreground"> — {a.achievement}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Know a distinguished alumnus? Contributions are verified before showing.
        </p>
      )}
      {clerkOn && <AlumnusForm collegeId={collegeId} />}
    </section>
  );
}

function AlumnusForm({ collegeId }: { collegeId: number }) {
  const { isSignedIn } = useUser();
  const [state, setState] = useState<"idle" | "saving" | "done" | "err">("idle");
  const [msg, setMsg] = useState("");
  if (!isSignedIn)
    return (
      <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
        Sign in to add an alumnus.
      </p>
    );
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState("saving");
    const res = await submitAlumnus({
      collegeId,
      name: fd.get("name") as string,
      achievement: (fd.get("achievement") as string) || undefined,
    });
    if (res.ok) {
      setState("done");
      setMsg("Thanks! Submitted for review.");
      (e.target as HTMLFormElement).reset();
    } else {
      setState("err");
      setMsg(res.error ?? "Error.");
    }
  }
  return (
    <form onSubmit={onSubmit} className="mt-4 border-t pt-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field name="name" label="Name" required placeholder="Full name" />
        <Field name="achievement" label="Known for" placeholder="Founder of …, CTO at …" />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={state === "saving"} className="gap-1.5">
          <Send className="h-3.5 w-3.5" /> Submit
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

function Field({
  name,
  label,
  type = "text",
  required,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <Input id={name} name={name} type={type} required={required} placeholder={placeholder} className="h-9" step="any" />
    </div>
  );
}
