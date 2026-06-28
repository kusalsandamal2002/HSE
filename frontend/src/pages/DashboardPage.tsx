import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import { months } from "../lib/enums";
import { useLookups } from "../hooks/useLookups";
import { EmptyState, ErrorState, Field, LoadingState, SelectLookup } from "../components/FormTools";
import { brandName, businessUnitName, companyContextName, companyLogoSrc, companyName, companyProfile } from "../lib/brand";
import { formatCurrency, formatFixed, formatHours, formatNumber } from "../lib/format";

const colors = {
  accidents: "#0f766e",
  firstAid: "#0e7490",
  medical: "#b45309",
  reportable: "#b91c1c",
  lostHours: "#64748b",
  workingHours: "#2563eb",
  afr: "#7c3aed",
  nearMiss: "#0891b2",
  unsafe: "#ca8a04",
  action: "#475569",
};
const pieColors = [colors.firstAid, colors.medical, colors.reportable, colors.lostHours, colors.nearMiss, colors.unsafe, colors.afr];
const dataRoutes = {
  incidents: "/incidents",
  medical: "/medical-expenses",
  actions: "/corrective-actions",
  observations: "/observations",
  hours: "/working-hours",
  master: "/master-data",
  upload: "/data-upload",
  reports: "/reports",
  company: "/company-profile",
  dataEntry: "/data-entry",
} as const;

function ChartPanel({
  title,
  subtitle,
  children,
  empty,
  onDrillDown,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  empty: boolean;
  onDrillDown?: () => void;
}) {
  return (
    <div
      className={`panel chart-panel${onDrillDown ? " drillable-chart" : ""}`}
      onDoubleClick={onDrillDown ? () => onDrillDown() : undefined}
      onKeyDown={(event) => {
        if (!onDrillDown) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onDrillDown();
        }
      }}
      role={onDrillDown ? "button" : undefined}
      tabIndex={onDrillDown ? 0 : undefined}
      title={onDrillDown ? `${title} - double click to open source data` : title}
    >
      <div className="chart-title">
        <h2>{title}</h2>
        <div className="chart-title-meta">
          {subtitle && <span>{subtitle}</span>}
          {onDrillDown && <small>Double-click to open source data</small>}
        </div>
      </div>
      {empty ? <EmptyState text="No chart data" detail="Try another period or department." /> : children}
    </div>
  );
}
function SectionHeader({ title, detail }: { title: string; detail: string }) {
  return <div className="analysis-heading"><h2>{title}</h2><p>{detail}</p></div>;
}

function hasAny(items?: any[], keys = ["count", "incidents", "medicalExpense", "lostHours", "total", "workingHours", "afr"]) {
  return Boolean(items?.some((item) => keys.some((key) => Number(item?.[key] || 0) > 0)));
}

