"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
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

interface Option {
  id: number;
  code?: string;
  label?: string;
  name?: string;
  shortName?: string | null;
}

const NONE = "__any__";

export function PredictorForm({
  categories,
  universities,
  cities,
  defaults,
}: {
  categories: { id: number; code: string; label: string }[];
  universities: Option[];
  cities: { city: string; n: number }[];
  defaults: {
    percentile?: string;
    category?: string;
    university?: string;
    city?: string;
  };
}) {
  const router = useRouter();
  const [percentile, setPercentile] = useState(defaults.percentile ?? "");
  const [category, setCategory] = useState(defaults.category ?? "GOPEN");
  const [university, setUniversity] = useState(defaults.university ?? NONE);
  const [city, setCity] = useState(defaults.city || NONE);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (percentile) p.set("percentile", percentile);
    p.set("category", category);
    if (university && university !== NONE) p.set("university", university);
    if (city && city !== NONE) p.set("city", city);
    router.push(`/predictor?${p.toString()}`);
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent">
      <CardContent>
        <form
          onSubmit={submit}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 lg:items-end"
        >
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

          <div className="grid gap-1.5">
            <Label>Location</Label>
            <Select value={city} onValueChange={(v) => setCity(v ?? NONE)}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Any location" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={NONE}>Any location</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c.city} value={c.city}>
                    {c.city} ({c.n})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" size="lg" className="h-10 gap-1.5">
            <Sparkles className="h-4 w-4" />
            Predict
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Your home university decides whether you compete for Home-University or
          Other-Than-Home-University seats — we account for that.
        </p>
      </CardContent>
    </Card>
  );
}
