import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorState, LoadingState, SelectLookup } from "../components/FormTools";
import { api } from "../lib/api";
import { brandName, companyLogoSrc, companyName, companyProfile } from "../lib/brand";
import { months } from "../lib/enums";
import { formatCurrency, formatFixed, formatHours, formatNumber } from "../lib/format";
import { useLookups } from "../hooks/useLookups";

type DashboardData = {
  kpis?: Record<string, number>;
  charts?: Record<string, any[]>;
};

type WorkingHourRow = {
  year: number;
  month: number;
  totalEmployees?: number;
  regularHours?: string | number;
  overtimeHours?: string | number;
  department?: { id: string; name: string } | null;
};

type MiniItem = { name: string; count?: number; value?: number; [key: string]: unknown };

type PanelProps = {
  index: number;
  title: string;
  className?: string;
  badge?: string;
  children: React.ReactNode;
};

const dashboardColors = {
  teal: "#25e0db",
  cyan: "#45c8ff",
  blue: "#5b8cff",
  gold: "#f7bd28",
  orange: "#ff8f2f",
  green: "#9eea5b",
  purple: "#a879ff",
  red: "#ff4b55",
  slate: "#8aa0b6",
};

const donutColors = [dashboardColors.teal, dashboardColors.blue, dashboardColors.gold, dashboardColors.purple, dashboardColors.orange, dashboardColors.green, dashboardColors.red];

function valueOf(value: unknown) {
  return Number(value || 0);
}

function shortLabel(value: unknown, max = 16) {
  const text = String(value || "-");
  return text.length > max ? text.slice(0, max - 1) + "..." : text;
}

function hasValues(items: any[] | undefined, keys = ["count", "value"]) {
  return Boolean(items?.some((item) => keys.some((key) => valueOf(item?.[key]) > 0)));
}

function movingAverage(items: any[], key: string) {
  return items.map((item, index) => {
    const slice = items.slice(Math.max(0, index - 2), index + 1);
    const total = slice.reduce((sum, row) => sum + valueOf(row[key]), 0);
    return { ...item, movingAverage: slice.length ? Number((total / slice.length).toFixed(2)) : 0 };
  });
}

function ratePerMillion(value: unknown, hours: unknown) {
  const exposure = valueOf(hours);
  return exposure > 0 ? (valueOf(value) * 1000000) / exposure : 0;
}

function Panel({ index, title, className = "", badge, children }: PanelProps) {
  return (
    <section className={"master-panel " + className}>
      <header className="master-panel-title">
        <h2><span>{index}.</span> {title}</h2>
        {badge && <strong>{badge}</strong>}
      </header>
      {children}
    </section>
  );
}

function EmptyPanel() {
  return <div className="master-empty">No data for selected filters</div>;
}

function MasterTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="master-tooltip">
      <strong>{label}</strong>
      {payload.map((entry: any) => <span key={entry.name}>{entry.name}: {typeof entry.value === "number" ? formatNumber(entry.value, 2) : entry.value}</span>)}
    </div>
  );
}

function KpiCard({ label, value, sublabel, tone, icon }: { label: string; value: string; sublabel: string; tone: string; icon: string }) {
  return (
    <div className={"master-kpi " + tone}>
      <div className="master-kpi-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{sublabel}</small>
      </div>
    </div>
  );
}

