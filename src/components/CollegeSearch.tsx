"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, CornerDownLeft } from "lucide-react";
import { searchColleges } from "@/lib/search";
import type { SearchDoc } from "@/lib/landing";

/**
 * Live typeahead: filters colleges intelligently on every keystroke and lets
 * the user jump straight to a college — no submit button. Enter opens the
 * highlighted result (or the full results page for the query if none active).
 */
export function CollegeSearch({
  docs,
  placeholder = "Search a college, city or university…",
}: {
  docs: SearchDoc[];
  placeholder?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => (q.trim() ? searchColleges(docs, q, 8) : []),
    [q, docs]
  );

  useEffect(() => setActive(0), [q]);

  // Close on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(slug: string) {
    setOpen(false);
    router.push(`/colleges/${slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) go(results[active].slug);
      else if (q.trim()) router.push(`/colleges?q=${encodeURIComponent(q.trim())}`);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showMenu = open && q.trim().length > 0;

  return (
    <div ref={boxRef} className="relative max-w-2xl">
      <div className="flex items-center gap-2 rounded-2xl border bg-card/80 p-2 shadow-sm ring-1 ring-transparent backdrop-blur transition focus-within:ring-primary/40">
        <Search className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={showMenu}
          aria-controls="college-search-list"
          autoComplete="off"
          className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <kbd className="mr-1 hidden items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:flex">
            <CornerDownLeft className="h-3 w-3" /> open
          </kbd>
        )}
      </div>

      {showMenu && (
        <div
          id="college-search-list"
          role="listbox"
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border bg-popover shadow-lg"
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No colleges match “{q.trim()}”.
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r, i) => (
                <li key={r.slug} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.slug)}
                    className={`flex w-full items-start gap-3 px-3 py-2 text-left transition-colors ${
                      i === active ? "bg-accent" : ""
                    }`}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {r.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[r.city, r.university].filter(Boolean).join(" · ") ||
                          "Maharashtra"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim() && (
            <button
              type="button"
              onClick={() =>
                router.push(`/colleges?q=${encodeURIComponent(q.trim())}`)
              }
              className="flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-xs font-medium text-primary transition-colors hover:bg-accent"
            >
              <Search className="h-3.5 w-3.5" />
              See all results for “{q.trim()}” →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
