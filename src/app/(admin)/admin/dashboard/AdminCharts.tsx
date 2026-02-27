"use client";

/**
 * AdminCharts — lazy-loaded recharts wrapper.
 * Keeps ~200 KB of recharts out of the main admin dashboard bundle.
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

const LEVEL_COLORS = ["#6ECFC9", "#9B8AF5", "#FF7B5C", "#6ECFC9", "#F5C842"];
const PAYMENT_COLORS: Record<string, string> = {
  successful: "#6ECFC9",
  pending: "#F5C842",
  failed: "#FF7B5C",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-snow border-[3px] border-navy rounded-2xl px-4 py-3 shadow-[3px_3px_0_0_#000]">
        <p className="font-display font-black text-navy text-sm">{label}</p>
        <p className="text-navy/70 font-bold text-sm">{payload[0].value}</p>
      </div>
    );
  }
  return null;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

interface ChartDatum {
  [key: string]: string | number;
}

interface AdminChartsProps {
  type: "bar" | "pie";
  data: ChartDatum[];
}

export default function AdminCharts({ type, data }: AdminChartsProps) {
  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barSize={36}>
          <XAxis
            dataKey="level"
            tick={{ fontFamily: "inherit", fontSize: 11, fontWeight: 700, fill: "#3F3F5C" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontFamily: "inherit", fontSize: 11, fill: "#3F3F5C" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(200,243,29,0.08)" }} />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((_: ChartDatum, i: number) => (
              <Cell key={i} fill={LEVEL_COLORS[i % LEVEL_COLORS.length]} stroke="#0F0F2D" strokeWidth={2} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Pie chart
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={70}
          strokeWidth={2}
          stroke="#0F0F2D"
        >
          {data.map((entry: ChartDatum, i: number) => (
            <Cell key={i} fill={PAYMENT_COLORS[entry.name as string] ?? LEVEL_COLORS[i % LEVEL_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => (
            <span className="font-display font-black text-xs capitalize text-navy">
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