function HorizontalBars({ data, color, valueKey = "count", xMaxPadding = 1 }: { data: MiniItem[]; color: string; valueKey?: string; xMaxPadding?: number }) {
  const rows = data.slice(0, 6);
  if (!hasValues(rows, [valueKey])) return <EmptyPanel />;
  const maxValue = Math.max(...rows.map((item) => valueOf(item[valueKey])), 1) + xMaxPadding;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid stroke="rgba(148,163,184,.12)" horizontal={false} />
        <XAxis type="number" domain={[0, maxValue]} tick={{ fill: "#b8c7d9", fontSize: 11 }} axisLine={{ stroke: "rgba(148,163,184,.38)" }} tickLine={false} />
        <YAxis type="category" dataKey="name" width={92} tickFormatter={(v) => shortLabel(v, 15)} tick={{ fill: "#f3f7fb", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<MasterTooltip />} cursor={{ fill: "rgba(255,255,255,.04)" }} />
        <Bar dataKey={valueKey} fill={color} radius={[0, 4, 4, 0]} barSize={18}>
          {rows.map((_, index) => <Cell key={index} fill={color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DonutChart({ data, centerValue, centerLabel }: { data: MiniItem[]; centerValue: string; centerLabel: string }) {
  const rows = data.filter((item) => valueOf(item.count) > 0);
  if (!rows.length) return <EmptyPanel />;
  return (
    <div className="master-donut-wrap">
      <ResponsiveContainer width="48%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="count" nameKey="name" innerRadius="50%" outerRadius="82%" paddingAngle={2}>
            {rows.map((_, index) => <Cell key={index} fill={donutColors[index % donutColors.length]} />)}
          </Pie>
          <Tooltip content={<MasterTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="master-donut-center"><strong>{centerValue}</strong><span>{centerLabel}</span></div>
      <div className="master-legend">
        {rows.map((item, index) => (
          <span key={item.name}><i style={{ background: donutColors[index % donutColors.length] }} />{item.name}</span>
        ))}
      </div>
    </div>
  );
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function MasterDashboardPage() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHourRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { lookups } = useLookups();
  const now = useClock();

  useEffect(() => {
    const params = new URLSearchParams({ year: String(year) });
    if (month) params.set("month", month);
    if (departmentId) params.set("departmentId", departmentId);
    setLoading(true);
    setError("");
    Promise.all([
      api<DashboardData>("/api/dashboard/summary?" + params.toString()),
      api<WorkingHourRow[]>("/api/working-hours?" + params.toString()).catch(() => []),
    ])
      .then(([summary, hours]) => { setData(summary); setWorkingHours(hours); })
      .catch((err) => setError(err instanceof Error ? err.message : "Master dashboard load failed"))
      .finally(() => setLoading(false));
  }, [year, month, departmentId]);

  const k = data?.kpis || {};
  const charts = data?.charts || {};
  const totalIncidents = valueOf(k.totalIncidents);
  const totalLostHours = valueOf(k.totalLostHours);
  const workingHourTotal = valueOf(k.totalWorkingHours);
  const medicalExpenseTotal = valueOf(k.medicalExpenseTotal);
  const observations = valueOf(k.observations);
  const nearMiss = valueOf(k.nearMissObservations);
  const unsafe = valueOf(k.unsafeConditions);
  const pendingActions = valueOf(k.pendingActions);
  const monthLabel = month ? months.find(([value]) => String(value) === month)?.[1] || month : "Full Year";
  const departmentLabel = departmentId ? lookups.departments.find((item) => item.id === departmentId)?.name || "Selected Department" : "All Departments";

  const employeeCount = useMemo(() => {
    const fromHours = workingHours.map((row) => valueOf(row.totalEmployees)).filter((value) => value > 0);
    if (fromHours.length) return Math.max(...fromHours);
    return lookups.employees.length;
  }, [workingHours, lookups.employees.length]);

  const medicalTrend = useMemo(() => movingAverage(charts.medicalExpenseTrend || charts.monthlyTrend || [], "medicalExpense"), [charts]);
  const downtimePercent = workingHourTotal > 0 ? (totalLostHours / workingHourTotal) * 100 : 0;
  const actionStatus = charts.correctiveActionStatus || [];
  const actionTotal = actionStatus.reduce((sum: number, item: any) => sum + valueOf(item.count), 0);
  const rootCauseSummary = charts.rootCauseSummary || charts.byRootCause || [];
  const injuryTypes = charts.injuryTypeBreakdown || charts.injuryTypeSummary || charts.byInjuryType || [];
  const departmentSummary = charts.departmentAccidentSummary || charts.departmentSummary || charts.byDepartment || [];
  const incidentTypes = charts.accidentTypeBreakdown || charts.accidentTypeSummary || [];
  const monthlyTrend = charts.monthlyTrend || [];
  const lostHoursTrend = charts.lostHoursTrend || monthlyTrend;

  const kpis = [
    { label: "Total Accidents", value: formatNumber(totalIncidents), sublabel: "YTD " + year, tone: "tone-teal", icon: "TA" },
    { label: "First Aid", value: formatNumber(k.firstAid), sublabel: "YTD " + year, tone: "tone-green", icon: "FA" },
    { label: "Medical", value: formatNumber(k.medicalTreatment), sublabel: "YTD " + year, tone: "tone-blue", icon: "MD" },
    { label: "Reportable", value: formatNumber(k.reportable), sublabel: "YTD " + year, tone: "tone-purple", icon: "RP" },
    { label: "Lost Hours", value: formatHours(totalLostHours), sublabel: "YTD " + year, tone: "tone-gold", icon: "LH" },
    { label: "Medical Expenses", value: formatCurrency(medicalExpenseTotal), sublabel: "YTD " + year, tone: "tone-cyan", icon: "Rs" },
    { label: "Near Miss / Unsafe", value: formatNumber(observations), sublabel: "YTD " + year, tone: "tone-orange", icon: "NM" },
    { label: "Working Hours", value: formatNumber(workingHourTotal), sublabel: "YTD " + year, tone: "tone-blue", icon: "WH" },
    { label: "AFR", value: formatFixed(k.afr, 2), sublabel: "YTD " + year, tone: "tone-green", icon: "AF" },
    { label: "Pending Actions", value: formatNumber(pendingActions), sublabel: "YTD " + year, tone: "tone-red", icon: "PA" },
  ];

  const executiveItems = [
    { label: "Executive Summary", value: "YTD " + year, tone: "summary-title" },
    { label: "Days Worked", value: "Not tracked", tone: "unsupported" },
    { label: "Employees", value: employeeCount ? formatNumber(employeeCount) : "Not tracked" },
    { label: "Incidents / 1M hrs", value: formatFixed(ratePerMillion(totalIncidents, workingHourTotal), 2) },
    { label: "Lost Hours / 1M hrs", value: formatFixed(ratePerMillion(totalLostHours, workingHourTotal), 2) },
    { label: "Medical Cost / 1M hrs", value: formatFixed(ratePerMillion(medicalExpenseTotal, workingHourTotal), 2) },
    { label: "Near Miss / 1M hrs", value: formatFixed(ratePerMillion(observations, workingHourTotal), 2) },
    { label: "Safety Observations", value: formatNumber(observations) },
    { label: "Training Hours", value: "Not tracked", tone: "unsupported" },
    { label: "Safety Meetings", value: "Not tracked", tone: "unsupported" },
  ];

  if (loading) return <LoadingState text="Loading master dashboard..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <section className="master-dashboard">
      <header className="master-hero">
        <div className="master-brand-block">
          <span className="master-logo"><img src={companyLogoSrc} alt={brandName} /></span>
          <div>
            <h1><span>HSE</span> <em>Master</em> Dashboard</h1>
            <p>{companyName}</p>
            <small>Factory: {companyProfile.factory}</small>
          </div>
        </div>
        <div className="master-status-card">
          <strong>{now.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}</strong>
          <span>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        </div>
        <div className="master-filter-card">
          <h2>Active Filters</h2>
          <label>Year<input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label>
          <label>Month<select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Full Year</option>{months.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Department<SelectLookup value={departmentId} onChange={setDepartmentId} items={lookups.departments} placeholder="All Departments" /></label>
        </div>
      </header>

      <div className="master-kpi-strip">
        {kpis.map((item) => <KpiCard key={item.label} {...item} />)}
      </div>

      <div className="master-grid top-grid">
        <Panel index={1} title="Incident Types"><HorizontalBars data={incidentTypes} color={dashboardColors.teal} /></Panel>
        <Panel index={2} title="Injury Category"><HorizontalBars data={injuryTypes} color={dashboardColors.blue} /></Panel>
        <Panel index={3} title="Incident Cause Category"><DonutChart data={rootCauseSummary} centerValue={formatNumber(totalIncidents)} centerLabel="Total" /></Panel>
        <Panel index={4} title="Department Summary"><HorizontalBars data={departmentSummary} color={dashboardColors.gold} /></Panel>
      </div>

      <div className="master-grid middle-grid">
        <Panel index={5} title="Type Of Injury"><HorizontalBars data={injuryTypes} color={dashboardColors.teal} /></Panel>
        <Panel index={6} title="Incident Trend (Monthly)" className="wide" badge={"YTD Total: " + formatNumber(totalIncidents)}>
          {!hasValues(monthlyTrend, ["incidents"]) ? <EmptyPanel /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyTrend} margin={{ top: 10, right: 18, left: 0, bottom: 6 }}>
                <CartesianGrid stroke="rgba(148,163,184,.14)" />
                <XAxis dataKey="label" tick={{ fill: "#c7d2df", fontSize: 11 }} axisLine={{ stroke: "rgba(148,163,184,.36)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#c7d2df", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<MasterTooltip />} />
                <Line type="monotone" dataKey="incidents" name="Incidents" stroke={dashboardColors.teal} strokeWidth={3} dot={{ r: 4, fill: dashboardColors.teal }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel index={7} title="Medical Expense Trend (LKR)" className="wide" badge={"YTD Total: " + formatNumber(medicalExpenseTotal)}>
          {!hasValues(medicalTrend, ["medicalExpense"]) ? <EmptyPanel /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={medicalTrend} margin={{ top: 10, right: 18, left: 0, bottom: 6 }}>
                <CartesianGrid stroke="rgba(148,163,184,.14)" />
                <XAxis dataKey="label" tick={{ fill: "#c7d2df", fontSize: 11 }} axisLine={{ stroke: "rgba(148,163,184,.36)" }} tickLine={false} />
                <YAxis tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#c7d2df", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<MasterTooltip />} />
                <Bar dataKey="medicalExpense" name="Monthly Expense" fill={dashboardColors.teal} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="movingAverage" name="3-Month Moving Avg" stroke="#d2d8e0" strokeDasharray="3 3" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="master-grid bottom-grid">
        <Panel index={8} title="Root Cause Analysis"><HorizontalBars data={rootCauseSummary} color={dashboardColors.purple} /></Panel>
        <Panel index={9} title="Near Miss / Unsafe Summary">
          <div className="near-summary">
            <div><span>Near Miss</span><strong>{formatNumber(nearMiss)}</strong><small>{observations ? formatFixed((nearMiss / observations) * 100, 1) : "0.0"}%</small></div>
            <div><span>Unsafe Conditions / Acts</span><strong>{formatNumber(unsafe)}</strong><small>{observations ? formatFixed((unsafe / observations) * 100, 1) : "0.0"}%</small></div>
            <footer>Total Near Miss / Unsafe <strong>{formatNumber(observations)}</strong></footer>
          </div>
        </Panel>
        <Panel index={10} title="Corrective Action Status">
          <DonutChart data={actionStatus} centerValue={formatNumber(actionTotal)} centerLabel="Total" />
        </Panel>
        <Panel index={11} title="Lost Hours / Downtime" className="wide">
          <div className="downtime-panel">
            <div className="downtime-stats">
              <div><span>Lost Hours (YTD)</span><strong>{formatFixed(totalLostHours, 2)}</strong></div>
              <div><span>Downtime (YTD)</span><strong>{formatFixed(downtimePercent, 2)}%</strong></div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={lostHoursTrend} margin={{ top: 10, right: 18, left: 0, bottom: 4 }}>
                <XAxis dataKey="label" tick={{ fill: "#c7d2df", fontSize: 11 }} axisLine={{ stroke: "rgba(148,163,184,.36)" }} tickLine={false} />
                <YAxis tick={{ fill: "#c7d2df", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<MasterTooltip />} />
                <Line type="monotone" dataKey="lostHours" name="Lost Hours" stroke={dashboardColors.gold} strokeWidth={3} dot={{ r: 4, fill: dashboardColors.gold }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <footer className="executive-strip">
        {executiveItems.map((item) => <div className={"executive-chip " + (item.tone || "")} key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
      </footer>
      <p className="master-footnote">Live dashboard data uses PostgreSQL records for {monthLabel} / {departmentLabel}. Unsupported executive metrics are shown as not tracked rather than estimated.</p>
    </section>
  );
}
