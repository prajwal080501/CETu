"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Sparkles, FileText, Bell, ArrowRight } from "lucide-react";

/**
 * Premium "coming soon" screen for Institutional & SPOT round cutoffs, with a
 * multi-layer parallax that responds to both pointer movement and scroll. Each
 * layer declares a depth; background layers drift more than foreground ones, so
 * the scene gains dimensionality as you move the mouse / scroll.
 */
export function SpotComingSoon({ previewCount }: { previewCount: number }) {
  const [p, setP] = useState({ x: 0, y: 0 });
  const [scroll, setScroll] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScroll(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function onMove(e: React.MouseEvent) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => setP({ x, y }));
  }

  // depth > 0 → moves with pointer; scroll adds vertical drift.
  const layer = (depth: number, scrollFactor = 0.06) => ({
    transform: `translate3d(${(p.x * depth).toFixed(2)}px, ${(
      p.y * depth +
      scroll * depth * scrollFactor
    ).toFixed(2)}px, 0)`,
  });

  return (
    <div
      onMouseMove={onMove}
      className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center overflow-hidden px-4 py-16"
    >
      {/* Layer 0 — ambient gradient blobs (deepest) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
        <div
          className="animate-blob absolute left-[12%] top-[8%] h-72 w-72 rounded-full bg-primary/25 blur-[110px]"
          style={layer(48)}
        />
        <div
          className="animate-blob absolute right-[10%] top-[20%] h-80 w-80 rounded-full bg-chart-2/25 blur-[120px]"
          style={{ ...layer(60), animationDelay: "-6s" }}
        />
        <div
          className="animate-blob absolute bottom-[6%] left-[38%] h-64 w-64 rounded-full bg-chart-3/20 blur-[100px]"
          style={{ ...layer(40), animationDelay: "-10s" }}
        />
      </div>

      {/* Layer 1 — dotted grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] [background-image:radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:26px_26px]"
        style={layer(18)}
      />

      {/* Layer 2 — floating chips */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <FloatingChip className="left-[8%] top-[26%]" delay="0s" style={layer(28)}>
          Institute-level round
        </FloatingChip>
        <FloatingChip className="right-[9%] top-[32%]" delay="-2s" style={layer(34)}>
          SPOT admission
        </FloatingChip>
        <FloatingChip className="left-[14%] bottom-[20%]" delay="-4s" style={layer(24)}>
          Vacancy cutoffs
        </FloatingChip>
        <FloatingChip className="right-[14%] bottom-[24%]" delay="-1s" style={layer(30)}>
          Management quota
        </FloatingChip>
      </div>

      {/* Layer 3 — foreground card (moves opposite for pop) */}
      <div
        className="relative w-full max-w-xl"
        style={layer(-10, 0.02)}
      >
        <div className="relative overflow-hidden rounded-3xl border bg-card/70 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
          {/* shimmer sweep */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/10 to-transparent"
            style={{ animation: "shimmer 4.5s ease-in-out infinite" }}
          />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Premium · Coming soon
            </span>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Institutional &amp; SPOT
              <br />
              <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
                round cutoffs
              </span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              After CAP, seats reopen through institute-level, SPOT and vacancy
              rounds — where the real last-mile admissions happen. We&rsquo;re
              building a tracker for these off-CAP rounds: cutoffs, live vacancies
              and direct links to each institute&rsquo;s notice.
            </p>

            {/* Locked preview */}
            <div className="relative mt-6 rounded-xl border">
              <div className="space-y-2 p-4 blur-[3px] select-none">
                {["COEP · SPOT Round", "VJTI · Institute-level", "PICT · Vacancy round"].map(
                  (t) => (
                    <div key={t} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {t}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {(90 + Math.random() * 9).toFixed(2)} %ile
                      </span>
                    </div>
                  )
                )}
              </div>
              <div className="absolute inset-0 grid place-items-center rounded-xl bg-card/40">
                <span className="flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-medium shadow-sm">
                  <Lock className="h-3.5 w-3.5" />
                  {previewCount > 0
                    ? `${previewCount} institute rounds tracked`
                    : "Unlocks with Premium"}
                </span>
              </div>
            </div>

            {/* Notify (visual) */}
            <form
              className="mt-6 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="flex flex-1 items-center gap-2 rounded-xl border bg-background px-3">
                <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Email me when it launches"
                  className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Notify me
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Meanwhile, official SPOT-round PDFs already appear on individual
              college pages under &ldquo;Official documents&rdquo;.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingChip({
  children,
  className,
  delay,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  delay: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`absolute ${className}`} style={style}>
      <div
        className="animate-float rounded-full border bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur"
        style={{ animationDelay: delay }}
      >
        {children}
      </div>
    </div>
  );
}
