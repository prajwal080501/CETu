"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";

interface Option {
  id: number;
  code?: string;
  label?: string;
  name?: string;
  shortName?: string | null;
}

const NONE = "__any__";
const FIELD_TRIGGER =
  "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm shadow-xs";
const toSet = (s?: string) => new Set((s ?? "").split(",").map((x) => x.trim()).filter(Boolean));

export function PredictorForm({
  categories,
  universities,
  cities,
  branches,
  defaults,
}: {
  categories: { id: number; code: string; label: string }[];
  universities: Option[];
  cities: string[];
  branches: string[];
  defaults: {
    percentile?: string;
    category?: string;
    university?: string;
    loc?: string;
    br?: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [percentile, setPercentile] = useState(defaults.percentile ?? "");
  const [category, setCategory] = useState(defaults.category ?? "GOPEN");
  const [university, setUniversity] = useState(defaults.university ?? NONE);
  const [selCities, setSelCities] = useState<Set<string>>(() => toSet(defaults.loc));
  const [selBranches, setSelBranches] = useState<Set<string>>(() => toSet(defaults.br));

  const toggleIn = (setFn: (u: (p: Set<string>) => Set<string>) => void) => (v: string) =>
    setFn((prev) => {
      const n = new Set(prev);
      if (n.has(v)) n.delete(v);
      else n.add(v);
      return n;
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (percentile) p.set("percentile", percentile);
    p.set("category", category);
    if (university && university !== NONE) p.set("university", university);
    if (selCities.size) p.set("loc", [...selCities].join(","));
    if (selBranches.size) p.set("br", [...selBranches].join(","));
    startTransition(() => router.push(`/make-my-list?${p.toString()}`));
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent">
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="percentile">MHT-CET percentile</Label>
            <Input
              id="percentile"
              type="number"
              inputMode="decimal"
              step="0.0001"
              min="0"
              max="100"
              required
              value={percentile}
              onChange={(e) => setPercentile(e.target.value)}
              placeholder="e.g. 98.75"
              className="h-10"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v ?? "GOPEN")}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.code}>
                    {c.code} — {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Home university</Label>
            <Select
              value={university}
              onValueChange={(v) => setUniversity(v ?? NONE)}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Select home university" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={NONE}>Any / not sure</SelectItem>
                {universities.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.shortName ? `${u.shortName} — ` : ""}
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
          <div className="grid gap-1.5">
            <Label>Location</Label>
            <MultiSelectFilter
              placeholder="Any location"
              options={cities}
              selected={selCities}
              onToggle={toggleIn(setSelCities)}
              onClear={() => setSelCities(new Set())}
              triggerClassName={FIELD_TRIGGER}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Branch</Label>
            <MultiSelectFilter
              placeholder="Any branch"
              options={branches}
              selected={selBranches}
              onToggle={toggleIn(setSelBranches)}
              onClear={() => setSelBranches(new Set())}
              triggerClassName={FIELD_TRIGGER}
            />
          </div>

          <Button type="submit" size="lg" disabled={pending} className="h-10 gap-1.5">
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {pending ? "Building…" : "Predict"}
          </Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Your home university decides whether you compete for Home-University or
          Other-Than-Home-University seats — we account for that. Location and
          branch are optional filters — pick any number.
        </p>
      </CardContent>
    </Card>
  );
}
