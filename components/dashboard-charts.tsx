"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, ChartNoAxesCombined, UsersRound } from "lucide-react";
import type { DashboardAnalytics } from "@/lib/hr-data";

const departmentColors = [
  "#153e66",
  "#2563eb",
  "#60a5fa",
  "#93c5fd",
  "#bfdbfe",
  "#dbeafe",
];
const tooltipStyle = {
  border: "1px solid #dce3ec",
  borderRadius: "8px",
  boxShadow: "0 8px 24px rgba(15,23,42,.08)",
  fontSize: "12px",
};

export function DashboardCharts({
  analytics,
}: {
  analytics: DashboardAnalytics;
}) {
  const totalHeadcount = analytics.departments.reduce(
    (total, item) => total + item.value,
    0,
  );
  const latest = analytics.trend.at(-1);
  const previous = analytics.trend.at(-2);
  const change = previous?.applications
    ? Math.round(
        ((Number(latest?.applications) - previous.applications) /
          previous.applications) *
          100,
      )
    : 0;

  return (
    <section className="grid min-w-0 gap-6 xl:grid-cols-[1.45fr_.75fr]">
      <article className="min-w-0 overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgb(15,23,42,0.05)] ring-1 ring-slate-200/70">
        <ChartHeader
          title="Hiring activity"
          description="Applications received and employees hired"
          aside={
            <div className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
              <ArrowUpRight className="h-3.5 w-3.5" />
              {change >= 0 ? "+" : ""}
              {change}% applications
            </div>
          }
        />
        <div className="px-3 pb-4 pt-5 sm:px-5">
          <div className="mb-3 flex flex-wrap items-center gap-5 px-2 text-[11px] text-slate-500">
            <LegendDot color="#2563eb" label="Applications" />
            <LegendDot color="#153e66" label="Hires" />
            <span className="ml-auto text-slate-400">Last 6 months</span>
          </div>
          <div className="h-[260px] w-full min-w-0 sm:h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={analytics.trend}
                margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="applicationsFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} />
                    <stop
                      offset="100%"
                      stopColor="#2563eb"
                      stopOpacity={0.01}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="#e8edf3"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }}
                />
                <Area
                  type="monotone"
                  dataKey="applications"
                  name="Applications"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#applicationsFill)"
                  activeDot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="hires"
                  name="Hires"
                  stroke="#153e66"
                  strokeWidth={2}
                  fill="transparent"
                  activeDot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </article>

      <article className="min-w-0 overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgb(15,23,42,0.05)] ring-1 ring-slate-200/70">
        <ChartHeader
          title="Workforce distribution"
          description="Active employees by department"
        />
        <div className="grid min-h-[338px] items-center gap-2 px-5 py-4 sm:grid-cols-[1.1fr_.9fr] xl:grid-cols-1 2xl:grid-cols-[1.1fr_.9fr]">
          <div className="relative mx-auto h-[190px] w-full min-w-0 max-w-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.departments}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="62%"
                  outerRadius="86%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {analytics.departments.map((item, index) => (
                    <Cell
                      key={item.name}
                      fill={departmentColors[index % departmentColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-2xl font-semibold tracking-[-.04em] text-slate-900">
                  {totalHeadcount.toLocaleString()}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[.08em] text-slate-400">
                  Employees
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2.5">
            {analytics.departments.map((item, index) => (
              <div className="flex items-center gap-2.5" key={item.name}>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      departmentColors[index % departmentColors.length],
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600">
                  {item.name}
                </span>
                <span className="text-[11px] font-semibold text-slate-800">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </article>

      <article className="min-w-0 overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgb(15,23,42,0.05)] ring-1 ring-slate-200/70 xl:col-span-2">
        <ChartHeader
          title="Recruitment pipeline"
          description="Current candidates at each active stage"
          aside={
            <span className="text-[11px] text-slate-400">Snapshot today</span>
          }
        />
        <div className="grid gap-5 px-4 py-5 lg:grid-cols-[1fr_260px] lg:px-5">
          <div className="h-[250px] min-w-0 sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.pipeline}
                layout="vertical"
                margin={{ top: 0, right: 18, left: 4, bottom: 0 }}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="#e8edf3"
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="stage"
                  width={86}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "#eff6ff" }}
                />
                <Bar
                  dataKey="candidates"
                  name="Candidates"
                  fill="#2563eb"
                  radius={[0, 5, 5, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col justify-center rounded-2xl bg-slate-50 p-5">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-100 text-brand-700">
              <ChartNoAxesCombined className="h-4 w-4" />
            </span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[.08em] text-slate-400">
              Pipeline conversion
            </p>
            <div className="mt-2 text-3xl font-semibold tracking-[-.04em] text-slate-900">
              {conversionRate(analytics.pipeline)}%
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              From application to hire for candidates in the current pipeline.
            </p>
            <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
              <UsersRound className="h-4 w-4 text-brand-600" />
              {analytics.pipeline.reduce(
                (sum, item) => sum + item.candidates,
                0,
              )}{" "}
              stage placements
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

function ChartHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[66px] items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      </div>
      {aside}
    </div>
  );
}
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
function conversionRate(pipeline: DashboardAnalytics["pipeline"]) {
  const applied =
    pipeline.find((item) => item.stage.toLowerCase() === "applied")
      ?.candidates || 0;
  const hired =
    pipeline.find((item) => item.stage.toLowerCase() === "hired")?.candidates ||
    0;
  return applied ? Math.round((hired / applied) * 100) : 0;
}
