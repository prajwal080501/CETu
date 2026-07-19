/**
 * Sequential single-hue magnitude heatmap: a responsive grid of city cells
 * tinted by `value` (min→max normalized). Used for both admission-demand
 * (closing percentile) and job-market (median salary) heatmaps. Cells with a
 * null value render muted ("no data") rather than mid-scale, so absence never
 * reads as a real magnitude.
 */
import { memo, useMemo, useCallback } from "react";

export type HeatItem = {
  label: string;
  value: number | null;
  sub?: string;
};

// Memoized cell component to prevent unnecessary re-renders
const HeatCellBase = ({
  item,
  min,
  span,
  hue,
  format,
}: {
  item: HeatItem;
  min: number;
  span: number;
  hue: string;
  format: (v: number) => string;
}) => {
  const has = item.value != null;
  const t = has ? (item.value! - min) / span : 0;
  const alpha = has ? 8 + Math.round(t * 74) : 0;
  const strong = t >= 0.48;

  return (
    <div
      key={item.label}
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
        title={item.label}
      >
        {item.label}
      </div>
      <div
        className={`mt-1 text-lg font-bold tabular-nums ${
          strong ? "text-primary-foreground" : has ? "" : "text-muted-foreground"
        }`}
      >
        {has ? format(item.value!) : "—"}
      </div>
      {item.sub && (
        <div
          className={`mt-0.5 text-[11px] ${
            strong
              ? "text-primary-foreground/80"
              : "text-muted-foreground"
          }`}
        >
          {item.sub}
        </div>
      )}
    </div>
  );
};

const HeatCell = memo(HeatCellBase);

function HeatGridBase({
  items,
  format,
  hue = "var(--chart-1)",
}: {
  items: HeatItem[];
  format: (v: number) => string;
  hue?: string;
}) {
  // Memoize min/max calculation to avoid recomputing on every render
  const { min, max, span } = useMemo(() => {
    const vals = items.map((i) => i.value).filter((v): v is number => v != null);
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 1;
    const span = max - min || 1;
    return { min, max, span };
  }, [items]);

  const memoizedFormat = useCallback(format, [format]);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {items.map((it) => (
        <HeatCell
          key={it.label}
          item={it}
          min={min}
          span={span}
          hue={hue}
          format={memoizedFormat}
        />
      ))}
    </div>
  );
}

export const HeatGrid = memo(HeatGridBase);

