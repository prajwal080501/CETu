import { SEAT_TYPE_LABELS, type SeatType } from "@/lib/reference";

type Point = Record<string, number | string>;

/**
 * Multi-year closing-percentile trend, one line per seat type.
 * Server-rendered inline SVG (no chart dependency): recessive grid, thin 2px
 * lines, >=8px markers, a legend (identity never by color alone) and direct
 * end-labels. Colours are the validated categorical slots 1-3 (blue/green/
 * magenta), theme-aware via CSS custom properties.
 */

// Validated categorical slots (see dataviz palette), assigned in fixed order.
const SERIES_COLORS: Record<SeatType, { light: string; dark: string }> = {
  HU: { light: "#2a78d6", dark: "#3987e5" }, // blue
  OHU: { light: "#008300", dark: "#008300" }, // green
  SL: { light: "#e87ba4", dark: "#d55181" }, // magenta
  HU_OHU: { light: "#eda100", dark: "#c98500" }, // yellow
  AI: { light: "#1baf7a", dark: "#199e70" }, // aqua
  MI: { light: "#eb6834", dark: "#d95926" }, // orange
  INST: { light: "#4a3aa7", dark: "#9085e9" }, // violet
};

// Generate the CSS custom-property list for one theme (avoids per-var drift).
const cssVars = (mode: "light" | "dark") =>
  (Object.keys(SERIES_COLORS) as SeatType[])
    .map((st) => `--s-${st}:${SERIES_COLORS[st][mode]};`)
    .join(" ");

export function CutoffTrend({
  data,
  seatTypes,
}: {
  data: Point[];
  seatTypes: SeatType[];
}) {
  const W = 560;
  const H = 220;
  const pad = { top: 16, right: 44, bottom: 28, left: 40 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const years = data.map((d) => Number(d.year));
  const values: number[] = [];
  for (const d of data)
    for (const st of seatTypes)
      if (typeof d[st] === "number") values.push(d[st] as number);
  if (values.length === 0 || years.length < 2) return null;

  const yMinRaw = Math.min(...values);
  const yMaxRaw = Math.max(...values);
  // Zoom the y-domain to the data (percentiles cluster tightly near the top),
  // with a little padding so lines don't touch the frame.
  const padY = Math.max((yMaxRaw - yMinRaw) * 0.2, 0.1);
  const yMin = yMinRaw - padY;
  const yMax = yMaxRaw + padY;

  const xMin = Math.min(...years);
  const xMax = Math.max(...years);
  const x = (year: number) =>
    pad.left +
    (xMax === xMin ? plotW / 2 : ((year - xMin) / (xMax - xMin)) * plotW);
  const y = (v: number) =>
    pad.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const yTicks = 3;
  const tickVals = Array.from(
    { length: yTicks + 1 },
    (_, i) => yMin + ((yMax - yMin) * i) / yTicks
  );

  return (
    <div className="cutoff-trend overflow-x-auto">
      <style>{`
        .cutoff-trend { --grid:#e1e0d9; --axis:#c3c2b7; --muted:#898781; ${cssVars("light")} }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .cutoff-trend { --grid:#2c2c2a; --axis:#383835; --muted:#898781; ${cssVars("dark")} }
        }
        :root[data-theme="dark"] .cutoff-trend { --grid:#2c2c2a; --axis:#383835; ${cssVars("dark")} }
      `}</style>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label="Closing percentile trend by seat type"
        className="max-w-full"
      >
        {/* gridlines + y ticks */}
        {tickVals.map((tv, i) => (
          <g key={i}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(tv)}
              y2={y(tv)}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text
              x={pad.left - 6}
              y={y(tv) + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--muted)"
            >
              {tv.toFixed(1)}
            </text>
          </g>
        ))}

        {/* x labels (years) */}
        {years.map((yr) => (
          <text
            key={yr}
            x={x(yr)}
            y={H - 8}
            textAnchor="middle"
            fontSize={10}
            fill="var(--muted)"
          >
            {yr}
          </text>
        ))}

        {/* series */}
        {seatTypes.map((st) => {
          const pts = data
            .filter((d) => typeof d[st] === "number")
            .map((d) => ({ yr: Number(d.year), v: d[st] as number }))
            .sort((a, b) => a.yr - b.yr);
          if (pts.length === 0) return null;
          const path = pts
            .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.yr)},${y(p.v)}`)
            .join(" ");
          const last = pts[pts.length - 1];
          return (
            <g key={st} stroke={`var(--s-${st})`} fill={`var(--s-${st})`}>
              <path d={path} fill="none" strokeWidth={2} />
              {pts.map((p) => (
                <circle key={p.yr} cx={x(p.yr)} cy={y(p.v)} r={4}>
                  <title>
                    {SEAT_TYPE_LABELS[st]} {p.yr}: {p.v.toFixed(2)} percentile
                  </title>
                </circle>
              ))}
              {/* direct end-label so identity is not color-alone */}
              <text
                x={x(last.yr) + 6}
                y={y(last.v) + 3}
                fontSize={10}
                stroke="none"
                fill={`var(--s-${st})`}
                fontWeight={600}
              >
                {st}
              </text>
            </g>
          );
        })}
      </svg>

      {/* legend */}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/60 dark:text-white/60">
        {seatTypes.map((st) => (
          <span key={st} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: `var(--s-${st})` }}
            />
            {SEAT_TYPE_LABELS[st]}
          </span>
        ))}
      </div>
    </div>
  );
}
