import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SelectLookup } from "../components/FormTools";
import { api } from "../lib/api";
import { brandName, companyLogoSrc, companyName, companyProfile } from "../lib/brand";
import { months } from "../lib/enums";
import { formatCurrency, formatFixed, formatHours, formatNumber } from "../lib/format";
import { useLookups } from "../hooks/useLookups";


type DashboardData = {
  kpis?: {
    totalIncidents?: number;
    firstAid?: number;
    medicalTreatment?: number;
    reportable?: number;
    lostTimeIncidents?: number;
    totalLostHours?: number;
    medicalExpenseTotal?: number;
    observations?: number;
    nearMissObservations?: number;
    unsafeConditions?: number;
    pendingActions?: number;
    overdueActions?: number;
    totalWorkingHours?: number;
    afr?: number;
    tfTotal?: number;
    tfRate?: number;
    tsTotal?: number;
    tsRate?: number;
    tfTsSource?: string | null;
    tfTsPeriod?: string | null;
    tfTsTracked?: boolean;
  };
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
  children: ReactNode;
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
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
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

function formatMetricValue(value: unknown, label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("%") || normalized.includes("percent")) return `${formatFixed(value, 2)}%`;
  if (normalized.includes("rate") || normalized === "afr") return formatFixed(value, 2);
  if (normalized.includes("expense") || normalized.includes("cost")) return formatCurrency(value);
  if (normalized.includes("hours")) return formatHours(value);
  return formatNumber(value);
}

