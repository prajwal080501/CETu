"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";

/**
 * Reusable searchable multi-select. The dropdown is portaled to <body> with
 * fixed positioning anchored to the trigger, so it's never clipped by an
 * `overflow-hidden` container (e.g. the form card). `triggerClassName` lets it
 * look like a form field or a compact pill.
 */
export function MultiSelectFilter({
  placeholder,
  options,
  selected,
  onToggle,
  onClear,
  triggerClassName,
}: {
  placeholder: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onClear: () => void;
  triggerClassName?: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, 240);
      const left = Math.min(r.left, window.innerWidth - width - 8);
      setPos({ top: r.bottom + 4, left: Math.max(8, left), width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const filtered = q
    ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase()))
    : options;
  const n = selected.size;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          triggerClassName ??
          "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
        }
      >
        <span className={`truncate ${n ? "" : "text-muted-foreground"}`}>
          {n ? `${n} selected` : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>

      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
            <div
              style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 100 }}
              className="rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg"
            >
              <div className="relative mb-1">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</p>
                ) : (
                  filtered.map((o) => (
                    <label
                      key={o}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(o)}
                        onChange={() => onToggle(o)}
                        className="accent-primary"
                      />
                      <span className="truncate">{o}</span>
                    </label>
                  ))
                )}
              </div>
              {n > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="mt-1 w-full rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                >
                  Clear ({n})
                </button>
              )}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
