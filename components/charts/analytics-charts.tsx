"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils/format";
import type { TimeSeriesPoint, GroupCount, DepartmentWorkload } from "@/lib/queries/analytics";

const TERRA = "#bf4726";
const GREEN = "#4d8a5b";
const BLUE = "#3f6f9f";
const AMBER = "#d9930d";
const PURPLE = "#7a5aa6";
const MUTED = "#b7afa3";
const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: BLUE,
  UNDER_REVIEW: AMBER,
  WAITING_FOR_INFORMATION: AMBER,
  VERIFIED: GREEN,
  ASSIGNED: BLUE,
  IN_PROGRESS: PURPLE,
  RESOLVED: GREEN,
  CLOSED: MUTED,
  REJECTED: "#c04545",
  REOPENED: TERRA,
  ESCALATED: "#c04545",
  LOW: GREEN,
  MEDIUM: BLUE,
  HIGH: AMBER,
  CRITICAL: "#c04545",
};

function Panel({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`min-w-0 p-4 sm:p-5 ${className}`}>
      <div className="mb-3">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] text-ink-muted">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

export function IssuesTrendChart({ data }: { data: TimeSeriesPoint[] }) {
  const formatted = data.map((point) => ({
    ...point,
    dateLabel: new Date(`${point.label}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
  }));
  return (
    <Panel title="Reports and resolutions" subtitle="Daily totals over the last 30 days">
      <div className="h-64 w-full" role="img" aria-label="Area chart of issues reported and resolved each day over the last 30 days">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="reportedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={TERRA} stopOpacity={0.24} /><stop offset="95%" stopColor={TERRA} stopOpacity={0.02} /></linearGradient>
              <linearGradient id="resolvedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GREEN} stopOpacity={0.24} /><stop offset="95%" stopColor={GREEN} stopOpacity={0.02} /></linearGradient>
            </defs>
            <CartesianGrid stroke="#eee8df" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dateLabel" tick={{ fill: "#827a70", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={18} />
            <YAxis allowDecimals={false} tick={{ fill: "#827a70", fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip labelFormatter={(label) => String(label)} formatter={(value, name) => [formatNumber(Number(value)), name === "reported" ? "Reported" : "Resolved"]} contentStyle={{ borderRadius: 10, borderColor: "#e7dfd2", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => value === "reported" ? "Reported" : "Resolved"} />
            <Area type="monotone" dataKey="reported" stroke={TERRA} fill="url(#reportedFill)" strokeWidth={2} isAnimationActive={false} />
            <Area type="monotone" dataKey="resolved" stroke={GREEN} fill="url(#resolvedFill)" strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export function StatusDonutChart({ data }: { data: GroupCount[] }) {
  const colors = data.map((item) => STATUS_COLORS[item.name] ?? BLUE);
  return (
    <Panel title="Issue status" subtitle="Current reports grouped by lifecycle stage">
      {data.length ? (
        <div className="flex items-center gap-2">
          <div className="h-56 min-w-0 flex-1" role="img" aria-label="Doughnut chart showing issue counts by status">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {data.map((item, index) => <Cell key={`${item.name}-${index}`} fill={colors[index]} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [formatNumber(Number(value)), String(name).replaceAll("_", " ").toLowerCase()]} contentStyle={{ borderRadius: 10, borderColor: "#e7dfd2", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="max-h-52 min-w-28 space-y-1 overflow-y-auto text-[10px] sm:min-w-36 sm:text-[11px]">
            {data.map((item, index) => <li key={item.name} className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors[index] }} aria-hidden /><span className="min-w-0 flex-1 truncate text-ink-muted">{item.name.replaceAll("_", " ").toLowerCase()}</span><span className="font-semibold text-ink">{formatNumber(item.count)}</span></li>)}
          </ul>
        </div>
      ) : <ChartEmpty />}
    </Panel>
  );
}

export function CategoryBarChart({ data, title = "Issues by category" }: { data: GroupCount[]; title?: string }) {
  const rows = data.slice(0, 8).map((item) => ({ ...item, label: item.name.length > 22 ? `${item.name.slice(0, 21)}…` : item.name }));
  return (
    <Panel title={title} subtitle="Most frequently reported categories">
      {rows.length ? (
        <div className="h-64 w-full" role="img" aria-label="Bar chart of issue counts by category">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#eee8df" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "#827a70", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" width={105} tick={{ fill: "#625b52", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => [formatNumber(Number(value)), "Reports"]} contentStyle={{ borderRadius: 10, borderColor: "#e7dfd2", fontSize: 12 }} />
              <Bar dataKey="count" fill={TERRA} radius={[0, 5, 5, 0]} barSize={16} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <ChartEmpty />}
    </Panel>
  );
}

export function PriorityChart({ data }: { data: GroupCount[] }) {
  const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const sorted = [...data].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  return (
    <Panel title="Open workload by priority" subtitle="Priority is based on an explainable 0–100 score">
      {sorted.length ? (
        <div className="space-y-3 py-2">
          {sorted.map((item) => {
            const max = Math.max(1, ...sorted.map((entry) => entry.count));
            return <div key={item.name}><div className="mb-1 flex justify-between text-xs"><span className="font-semibold text-ink-soft">{item.name}</span><span className="text-ink-muted">{formatNumber(item.count)}</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${Math.max(item.count ? 3 : 0, (item.count / max) * 100)}%`, backgroundColor: STATUS_COLORS[item.name] ?? BLUE }} /></div></div>;
          })}
        </div>
      ) : <ChartEmpty />}
    </Panel>
  );
}

export function DepartmentWorkloadChart({ data }: { data: DepartmentWorkload[] }) {
  const rows = data.slice(0, 8).map((item) => ({ name: item.name.length > 20 ? `${item.name.slice(0, 19)}…` : item.name, open: item.open, resolved: item.resolved30d }));
  return (
    <Panel title="Department workload" subtitle="Open cases and resolutions in the last 30 days">
      {rows.length ? (
        <div className="h-64 w-full" role="img" aria-label="Bar chart of workload by department">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#eee8df" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#827a70", fontSize: 9 }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fill: "#827a70", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#e7dfd2", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="open" name="Open" fill={TERRA} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="resolved" name="Resolved (30d)" fill={GREEN} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <ChartEmpty />}
    </Panel>
  );
}

function ChartEmpty() {
  return <div className="flex h-52 items-center justify-center rounded-xl bg-surface-2/70 text-center text-xs text-ink-muted">No analytics to chart yet.</div>;
}