function axisName(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

function countTooltip(value: number) {
  return formatNumber(value);
}

function mixedTooltip(value: number, name: string) {
  if (name.includes("Expense")) return formatCurrency(value);
  if (name.includes("Hours") || name.includes("Lost Hours")) return name === "Working Hours" ? formatNumber(value) : formatHours(value);
  if (name === "AFR") return formatFixed(value, 2);
  return formatNumber(value);
}

type DashboardPageProps = { onNavigate?: (path: string) => void };

export function DashboardPage({ onNavigate }: DashboardPageProps = {}) {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { lookups } = useLookups();

  function drillTo(path: string) {
    if (onNavigate) {
      onNavigate(path);
      return;
    }
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  const drill = (path: string) => () => drillTo(path);

  useEffect(() => {
    const params = new URLSearchParams({ year: String(year) });
    if (month) params.set("month", month);
    if (departmentId) params.set("departmentId", departmentId);
    setLoading(true);
    setError("");
    api<any>(`/api/dashboard/summary?${params}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Dashboard load failed"))
      .finally(() => setLoading(false));
  }, [year, month, departmentId]);

  const k = data?.kpis || {};
  const cards = [
    { label: "Total Accidents", value: formatNumber(k.totalIncidents), hint: "Accidents in selected period" },
    { label: "First Aid", value: formatNumber(k.firstAid), hint: "First-aid cases" },
    { label: "Medical", value: formatNumber(k.medicalTreatment), hint: "Medical treatment cases" },
    { label: "Reportable", value: formatNumber(k.reportable), hint: "Reportable injuries" },
    { label: "Lost Time Incidents", value: formatNumber(k.lostTimeIncidents), hint: "Cases with lost minutes" },
    { label: "Lost Hours", value: formatHours(k.totalLostHours), hint: "Total lost work hours" },
    { label: "Medical Expenses", value: formatCurrency(k.medicalExpenseTotal), hint: "Linked incident medical cost" },
    { label: "AFR", value: formatFixed(k.afr, 2), hint: "Accidents x 200,000 / working hours" },
    { label: "Near Miss / Unsafe", value: formatNumber(k.observations), hint: "Near miss and unsafe records" },
    { label: "Pending Actions", value: formatNumber(k.pendingActions), hint: "Pending and in-progress" },
    { label: "Overdue Actions", value: formatNumber(k.overdueActions), hint: "Past due date" },
    { label: "Working Hours", value: formatNumber(k.totalWorkingHours), hint: "Company total unless department filtered" },
  ];

  const kpiDrillPathByLabel: Record<string, string> = {
    "Total Accidents": dataRoutes.incidents,
    "First Aid": dataRoutes.incidents,
    "Medical": dataRoutes.incidents,
    "Reportable": dataRoutes.incidents,
    "Lost Time Incidents": dataRoutes.incidents,
    "Lost Hours": dataRoutes.incidents,
    "Medical Expenses": dataRoutes.medical,
    "AFR": dataRoutes.hours,
    "Near Miss / Unsafe": dataRoutes.observations,
    "Pending Actions": dataRoutes.actions,
    "Overdue Actions": dataRoutes.actions,
    "Working Hours": dataRoutes.hours,
  };

  const moduleDrilldowns = [
    { label: "Accident Register", value: formatNumber(k.totalIncidents), hint: "Accident, injury, root cause, severity and lost-time records", path: dataRoutes.incidents, bars: [Number(k.firstAid || 0), Number(k.medicalTreatment || 0), Number(k.reportable || 0)] },
    { label: "Medical Expenses", value: formatCurrency(k.medicalExpenseTotal), hint: "Medical cost records linked to incidents and monthly summaries", path: dataRoutes.medical, bars: [Number(k.medicalExpenseTotal || 0), Number(k.medicalTreatment || 0), 1] },
    { label: "Corrective Actions", value: formatNumber(k.pendingActions), hint: "Pending, in-progress, completed and overdue action tracking", path: dataRoutes.actions, bars: [Number(k.pendingActions || 0), Number(k.overdueActions || 0), 1] },
    { label: "Near Miss / Unsafe", value: formatNumber(k.observations), hint: "Near miss, unsafe act, unsafe condition and risk observations", path: dataRoutes.observations, bars: [Number(k.observations || 0), Number(k.pendingActions || 0), 1] },
    { label: "Working Hours", value: formatNumber(k.totalWorkingHours), hint: "Department man-hours, overtime, AFR source data and exposure hours", path: dataRoutes.hours, bars: [Number(k.totalWorkingHours || 0), Number(k.afr || 0), 1] },
    { label: "Master Data", value: "Open", hint: "Departments, employees, machines, shifts and lookup master records", path: dataRoutes.master, bars: [80, 58, 36] },
    { label: "Data Entry Center", value: "Open", hint: "Excel-like central entry interface for all editable HSE records", path: dataRoutes.dataEntry, bars: [85, 60, 42] },
    { label: "Data Upload Center", value: "Open", hint: "Bulk workbook upload, validation, approval and import workflow", path: dataRoutes.upload, bars: [65, 45, 25] },
    { label: "Reports & Downloads", value: "Open", hint: "Monthly reports, yearly reports, CSV exports and JSON backups", path: dataRoutes.reports, bars: [75, 50, 30] },
    { label: "Company Profile", value: "Open", hint: "Company identity, HSE/ESG profile and reporting context", path: dataRoutes.company, bars: [70, 48, 28] },
  ];

  const chartData = data?.charts || {};
  const monthlyTrend = chartData.monthlyTrend || [];
  const medicalExpenseTrend = chartData.medicalExpenseTrend || monthlyTrend;
  const departmentAccidentSummary = chartData.departmentAccidentSummary || chartData.departmentSummary || chartData.byDepartment || [];
  const departmentLostHours = chartData.departmentLostHours || departmentAccidentSummary;
  const medicalExpenseByDepartment = chartData.medicalExpenseByDepartment || [];
  const rootCauseSummary = chartData.rootCauseSummary || chartData.byRootCause || [];
  const accidentTypeBreakdown = chartData.accidentTypeBreakdown || chartData.byIncidentType || [];
  const injuryTypeBreakdown = chartData.injuryTypeBreakdown || chartData.byInjuryType || [];
  const correctiveActionStatus = chartData.correctiveActionStatus || chartData.byActionStatus || [];
  const nearMissUnsafeTrend = chartData.nearMissUnsafeTrend || [];
  const nearMissUnsafeBreakdown = chartData.nearMissUnsafeBreakdown || [];
  const nearMissUnsafeSourceTrend = chartData.nearMissUnsafeSourceTrend || [];
  const nearMissUnsafeClosureTrend = chartData.nearMissUnsafeClosureTrend || [];
  const workingHoursTrend = chartData.workingHoursTrend || [];
  const lostHoursTrend = chartData.lostHoursTrend || monthlyTrend;
  const afrTrend = chartData.afrTrend || workingHoursTrend;
  const monthlyKpiSummary = chartData.monthlyKpiSummary || [];

  const selectedLabel = useMemo(() => {
    const monthLabel = month ? months.find(([m]) => String(m) === month)?.[1] : "Full Year";
    const deptLabel = departmentId ? lookups.departments.find((dept) => dept.id === departmentId)?.name : "All Departments";
    return `${year} / ${monthLabel} / ${deptLabel || "Selected Department"}`;
  }, [year, month, departmentId, lookups.departments]);

  if (loading) return <LoadingState text="Loading dashboard data..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <section className="page-stack">
      <div className="panel filters">
        <Field label="Year"><input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></Field>
        <Field label="Month"><select value={month} onChange={(e) => setMonth(e.target.value)}><option value="">Full Year</option>{months.map(([m, label]) => <option key={m} value={m}>{label}</option>)}</select></Field>
        <Field label="Department"><SelectLookup value={departmentId} onChange={setDepartmentId} items={lookups.departments} placeholder="All Departments" /></Field>
      </div>

      <div className="section-heading branded-page-heading company-dashboard-heading">
        <div>
          <h2>HSE Performance</h2>
          <p>{companyName}</p>
          <small>{companyContextName} / Factory: {companyProfile.factory} / {selectedLabel}</small>
        </div>
        <span className="logo-mark page-heading-logo">
          <img src={companyLogoSrc} alt={brandName} />
        </span>
      </div>

      <div className="company-context-grid">
        <div className="panel company-context-card">
          <span>Operational Scope</span>
          <strong>{businessUnitName}</strong>
          <p>{companyProfile.productAreas.join(" / ")}</p>
        </div>
        <div className="panel company-context-card">
          <span>Compliance & Policy</span>
          <strong>HSE, quality, energy and ethical trading controls</strong>
          <div className="chip-list compact-chip-list">
            {[...companyProfile.policyReferences, ...companyProfile.certifications].map((item) => <span className="info-chip" key={item}>{item}</span>)}
          </div>
        </div>
      </div>

      <div className="kpi-list">
        {cards.map((card) => <div className="kpi" key={card.label}><span>{card.label}</span><strong>{card.value}</strong><small>{card.hint}</small></div>)}
      </div>

      <SectionHeader title="Main Dashboard Trends" detail="Accident movement and medical cost by month." />
      <div className="grid two">
        <ChartPanel title="Monthly Accident Trend" onDrillDown={drill(dataRoutes.incidents)} subtitle="First aid, medical, reportable and total" empty={!hasAny(monthlyTrend, ["incidents", "firstAid", "medicalTreatment", "reportable"])}>
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={monthlyTrend} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis dataKey="label" tickMargin={8} />
              <YAxis allowDecimals={false} width={40} />
              <Tooltip formatter={(value: number) => formatNumber(value)} />
              <Legend />
              <Bar dataKey="firstAid" name="First Aid" stackId="acc" fill={colors.firstAid} radius={[5, 5, 0, 0]} />
              <Bar dataKey="medicalTreatment" name="Medical" stackId="acc" fill={colors.medical} radius={[5, 5, 0, 0]} />
              <Bar dataKey="reportable" name="Reportable" stackId="acc" fill={colors.reportable} radius={[5, 5, 0, 0]} />
              <Line type="monotone" dataKey="incidents" name="Total Accidents" stroke={colors.accidents} strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Monthly Medical Expense Trend" onDrillDown={drill(dataRoutes.medical)} subtitle="LKR by month" empty={!hasAny(medicalExpenseTrend, ["medicalExpense"])}>
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={medicalExpenseTrend} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(v) => formatNumber(v)} width={78} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="medicalExpense" name="Medical Expense" fill={colors.medical} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <SectionHeader title="Department And Cause Analysis" detail="Department-level safety performance, lost hours, root causes and medical cost." />
      <div className="grid two">
        <ChartPanel title="Department-wise Accident Summary" onDrillDown={drill(dataRoutes.incidents)} subtitle="Accident types and lost hours" empty={!hasAny(departmentAccidentSummary, ["count", "firstAid", "medicalTreatment", "reportable", "lostHours"])}>
          <ResponsiveContainer width="100%" height={330}>
            <ComposedChart data={departmentAccidentSummary} margin={{ top: 10, right: 18, left: 0, bottom: 58 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis dataKey="name" tickFormatter={axisName} angle={-22} textAnchor="end" interval={0} height={70} />
              <YAxis yAxisId="left" allowDecimals={false} width={38} />
              <YAxis yAxisId="right" orientation="right" width={54} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip formatter={(value: number, name: string) => mixedTooltip(value, name)} />
              <Legend />
              <Bar yAxisId="left" dataKey="firstAid" name="First Aid" stackId="type" fill={colors.firstAid} radius={[5, 5, 0, 0]} />
              <Bar yAxisId="left" dataKey="medicalTreatment" name="Medical" stackId="type" fill={colors.medical} radius={[5, 5, 0, 0]} />
              <Bar yAxisId="left" dataKey="reportable" name="Reportable" stackId="type" fill={colors.reportable} radius={[5, 5, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="lostHours" name="Lost Hours" stroke={colors.lostHours} strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Department-wise Lost Hours" onDrillDown={drill(dataRoutes.incidents)} subtitle="Departments ranked by lost time" empty={!hasAny(departmentLostHours, ["lostHours"])}>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={departmentLostHours} layout="vertical" margin={{ top: 10, right: 18, left: 118, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis type="number" tickFormatter={(v) => formatNumber(v)} />
              <YAxis type="category" dataKey="name" width={112} tickFormatter={axisName} />
              <Tooltip formatter={(value: number) => formatHours(value)} />
              <Bar dataKey="lostHours" name="Lost Hours" fill={colors.lostHours} radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Root Cause Analysis" onDrillDown={drill(dataRoutes.incidents)} subtitle="Grouped by root cause" empty={!hasAny(rootCauseSummary)}>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={rootCauseSummary} layout="vertical" margin={{ top: 10, right: 18, left: 148, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={142} tickFormatter={axisName} />
              <Tooltip formatter={countTooltip} />
              <Bar dataKey="count" name="Accidents" fill={colors.accidents} radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Department-wise Medical Expense" onDrillDown={drill(dataRoutes.medical)} subtitle="LKR by department" empty={!hasAny(medicalExpenseByDepartment, ["medicalExpense"])}>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={medicalExpenseByDepartment} layout="vertical" margin={{ top: 10, right: 18, left: 118, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis type="number" tickFormatter={(v) => formatNumber(v)} />
              <YAxis type="category" dataKey="name" width={112} tickFormatter={axisName} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="medicalExpense" name="Medical Expense" fill={colors.medical} radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <SectionHeader title="Actions And Observation Analysis" detail="Accident types, injury types, corrective action status and near miss / unsafe trends." />
      <div className="grid two">
        <ChartPanel title="Accident Type Breakdown" onDrillDown={drill(dataRoutes.incidents)} subtitle="First aid, medical, reportable and lost time" empty={!hasAny(accidentTypeBreakdown)}>
          <ResponsiveContainer width="100%" height={310}>
            <PieChart>
              <Tooltip formatter={(value: number) => formatNumber(value)} />
              <Legend />
              <Pie data={accidentTypeBreakdown} dataKey="count" nameKey="name" innerRadius={62} outerRadius={104} paddingAngle={2}>
                {accidentTypeBreakdown.map((_: any, index: number) => <Cell key={index} fill={pieColors[index % pieColors.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Injury Type Breakdown" onDrillDown={drill(dataRoutes.incidents)} subtitle="Grouped by injury type" empty={!hasAny(injuryTypeBreakdown)}>
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={injuryTypeBreakdown} layout="vertical" margin={{ top: 10, right: 18, left: 118, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={112} tickFormatter={axisName} />
              <Tooltip formatter={countTooltip} />
              <Bar dataKey="count" name="Cases" fill={colors.lostHours} radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Corrective Action Status" onDrillDown={drill(dataRoutes.actions)} subtitle="Pending, in progress, completed and overdue" empty={!hasAny(correctiveActionStatus)}>
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={correctiveActionStatus} margin={{ top: 10, right: 18, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={countTooltip} />
              <Bar dataKey="count" name="Actions" radius={[5, 5, 0, 0]}>
                {correctiveActionStatus.map((item: any, index: number) => <Cell key={item.name} fill={item.name === "Overdue" ? colors.reportable : pieColors[index % pieColors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Near Miss / Unsafe Condition Trend" subtitle="Monthly observation records" empty={!hasAny(nearMissUnsafeTrend, ["nearMiss", "unsafeCondition", "total"])}>
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={nearMissUnsafeTrend} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={countTooltip} />
              <Legend />
              <Bar dataKey="unsafeCondition" name="Unsafe Condition" stackId="obs" fill={colors.unsafe} radius={[5, 5, 0, 0]} />
              <Bar dataKey="nearMiss" name="Near Miss" stackId="obs" fill={colors.nearMiss} radius={[5, 5, 0, 0]} />
              <Line type="monotone" dataKey="total" name="Total" stroke={colors.action} strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Near Miss / Unsafe Reporting Source" subtitle="HSE team and shop-floor reporting" empty={!hasAny(nearMissUnsafeSourceTrend, ["hseTeam", "shopFloor", "total"])}>
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={nearMissUnsafeSourceTrend} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={countTooltip} />
              <Legend />
              <Bar dataKey="hseTeam" name="HSE Team" stackId="source" fill={colors.accidents} radius={[5, 5, 0, 0]} />
              <Bar dataKey="shopFloor" name="Shop Floor" stackId="source" fill={colors.nearMiss} radius={[5, 5, 0, 0]} />
              <Line type="monotone" dataKey="total" name="Total" stroke={colors.action} strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Near Miss / Unsafe Closure Trend" onDrillDown={drill(dataRoutes.observations)} subtitle="Completed and pending observation actions" empty={!hasAny(nearMissUnsafeClosureTrend, ["completed", "pending", "total"])}>
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={nearMissUnsafeClosureTrend} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={countTooltip} />
              <Legend />
              <Bar dataKey="completed" name="Completed" stackId="closure" fill={colors.accidents} radius={[5, 5, 0, 0]} />
              <Bar dataKey="pending" name="Pending" stackId="closure" fill={colors.unsafe} radius={[5, 5, 0, 0]} />
              <Line type="monotone" dataKey="total" name="Total" stroke={colors.action} strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Near Miss vs Unsafe Condition" subtitle="Selected period breakdown" empty={!hasAny(nearMissUnsafeBreakdown)}>
          <ResponsiveContainer width="100%" height={310}>
            <PieChart>
              <Tooltip formatter={(value: number) => formatNumber(value)} />
              <Legend />
              <Pie data={nearMissUnsafeBreakdown} dataKey="count" nameKey="name" innerRadius={62} outerRadius={104} paddingAngle={2}>
                {nearMissUnsafeBreakdown.map((_: any, index: number) => <Cell key={index} fill={[colors.nearMiss, colors.unsafe][index % 2]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <SectionHeader title="Working Hours And AFR" detail="Exposure hours, lost hours and accident frequency trend." />
      <div className="grid two">
        <ChartPanel title="Working Hours Trend" onDrillDown={drill(dataRoutes.hours)} subtitle="Monthly exposure hours" empty={!hasAny(workingHoursTrend, ["workingHours"])}>
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={workingHoursTrend} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(v) => formatNumber(v)} width={78} />
              <Tooltip formatter={(value: number) => formatNumber(value)} />
              <Bar dataKey="workingHours" name="Working Hours" fill={colors.workingHours} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="AFR Trend" onDrillDown={drill(dataRoutes.hours)} subtitle="Accident frequency rate by month" empty={!hasAny(afrTrend, ["afr"])}>
          <ResponsiveContainer width="100%" height={310}>
            <LineChart data={afrTrend} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(v) => formatFixed(v, 2)} width={54} />
              <Tooltip formatter={(value: number) => formatFixed(value, 2)} />
              <Line type="monotone" dataKey="afr" name="AFR" stroke={colors.afr} strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Lost Hours Trend" onDrillDown={drill(dataRoutes.incidents)} subtitle="Lost hours and lost-time incidents" empty={!hasAny(lostHoursTrend, ["lostHours", "lostTimeIncidents"])}>
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={lostHoursTrend} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis dataKey="label" />
              <YAxis yAxisId="left" tickFormatter={(v) => formatNumber(v)} width={54} />
              <YAxis yAxisId="right" orientation="right" allowDecimals={false} width={38} />
              <Tooltip formatter={(value: number, name: string) => name === "Lost Hours" ? formatHours(value) : formatNumber(value)} />
              <Legend />
              <Bar yAxisId="left" dataKey="lostHours" name="Lost Hours" fill={colors.lostHours} radius={[5, 5, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="lostTimeIncidents" name="Lost-Time Incidents" stroke={colors.reportable} strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

        <div className="panel table-panel monthly-kpi-table">
          <div className="chart-title"><h2>Month-wise HSE KPI Summary</h2><span>{selectedLabel}</span></div>
          {!hasAny(monthlyKpiSummary, ["incidents", "medicalExpense", "nearMissUnsafe", "workingHours", "lostHours"]) ? <EmptyState text="No monthly KPI data" detail="Try another period or department." /> : (
            <table>
              <thead><tr><th>Month</th><th>Accidents</th><th>First Aid</th><th>Medical</th><th>Reportable</th><th>Lost Hours</th><th>Medical Expense</th><th>Near Miss / Unsafe</th><th>Working Hours</th><th>AFR</th></tr></thead>
              <tbody>{monthlyKpiSummary.map((row: any) => <tr key={row.month}><td>{row.label}</td><td>{formatNumber(row.incidents)}</td><td>{formatNumber(row.firstAid)}</td><td>{formatNumber(row.medicalTreatment)}</td><td>{formatNumber(row.reportable)}</td><td>{formatHours(row.lostHours)}</td><td>{formatCurrency(row.medicalExpense)}</td><td>{formatNumber(row.nearMissUnsafe)}</td><td>{formatNumber(row.workingHours)}</td><td>{formatFixed(row.afr, 2)}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}



