"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export interface ChartConfig {
  chartType: "bar" | "line" | "area" | "pie";
  title?: string;
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: string[];
}

function detectChartConfig(
  columns: string[],
  data: Record<string, unknown>[]
): ChartConfig | null {
  if (data.length < 1 || columns.length < 2) return null;

  const toFiniteNumber = (value: unknown): number | null => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const numericCols = columns.filter((col) => {
    let numericCount = 0;
    let invalidCount = 0;
    for (const row of data) {
      const raw = row[col];
      if (raw == null || (typeof raw === "string" && raw.trim() === "")) continue;
      const numeric = toFiniteNumber(raw);
      if (numeric == null) {
        invalidCount += 1;
      } else {
        numericCount += 1;
      }
    }
    return numericCount >= 1 && invalidCount === 0;
  });

  const categoryCols = columns.filter((col) => !numericCols.includes(col));

  if (numericCols.length === 0) return null;

  const xKey = categoryCols[0] ?? columns[0];
  const yKeys = numericCols.filter((c) => c !== xKey).slice(0, 5);
  if (yKeys.length === 0) return null;

  const chartType =
    data.length <= 8 && yKeys.length === 1
      ? "bar"
      : data.length > 20
        ? "line"
        : "bar";

  const mappedData = data
    .map((row) => {
      const mapped: Record<string, unknown> = { [xKey]: row[xKey] };
      let hasMetric = false;
      for (const key of yKeys) {
        const numeric = toFiniteNumber(row[key]);
        if (numeric == null) continue;
        mapped[key] = numeric;
        hasMetric = true;
      }
      return hasMetric ? mapped : null;
    })
    .filter((row): row is Record<string, unknown> => row !== null);

  if (mappedData.length < 1) return null;

  return {
    chartType,
    data: mappedData,
    xKey,
    yKeys,
  };
}

export function ChartRenderer({ config }: { config: ChartConfig }) {
  const { chartType, title, data, xKey, yKeys } = config;

  return (
    <div className="space-y-2">
      {title && (
        <p className="text-xs font-medium text-muted-foreground px-1">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={240}>
        {chartType === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            {yKeys.length > 1 && <Legend />}
            {yKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : chartType === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            {yKeys.length > 1 && <Legend />}
            {yKeys.map((key, i) => (
              <Line key={key} dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        ) : chartType === "area" ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            {yKeys.map((key, i) => (
              <Area key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.3} />
            ))}
          </AreaChart>
        ) : (
          <PieChart>
            <Pie data={data} dataKey={yKeys[0]} nameKey={xKey} cx="50%" cy="50%" outerRadius={80} label>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export { detectChartConfig };
