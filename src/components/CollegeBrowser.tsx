"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { RankedCollege } from "@/lib/landing";
import { searchColleges } from "@/lib/search";
import { CollegeCard } from "@/components/CollegeCard";

/**
 * Client-side college grid that filters intelligently on every keystroke — no
 * submit. The full (area-filtered) list is shipped once and searched locally,
 * so results update instantly. Rank badges show only in the unfiltered view.
 */
export function CollegeBrowser({
  colleges,
  area,
  initialQuery = "",
}: {
  colleges: RankedCollege[];
  area?: string;
  initialQuery?: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const query = q.trim();

  const results = useMemo(
    () => (query ? searchColleges(colleges, query) : colleges),
    [q, colleges, query]
  );

  return (
    <>
      <div className="relative mt-6 max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by college, city, or university…"
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-10 text-sm shadow-sm outline-none transition focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {query && (
        <p className="mt-3 text-sm text-muted-foreground">
          {results.length} {results.length === 1 ? "match" : "matches"} for “
          {query}”
        </p>
      )}

      {results.length === 0 ? (
        <p className="mt-10 text-muted-foreground">
          No colleges match “{query}”{area ? ` in ${area}` : ""}.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((c, i) => (
            <CollegeCard
              key={c.id}
              college={c}
              rank={!query && !area ? i + 1 : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}
