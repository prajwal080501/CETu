"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPES = [
  { key: "", label: "All" },
  { key: "branch", label: "By branch" },
  { key: "city", label: "By city" },
  { key: "general", label: "General" },
];

export function ScopeFilter({
  scopeType,
  scopeValue,
  branches,
  cities,
}: {
  scopeType: string;
  scopeValue: string;
  branches: string[];
  cities: string[];
}) {
  const router = useRouter();
  const go = (t: string, v: string) => {
    const p = new URLSearchParams();
    if (t) p.set("scope", t);
    if (v) p.set("value", v);
    router.push(`/discuss${p.toString() ? `?${p}` : ""}`);
  };
  const options = scopeType === "branch" ? branches : scopeType === "city" ? cities : [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => go(t.key, "")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              scopeType === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {(scopeType === "branch" || scopeType === "city") && (
        <Select value={scopeValue || undefined} onValueChange={(v) => go(scopeType, v ?? "")}>
          <SelectTrigger className="h-9 w-64">
            <SelectValue placeholder={`Filter by ${scopeType}`} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {options.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
