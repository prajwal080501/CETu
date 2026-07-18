/**
 * Sequential single-hue magnitude heatmap: a responsive grid of city cells
 * tinted by `value` (min→max normalized). Used for both admission-demand
 * (closing percentile) and job-market (median salary) heatmaps. Cells with a
 * null value render muted ("no data") rather than mid-scale, so absence never
 * reads as a real magnitude.
 */
export type HeatItem = {
  label: string;
  value: number | null;
  sub?: string;
};

export function HeatGrid({
  items,
  format,
  hue = "var(--chart-1)",
}: {
  items: HeatItem[];
  format: (v: number) => string;
  hue?: string;
}) {
  const vals = items.map((i) => i.value).filter((v): v is number => v != null);
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 1;
  const span = max - min || 1;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {items.map((it) => {
        const has = it.value != null;
        // 8%→82% fill by normalized magnitude; readable text flip past ~48%.
        const t = has ? (it.value! - min) / span : 0;
        const alpha = has ? 8 + Math.round(t * 74) : 0;
        const strong = t >= 0.48;
        return (
          <div
            key={it.label}
            className={`rounded-xl border p-3 transition-colors ${
              has ? "" : "border-dashed bg-muted/20"
            }`}
            style={
              has
                ? {
                    backgroundColor: `color-mix(in oklab, ${hue} ${alpha}%, var(--card))`,
                    borderColor: `color-mix(in oklab, ${hue} ${Math.min(
                      alpha + 10,
                      70
                    )}%, var(--border))`,
                  }
                : undefined
            }
          >
            <div
              className={`truncate text-sm font-medium ${
                strong ? "text-primary-foreground" : ""
              }`}
              title={it.label}
            >
              {it.label}
            </div>
            <div
              className={`mt-1 text-lg font-bold tabular-nums ${
                strong ? "text-primary-foreground" : has ? "" : "text-muted-foreground"
              }`}
            >
              {has ? format(it.value!) : "—"}
            </div>
            {it.sub && (
              <div
                className={`mt-0.5 text-[11px] ${
                  strong
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground"
                }`}
              >
                {it.sub}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
