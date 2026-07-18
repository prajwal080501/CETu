"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Compact home-page widget: type a percentile, jump straight to the predictor.
 * High-intent, one-field CTA for the core "what can I get" question.
 */
export function QuickPredict() {
  const router = useRouter();
  const [pct, setPct] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (pct) p.set("percentile", pct);
    p.set("category", "GOPEN");
    router.push(`/predictor?${p.toString()}`);
  };
  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">What can I get?</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your MHT-CET percentile — see Safe / Moderate / Reach colleges with
        an admission probability.
      </p>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input
          type="number"
          step="0.0001"
          min="0"
          max="100"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          placeholder="e.g. 98.75"
          className="h-10"
          required
        />
        <Button type="submit" className="h-10 shrink-0">
          Predict
        </Button>
      </form>
    </div>
  );
}