function Panel({ index, title, className = "", badge, children }: PanelProps) {
  return (
    <section className={`master-panel ${className}`.trim()}>
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
  const tooltipTitle = String(label ?? payload[0]?.payload?.name ?? "");
  return (
    <div className="master-tooltip">
      <strong>{tooltipTitle}</strong>
      {payload.map((entry: any) => {
        const entryLabel = String(entry.name || entry.dataKey || "Value");
        return <span key={entryLabel}>{entryLabel}: {formatMetricValue(entry.value, entryLabel)}</span>;
      })}
    </div>
  );
}

function KpiCard({ label, value, sublabel, tone, icon }: { label: string; value: string; sublabel: string; tone: string; icon: string }) {
  return (
    <div className={`master-kpi ${tone}`}>
      <div className="master-kpi-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{sublabel}</small>
      </div>
    </div>
  );
}

function HorizontalBars({
  data,
  color,
  valueKey = "count",
  xMaxPadding = 1,
  labelWidth = 96,
  labelMax = 15,
  labelFontSize = 11,
  marginLeft = 8,
  marginRight = 22,
  barSize = 18,
  rowLimit = 6,
}: {
  data: MiniItem[];
  color: string;
  valueKey?: string;
  xMaxPadding?: number;
  labelWidth?: number;
  labelMax?: number;
  labelFontSize?: number;
  marginLeft?: number;
  marginRight?: number;
  barSize?: number;
  rowLimit?: number;
}) {
  const rows = data.slice(0, rowLimit);
  if (!hasValues(rows, [valueKey])) return <EmptyPanel />;
  const maxValue = Math.max(...rows.map((item) => valueOf(item[valueKey])), 1) + xMaxPadding;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: marginRight, left: marginLeft, bottom: 4 }}>
        <CartesianGrid stroke="rgba(148,163,184,.12)" horizontal={false} />
        <XAxis type="number" domain={[0, maxValue]} tick={{ fill: "#b8c7d9", fontSize: 11 }} tickFormatter={(value) => formatNumber(value)} axisLine={{ stroke: "rgba(148,163,184,.38)" }} tickLine={false} />
        <YAxis type="category" dataKey="name" width={labelWidth} interval={0} tickFormatter={(v) => shortLabel(v, labelMax)} tick={{ fill: "#f3f7fb", fontSize: labelFontSize }} axisLine={false} tickLine={false} />
        <Tooltip content={<MasterTooltip />} cursor={{ fill: "rgba(255,255,255,.04)" }} />
        <Bar dataKey={valueKey} fill={color} radius={[0, 4, 4, 0]} barSize={barSize}>
          {rows.map((_, index) => <Cell key={index} fill={color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DonutChart({ data, centerValue, centerLabel }: { data: MiniItem[]; centerValue: string; centerLabel: string }) {
  const rows = data.filter((item) => valueOf(item.count) > 0);
  if (!rows.length) return <EmptyPanel />;
  const total = rows.reduce((sum, item) => sum + valueOf(item.count), 0);
  return (
    <div className="master-donut-wrap">
      <ResponsiveContainer width="46%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="count" nameKey="name" innerRadius="50%" outerRadius="82%" paddingAngle={2}>
            {rows.map((_, index) => <Cell key={index} fill={donutColors[index % donutColors.length]} />)}
          </Pie>
          <Tooltip content={<MasterTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="master-donut-center"><strong>{centerValue}</strong><span>{centerLabel}</span></div>
      <div className="master-legend">
        {rows.map((item, index) => {
          const count = valueOf(item.count);
          const percent = total > 0 ? formatFixed((count / total) * 100, 1) : "0.0";
          return (
            <span key={item.name}>
              <i style={{ background: donutColors[index % donutColors.length] }} />
              <strong>{item.name}</strong>
              <em>{formatNumber(count)} ({percent}%)</em>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function MasterState({ title, detail, tone = "loading" }: { title: string; detail: string; tone?: "loading" | "error" }) {
  return (
    <div className={`master-state ${tone}`}>
      <strong>{title}</strong>
      <span>{detail}</span>
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
  const nearMissObservations = valueOf(k.nearMissObservations ?? k.observations);
  const unsafeConditions = valueOf(k.unsafeConditions);
  const pendingActions = valueOf(k.pendingActions);

  const monthLabel = month ? months.find(([value]) => String(value) === month)?.[1] || month : "Full Year";
  const departmentLabel = departmentId ? lookups.departments.find((item) => item.id === departmentId)?.name || "Selected Department" : "All Departments";

  const employeeCount = useMemo(() => {
    const fromHours = workingHours.map((row) => valueOf(row.totalEmployees)).filter((value) => value > 0);
    if (fromHours.length) return Math.max(...fromHours);
    return lookups.employees.length;
  }, [workingHours, lookups.employees.length]);

  const medicalTrend = useMemo(() => movingAverage(charts.medicalExpenseTrend || charts.monthlyTrend || [], "medicalExpense"), [charts]);
  const monthlyTrend = charts.monthlyTrend || [];
  const workingHoursTrend = charts.workingHoursTrend || monthlyTrend;
  const lostHoursTrend = charts.lostHoursTrend || monthlyTrend;
  const nearMissUnsafeSourceTrend = charts.nearMissUnsafeSourceTrend || [];
  const nearMissUnsafeClosureTrend = charts.nearMissUnsafeClosureTrend || [];
  const correctiveActionStatus = charts.correctiveActionStatus || charts.byActionStatus || [];
  const rootCauseSummary = charts.rootCauseSummary || charts.byRootCause || [];
  const incidentTypes = charts.accidentTypeBreakdown || charts.accidentTypeSummary || charts.byIncidentType || [];
  const injuryTypes = charts.injuryTypeBreakdown || charts.injuryTypeSummary || charts.byInjuryType || [];
  const departmentAccidentSummary = charts.departmentAccidentSummary || charts.departmentSummary || charts.byDepartment || [];
  const departmentLostHours = charts.departmentLostHours || departmentAccidentSummary.map((item: any) => ({ id: item.id, name: item.name, lostHours: item.lostHours || 0, count: item.count || 0 }));
  const medicalExpenseByDepartment = charts.medicalExpenseByDepartment || [];
  const tfTsTracked = Boolean(k.tfTsTracked);
  const tfTsSource = String(k.tfTsSource || "");
  const tfTsPeriod = String(k.tfTsPeriod || "");
  const tfTs = {
    tfTotal: tfTsTracked ? valueOf(k.tfTotal) : 0,
    tfRate: tfTsTracked ? valueOf(k.tfRate) : 0,
    tsTotal: tfTsTracked ? valueOf(k.tsTotal) : 0,
    tsRate: tfTsTracked ? valueOf(k.tsRate) : 0,
  };

  const downtimePercent = workingHourTotal > 0 ? (totalLostHours / workingHourTotal) * 100 : 0;
  const actionTotal = correctiveActionStatus.reduce((sum: number, item: any) => sum + valueOf(item.count), 0);

  const workingHoursLossTrend = workingHoursTrend.map((item: any) => {
    const hours = valueOf(item.workingHours);
    return {
      label: item.label,
      workingHours: hours,
      lostHoursPercent: hours > 0 ? Number(((valueOf(item.lostHours) / hours) * 100).toFixed(2)) : 0,
    };
  });

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

  if (loading) {
    return (
      <section className="master-dashboard">
        <MasterState title="Loading master dashboard..." detail="Fetching live HSE metrics from PostgreSQL." />
      </section>
    );
  }

  if (error) {
    return (
      <section className="master-dashboard">
        <MasterState title="Master dashboard unavailable" detail={error} tone="error" />
      </section>
    );
  }

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

      <div className="master-chart-grid">
        <Panel index={1} title="Incident Types"><HorizontalBars data={incidentTypes} color={dashboardColors.teal} /></Panel>
        <Panel index={2} title="Injury Category (Body Part)"><HorizontalBars data={injuryTypes} color={dashboardColors.blue} /></Panel>
        <Panel index={3} title="Incident Cause Category"><DonutChart data={rootCauseSummary} centerValue={formatNumber(totalIncidents)} centerLabel="Total" /></Panel>
        <Panel index={4} title="Department Summary (Incidents)"><HorizontalBars data={departmentAccidentSummary} color={dashboardColors.gold} /></Panel>

        <Panel index={5} title="Department Lost Hours"><HorizontalBars data={departmentLostHours} color={dashboardColors.orange} valueKey="lostHours" labelWidth={126} labelMax={16} labelFontSize={9} marginLeft={14} barSize={16} /></Panel>
        <Panel index={6} title="Incident Trend (Monthly)" badge={`YTD Total: ${formatNumber(totalIncidents)}`}>
          {!hasValues(monthlyTrend, ["incidents"]) ? <EmptyPanel /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend} margin={{ top: 10, right: 14, left: 0, bottom: 6 }}>
                <CartesianGrid stroke="rgba(148,163,184,.14)" />
                <XAxis dataKey="label" tick={{ fill: "#c7d2df", fontSize: 11 }} axisLine={{ stroke: "rgba(148,163,184,.36)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#c7d2df", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<MasterTooltip />} />
                <Line type="monotone" dataKey="incidents" name="Incidents" stroke={dashboardColors.teal} strokeWidth={3} dot={{ r: 4, fill: dashboardColors.teal }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel index={7} title="MEDICAL EXPENSE TREND" badge={formatCurrency(medicalExpenseTotal)}>
          {!hasValues(medicalTrend, ["medicalExpense"]) ? <EmptyPanel /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={medicalTrend} margin={{ top: 10, right: 14, left: 0, bottom: 6 }}>
                <CartesianGrid stroke="rgba(148,163,184,.14)" />
                <XAxis dataKey="label" tick={{ fill: "#c7d2df", fontSize: 11 }} axisLine={{ stroke: "rgba(148,163,184,.36)" }} tickLine={false} />
                <YAxis tick={{ fill: "#c7d2df", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatNumber(value)} />
                <Tooltip content={<MasterTooltip />} />
                <Bar dataKey="medicalExpense" name="Monthly Expense" fill={dashboardColors.teal} radius={[4, 4, 0, 0]} barSize={18} />
                <Line type="monotone" dataKey="movingAverage" name="Average Expense" stroke={dashboardColors.slate} strokeDasharray="4 4" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel index={8} title="Root Cause Analysis"><HorizontalBars data={rootCauseSummary} color={dashboardColors.purple} labelWidth={148} labelMax={16} labelFontSize={9} marginLeft={18} marginRight={20} barSize={16} /></Panel>

        <Panel index={9} title="Near Miss / Unsafe Summary">
          <div className="near-summary">
            <div><span>Near Miss</span><strong>{formatNumber(nearMissObservations)}</strong><small>{observations ? formatFixed((nearMissObservations / observations) * 100, 1) : "0.0"}%</small></div>
            <div><span>Unsafe Conditions / Acts</span><strong>{formatNumber(unsafeConditions)}</strong><small>{observations ? formatFixed((unsafeConditions / observations) * 100, 1) : "0.0"}%</small></div>
            <footer>Total Near Miss / Unsafe <strong>{formatNumber(observations)}</strong></footer>
          </div>
        </Panel>
        <Panel index={10} title="Corrective Action Status">
          <DonutChart data={correctiveActionStatus} centerValue={formatNumber(actionTotal)} centerLabel="Total" />
        </Panel>
        <Panel index={11} title="Lost Hours / Downtime" badge={`YTD Total: ${formatHours(totalLostHours)}`}>
          <div className="downtime-panel">
            <div className="downtime-stats">
              <div><span>Lost Hours (YTD)</span><strong>{formatFixed(totalLostHours, 2)}</strong></div>
              <div><span>Downtime (YTD)</span><strong>{formatFixed(downtimePercent, 2)}%</strong></div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lostHoursTrend} margin={{ top: 10, right: 14, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="rgba(148,163,184,.14)" />
                <XAxis dataKey="label" tick={{ fill: "#c7d2df", fontSize: 11 }} axisLine={{ stroke: "rgba(148,163,184,.36)" }} tickLine={false} />
                <YAxis tick={{ fill: "#c7d2df", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatNumber(value)} />
                <Tooltip content={<MasterTooltip />} />
                <Line type="monotone" dataKey="lostHours" name="Lost Hours" stroke={dashboardColors.gold} strokeWidth={3} dot={{ r: 4, fill: dashboardColors.gold }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel index={12} title="TF / TS Summary" badge={tfTsTracked ? tfTsPeriod || `YTD ${year}` : "Not tracked"}>
          <div className="tf-ts-summary">
            <div className="tf-ts-card"><span>TF Total</span><strong>{formatNumber(tfTs.tfTotal)}</strong><small>Total frequency</small></div>
            <div className="tf-ts-card"><span>TF Rate</span><strong>{formatFixed(tfTs.tfRate, 2)}</strong><small>Frequency rate</small></div>
            <div className="tf-ts-card"><span>TS Total</span><strong>{formatNumber(tfTs.tsTotal)}</strong><small>Total severity</small></div>
            <div className="tf-ts-card"><span>TS Rate</span><strong>{formatFixed(tfTs.tsRate, 2)}</strong><small>Severity rate</small></div>
            {tfTsTracked ? (
              <div className="tf-ts-meta">
                <div className="tf-ts-meta-item">
                  <span>Source</span>
                  <strong>{tfTsSource || "ESG Matrics.xlsx"}</strong>
                </div>
                <div className="tf-ts-meta-item">
                  <span>Period</span>
                  <strong>{tfTsPeriod || `YTD ${year}`}</strong>
                </div>
              </div>
            ) : (
              <p className="tf-ts-note">TF/TS source not tracked</p>
            )}
          </div>
        </Panel>

        <Panel index={13} title="Department Medical Expenditure" badge="LKR"><HorizontalBars data={medicalExpenseByDepartment} color={dashboardColors.cyan} valueKey="medicalExpense" xMaxPadding={1000} labelWidth={118} labelMax={18} labelFontSize={10} marginLeft={10} barSize={16} /></Panel>
        <Panel index={14} title="Near Miss Source Trend">
          {!hasValues(nearMissUnsafeSourceTrend, ["hseTeam", "shopFloor", "total"]) ? <EmptyPanel /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={nearMissUnsafeSourceTrend} margin={{ top: 10, right: 14, left: 0, bottom: 6 }}>
                <CartesianGrid stroke="rgba(148,163,184,.14)" />
                <XAxis dataKey="label" tick={{ fill: "#c7d2df", fontSize: 11 }} axisLine={{ stroke: "rgba(148,163,184,.36)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#c7d2df", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<MasterTooltip />} />
                <Legend wrapperStyle={{ color: "#dbe7f4", fontSize: 11 }} />
                <Line type="monotone" dataKey="hseTeam" name="HSE Team" stroke={dashboardColors.teal} strokeWidth={3} dot={{ r: 3, fill: dashboardColors.teal }} />
                <Line type="monotone" dataKey="shopFloor" name="Shop Floor" stroke={dashboardColors.gold} strokeWidth={3} dot={{ r: 3, fill: dashboardColors.gold }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel index={15} title="Closure Status Trend">
          {!hasValues(nearMissUnsafeClosureTrend, ["completed", "pending", "total"]) ? <EmptyPanel /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={nearMissUnsafeClosureTrend} margin={{ top: 8, right: 12, left: 0, bottom: 2 }}>
                <CartesianGrid stroke="rgba(148,163,184,.14)" />
                <XAxis dataKey="label" minTickGap={10} tick={{ fill: "#c7d2df", fontSize: 9 }} axisLine={{ stroke: "rgba(148,163,184,.36)" }} tickLine={false} />
                <YAxis allowDecimals={false} width={26} tick={{ fill: "#c7d2df", fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<MasterTooltip />} />
                <Legend iconSize={8} wrapperStyle={{ color: "#dbe7f4", fontSize: 9, lineHeight: "12px" }} />
                <Line type="monotone" dataKey="completed" name="Completed" stroke={dashboardColors.teal} strokeWidth={3} dot={{ r: 3, fill: dashboardColors.teal }} />
                <Line type="monotone" dataKey="pending" name="Pending" stroke={dashboardColors.red} strokeWidth={3} dot={{ r: 3, fill: dashboardColors.red }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel index={16} title="Working Hours vs Lost Hours %" badge={`YTD ${formatNumber(workingHourTotal)}`}>
          {!hasValues(workingHoursLossTrend, ["workingHours", "lostHoursPercent"]) ? <EmptyPanel /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={workingHoursLossTrend} margin={{ top: 8, right: 4, left: 0, bottom: 2 }}>
                <CartesianGrid stroke="rgba(148,163,184,.14)" />
                <XAxis dataKey="label" minTickGap={10} tick={{ fill: "#c7d2df", fontSize: 9 }} axisLine={{ stroke: "rgba(148,163,184,.36)" }} tickLine={false} />
                <YAxis yAxisId="left" width={50} tick={{ fill: "#c7d2df", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatNumber(value)} />
                <YAxis yAxisId="right" orientation="right" width={34} tick={{ fill: "#c7d2df", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${formatFixed(value, 2)}%`} />
                <Tooltip content={<MasterTooltip />} />
                <Legend iconSize={8} wrapperStyle={{ color: "#dbe7f4", fontSize: 9, lineHeight: "12px" }} />
                <Bar yAxisId="left" dataKey="workingHours" name="Working Hours" fill={dashboardColors.cyan} radius={[4, 4, 0, 0]} barSize={16} />
                <Line yAxisId="right" type="monotone" dataKey="lostHoursPercent" name="Lost Hours %" stroke={dashboardColors.gold} strokeWidth={3} dot={{ r: 3, fill: dashboardColors.gold }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <footer className="executive-strip">
        {executiveItems.map((item) => <div className={`executive-chip ${item.tone || ""}`.trim()} key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
      </footer>
      <p className="master-footnote">Live dashboard data uses PostgreSQL records for {monthLabel} / {departmentLabel}. Unsupported executive metrics are shown as not tracked rather than estimated.</p>
    </section>
  );
}


