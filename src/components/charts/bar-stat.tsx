"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * Interactive horizontal bar chart (Recharts + shadcn Chart). Magnitude data
 * uses a single chart hue; hover shows a tooltip, values are direct-labeled.
 */
export function BarStat({
  data,
  label,
  color = "var(--chart-1)",
  formatValue = (n) => n.toLocaleString(),
}: {
  data: { label: string; value: number }[];
  label: string;
  color?: string;
  formatValue?: (n: number) => string;
}) {
  const config = {
    value: { label, color },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ left: 6, right: 40, top: 4, bottom: 4 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <YAxis
          dataKey="label"
          type="category"
          tickLine={false}
          axisLine={false}
          width={120}
          tick={{ fontSize: 12 }}
        />
        <XAxis type="number" hide />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          content={
            <ChartTooltipContent
              formatter={(v) => formatValue(Number(v))}
              hideIndicator={false}
            />
          }
        />
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 6, 6, 0]}>
          <LabelList
            dataKey="value"
            position="right"
            className="fill-muted-foreground"
            fontSize={11}
            formatter={(v) => formatValue(Number(v))}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
