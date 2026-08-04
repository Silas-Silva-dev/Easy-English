"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.6rem",
  fontSize: "0.8rem",
  color: "var(--popover-foreground)",
  boxShadow: "0 8px 24px -12px rgb(0 0 0 / 0.3)",
} as const;

export interface SpeakingPoint {
  date: string;
  geral: number;
  pronuncia: number;
  fluencia: number;
  gramatica: number;
  vocabulario: number;
}

/** Evolução das notas de fala ao longo do tempo. */
export function SpeakingTrendChart({ data }: { data: SpeakingPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" {...AXIS} />
        <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} {...AXIS} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: "0.75rem", paddingTop: 10 }} />
        <Line
          type="monotone"
          dataKey="geral"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line type="monotone" dataKey="pronuncia" stroke="var(--chart-2)" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="fluencia" stroke="var(--chart-3)" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="gramatica" stroke="var(--chart-4)" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="vocabulario" stroke="var(--chart-5)" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Minutos estudados por dia. */
export function StudyMinutesChart({
  data,
  goal,
}: {
  data: { date: string; minutos: number }[];
  goal: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" {...AXIS} />
        <YAxis {...AXIS} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)", opacity: 0.45 }} />
        <Bar
          dataKey="minutos"
          fill="var(--chart-1)"
          radius={[4, 4, 0, 0]}
          maxBarSize={26}
          name={`minutos (meta ${goal})`}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Crescimento acumulado: usado no painel administrativo. */
export function GrowthAreaChart({
  data,
  dataKey,
  label,
}: {
  data: { date: string; value: number }[];
  dataKey?: string;
  label: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" {...AXIS} />
        <YAxis {...AXIS} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Area
          type="monotone"
          dataKey={dataKey ?? "value"}
          name={label}
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#growthFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
