"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Single-series bars: one colour (--chart-bar, validated in light and dark), no legend box,
// thin bars with a 4px rounded data end, hairline grid, tooltip on hover (dataviz spec).
const BAR = "var(--chart-bar)";
const GRID = "var(--chart-grid)";
const TICK = { fill: "var(--muted-foreground)", fontSize: 12 };

type TipProps = { active?: boolean; payload?: readonly { value?: unknown }[]; label?: unknown };

function ChartTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10">
      <p className="font-medium">{String(label)}</p>
      <p className="text-muted-foreground tabular-nums">เสร็จ {String(payload[0].value)} งาน</p>
    </div>
  );
}

export function MonthlyDoneChart({ data }: { data: { label: string; done: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="กราฟแท่งจำนวนงานที่เสร็จรายเดือน">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={8} />
          <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} width={40} />
          <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
          <Bar dataKey="done" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryDoneChart({ data }: { data: { name: string; done: number }[] }) {
  const height = Math.max(120, data.length * 40 + 24);
  return (
    <div className="w-full" style={{ height }} role="img" aria-label="กราฟแท่งจำนวนงานที่เสร็จแยกตามหมวดหมู่">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={TICK} tickLine={false} axisLine={false} width={110} />
          <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
          <Bar
            dataKey="done"
            fill={BAR}
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
            isAnimationActive={false}
            label={{ position: "right", fill: "var(--foreground)", fontSize: 12 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
