/**
 * Simple horizontal bar chart for magnitude data (seats, college counts).
 * Magnitude => a single hue (dataviz rule). Server-rendered, theme-aware via
 * CSS vars, values direct-labeled at the end of each bar. Wide content scrolls.
 */
export function HBarChart({
  data,
  format = (n) => n.toLocaleString(),
}: {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="hbar space-y-2">
      <style>{`
        .hbar { --track:#eceae3; --bar:#2a78d6; }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .hbar { --track:#26261f; --bar:#3987e5; }
        }
        :root[data-theme="dark"] .hbar { --track:#26261f; --bar:#3987e5; }
      `}</style>
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3 text-sm">
          <span className="w-36 shrink-0 truncate text-black/70 dark:text-white/70">
            {d.label}
          </span>
          <div
            className="h-6 flex-1 rounded"
            style={{ background: "var(--track)" }}
          >
            <div
              className="flex h-6 items-center justify-end rounded pr-2 text-[11px] font-medium text-white"
              style={{
                width: `${Math.max((100 * d.value) / max, 8)}%`,
                background: "var(--bar)",
              }}
            >
              {format(d.value)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
