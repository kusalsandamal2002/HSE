import type { ReactNode } from "react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import { months } from "../lib/enums";
import { useLookups } from "../hooks/useLookups";
import { EmptyState, Field, SelectLookup } from "../components/FormTools";
import { appName, brandName, businessUnitName, companyLogoSrc, companyName, companyProfile } from "../lib/brand";
import { downloadCsv, formatCurrency, formatDate, formatFixed, formatHours, formatNumber } from "../lib/format";

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

function ChartPanel({ title, subtitle, children, empty }: { title: string; subtitle?: string; children: ReactNode; empty: boolean }) {
  return (
    <div className="panel chart-panel">
      <div className="chart-title">
        <h2>{title}</h2>
        {subtitle && <span>{subtitle}</span>}
      </div>
      {empty ? <EmptyState text="No chart data" detail="Generate another period or department." /> : children}
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
  if (name === "Working Hours") return formatNumber(value);
  if (name.includes("Hours")) return formatHours(value);
  if (name === "AFR") return formatFixed(value, 2);
  return formatNumber(value);
}

export function ReportsPage() {
  const { lookups } = useLookups();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [departmentId, setDepartmentId] = useState("");
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(type: "monthly" | "yearly") {
    const query = new URLSearchParams({ year: String(year) });
    if (type === "monthly") query.set("month", String(month));
    if (departmentId) query.set("departmentId", departmentId);
    setLoading(true);
    setError("");
    try {
      setReport(await api<any>(`/api/reports/${type}?${query}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report generation failed");
    } finally {
      setLoading(false);
    }
  }

  function exportIncidents() {
    const rows = (report?.incidents || []).map((item: any) => ({
      incidentNo: item.incidentNo,
      date: formatDate(item.incidentDate),
      department: item.department?.name || "",
      employee: item.employee?.name || "",
      accidentType: item.incidentType?.name || "",
      injuryType: item.injuryType?.name || "",
      rootCause: item.rootCause?.name || "",
      lostMinutes: item.lostMinutes,
      status: item.status,
      description: item.description,
    }));
    downloadCsv(`${report.reportType}_incidents.csv`, rows);
  }

  function exportActions() {
    const rows = (report?.actions || []).map((item: any) => ({
      actionNo: item.actionNo,
      linkedRecord: item.incident?.incidentNo || item.observation?.observationNo || "",
      action: item.action,
      responsiblePerson: item.responsiblePerson || "",
      dueDate: formatDate(item.dueDate),
      completedDate: formatDate(item.completedDate),
      status: item.status,
      remarks: item.remarks || "",
    }));
    downloadCsv(`${report.reportType}_corrective_actions.csv`, rows);
  }

  function exportExpenses() {
    const rows = (report?.expenses || []).map((item: any) => ({
      expenseNo: item.expenseNo,
      date: formatDate(item.expenseDate),
      incidentNo: item.incident?.incidentNo || "",
      department: item.incident?.department?.name || "Company Total",
      amount: item.amount,
      type: item.expenseType || "",
      remarks: item.remarks || "",
    }));
    downloadCsv(`${report.reportType}_medical_expenses.csv`, rows);
  }

  function exportObservations() {
    const rows = (report?.observations || []).map((item: any) => ({
      observationNo: item.observationNo,
      date: formatDate(item.observationDate),
      department: item.department?.name || "Company Summary",
      type: item.type,
      riskLevel: item.riskLevel,
      status: item.status,
      reportedBy: item.reportedBy || "",
      description: item.description,
    }));
    downloadCsv(`${report.reportType}_near_miss_unsafe.csv`, rows);
  }

  const k = report?.dashboard?.kpis || {};
  const chartData = report?.dashboard?.charts || {};
  const monthlyTrend = chartData.monthlyTrend || [];
  const monthlyKpiSummary = chartData.monthlyKpiSummary || [];
  const departmentAccidentSummary = chartData.departmentAccidentSummary || chartData.departmentSummary || chartData.byDepartment || [];
  const departmentLostHours = chartData.departmentLostHours || departmentAccidentSummary;
  const medicalExpenseTrend = chartData.medicalExpenseTrend || monthlyTrend;
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

  return <section className="page-stack">
    <div className="panel filters">
      <Field label="Year"><input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></Field>
      <Field label="Month"><select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{months.map(([m, label]) => <option value={m} key={m}>{label}</option>)}</select></Field>
      <Field label="Department"><SelectLookup value={departmentId} onChange={setDepartmentId} items={lookups.departments} placeholder="All Departments" /></Field>
      <button className="primary" onClick={() => load("monthly")} disabled={loading}>Monthly HSE Summary</button>
      <button onClick={() => load("yearly")} disabled={loading}>Yearly HSE Summary</button>
    </div>

    {error && <div className="panel error-state"><strong>Report error</strong><span>{error}</span></div>}
    {loading && <div className="panel loading-state">Generating report...</div>}

    {!report && !loading ? <EmptyState text="No report generated" detail="Choose filters and generate a monthly or yearly report." /> : report && <>
      <div className="panel">
        <div className="report-brand-header">
          <div className="report-brand-title">
            <span className="logo-mark report-logo">
              <img src={companyLogoSrc} alt={brandName} />
            </span>
            <div>
              <p>{companyName}</p>
              <h2>{report.reportType.replace(/_/g, " ")}</h2>
              <small>{brandName} / {businessUnitName}</small>
              <small>Head Office: {companyProfile.headOffice}</small>
              <small>Factory: {companyProfile.factory}</small>
              <small>Generated {new Date(report.generatedAt).toLocaleString()}</small>
            </div>
          </div>
          <div className="report-brand-meta">
            <strong>{appName}</strong>
            <span>Safety Operations</span>
            <span>{companyProfile.phone}</span>
            <span>{companyProfile.email}</span>
          </div>
        </div>
        <div className="report-compliance-strip">
          {[...companyProfile.policyReferences, ...companyProfile.certifications].map((item) => <span key={item}>{item}</span>)}
        </div>
        <div className="kpi-list">
          <div className="kpi"><span>Total Accidents</span><strong>{formatNumber(k.totalIncidents)}</strong><small>Accident register report</small></div>
          <div className="kpi"><span>Lost Hours</span><strong>{formatHours(k.totalLostHours)}</strong><small>Selected report period</small></div>
          <div className="kpi"><span>Medical Expense</span><strong>{formatCurrency(k.medicalExpenseTotal)}</strong><small>Linked medical expenses</small></div>
          <div className="kpi"><span>Near Miss / Unsafe</span><strong>{formatNumber(k.observations)}</strong><small>Observation report</small></div>
        </div>
        <div className="form-actions" style={{ marginTop: 16 }}>
          <button onClick={exportIncidents}>Export Accident CSV</button>
          <button onClick={exportActions}>Export Action CSV</button>
          <button onClick={exportExpenses}>Export Medical CSV</button>
          <button onClick={exportObservations}>Export Near Miss / Unsafe CSV</button>
        </div>
      </div>

      <SectionHeader title="Charts & Analysis" detail="Charts use the selected report filters and live PostgreSQL data." />
      <div className="grid two">
        <ChartPanel title="Monthly HSE Summary" subtitle="Accidents, lost hours and medical expense" empty={!hasAny(monthlyTrend)}>
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={monthlyTrend} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis dataKey="label" />
              <YAxis yAxisId="left" allowDecimals={false} width={40} />
              <YAxis yAxisId="right" orientation="right" width={78} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip formatter={(value: number, name: string) => mixedTooltip(value, name)} />
              <Legend />
              <Bar yAxisId="left" dataKey="incidents" name="Accidents" fill={colors.accidents} radius={[5, 5, 0, 0]} />
              <Line yAxisId="left" type="monotone" dataKey="lostHours" name="Lost Hours" stroke={colors.lostHours} strokeWidth={3} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="medicalExpense" name="Medical Expense" stroke={colors.medical} strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Department Safety Performance" subtitle="Accident types and lost hours" empty={!hasAny(departmentAccidentSummary, ["count", "firstAid", "medicalTreatment", "reportable", "lostHours"])}>
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

        <ChartPanel title="Accident Type Summary" subtitle="First aid, medical, reportable and lost time" empty={!hasAny(accidentTypeBreakdown)}>
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

        <ChartPanel title="Injury Type Summary" subtitle="Grouped by injury type" empty={!hasAny(injuryTypeBreakdown)}>
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

        <ChartPanel title="Root Cause Analysis" subtitle="Grouped by root cause" empty={!hasAny(rootCauseSummary)}>
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={rootCauseSummary} layout="vertical" margin={{ top: 10, right: 18, left: 148, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={142} tickFormatter={axisName} />
              <Tooltip formatter={countTooltip} />
              <Bar dataKey="count" name="Accidents" fill={colors.accidents} radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Medical Expense Analysis" subtitle="Monthly LKR" empty={!hasAny(medicalExpenseTrend, ["medicalExpense"])}>
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

        <ChartPanel title="Medical Expense By Department" subtitle="LKR by department" empty={!hasAny(medicalExpenseByDepartment, ["medicalExpense"])}>
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={medicalExpenseByDepartment} layout="vertical" margin={{ top: 10, right: 18, left: 118, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis type="number" tickFormatter={(v) => formatNumber(v)} />
              <YAxis type="category" dataKey="name" width={112} tickFormatter={axisName} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="medicalExpense" name="Medical Expense" fill={colors.medical} radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Lost Hours Analysis" subtitle="Monthly lost hours and lost-time incidents" empty={!hasAny(lostHoursTrend, ["lostHours", "lostTimeIncidents"])}>
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={lostHoursTrend} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis dataKey="label" />
              <YAxis yAxisId="left" tickFormatter={(v) => formatNumber(v)} width={54} />
              <YAxis yAxisId="right" orientation="right" allowDecimals={false} width={38} />
              <Tooltip formatter={(value: number, name: string) => mixedTooltip(value, name)} />
              <Legend />
              <Bar yAxisId="left" dataKey="lostHours" name="Lost Hours" fill={colors.lostHours} radius={[5, 5, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="lostTimeIncidents" name="Lost-Time Incidents" stroke={colors.reportable} strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Corrective Action Status" subtitle="Pending, completed and overdue" empty={!hasAny(correctiveActionStatus)}>
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

        <ChartPanel title="Near Miss / Unsafe Analysis" subtitle="Monthly trend" empty={!hasAny(nearMissUnsafeTrend, ["nearMiss", "unsafeCondition", "total"])}>
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

        <ChartPanel title="Near Miss / Unsafe Closure Trend" subtitle="Completed and pending observation actions" empty={!hasAny(nearMissUnsafeClosureTrend, ["completed", "pending", "total"])}>
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

        <ChartPanel title="Working Hours / AFR Analysis" subtitle="Exposure and frequency" empty={!hasAny(workingHoursTrend, ["workingHours", "afr"])}>
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={workingHoursTrend} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5edf1" />
              <XAxis dataKey="label" />
              <YAxis yAxisId="left" tickFormatter={(v) => formatNumber(v)} width={78} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => formatFixed(v, 2)} width={54} />
              <Tooltip formatter={(value: number, name: string) => mixedTooltip(value, name)} />
              <Legend />
              <Bar yAxisId="left" dataKey="workingHours" name="Working Hours" fill={colors.workingHours} radius={[5, 5, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="afr" name="AFR" stroke={colors.afr} strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <SectionHeader title="Report Tables" detail="Export-friendly summaries matching the chart analysis above." />
      <div className="grid two">
        <div className="panel table-panel monthly-kpi-table">
          <div className="chart-title"><h2>Monthly KPI Summary</h2><span>{report.filters.year}</span></div>
          {!hasAny(monthlyKpiSummary, ["incidents", "medicalExpense", "nearMissUnsafe", "workingHours", "lostHours"]) ? <EmptyState text="No monthly KPI data" /> : (
            <table>
              <thead><tr><th>Month</th><th>Accidents</th><th>First Aid</th><th>Medical</th><th>Reportable</th><th>Lost Hours</th><th>Medical Expense</th><th>Near Miss / Unsafe</th><th>Working Hours</th><th>AFR</th></tr></thead>
              <tbody>{monthlyKpiSummary.map((row: any) => <tr key={row.month}><td>{row.label}</td><td>{formatNumber(row.incidents)}</td><td>{formatNumber(row.firstAid)}</td><td>{formatNumber(row.medicalTreatment)}</td><td>{formatNumber(row.reportable)}</td><td>{formatHours(row.lostHours)}</td><td>{formatCurrency(row.medicalExpense)}</td><td>{formatNumber(row.nearMissUnsafe)}</td><td>{formatNumber(row.workingHours)}</td><td>{formatFixed(row.afr, 2)}</td></tr>)}</tbody>
            </table>
          )}
        </div>

        <div className="panel table-panel">
          <div className="chart-title"><h2>Department Safety Summary</h2><span>{departmentAccidentSummary.length} departments</span></div>
          {!departmentAccidentSummary.length ? <EmptyState text="No department data" /> : (
            <table>
              <thead><tr><th>Department</th><th>Accidents</th><th>First Aid</th><th>Medical</th><th>Reportable</th><th>Lost Hours</th><th>Medical Expense</th></tr></thead>
              <tbody>{departmentAccidentSummary.map((row: any) => <tr key={row.id || row.name}><td>{row.name}</td><td>{formatNumber(row.count)}</td><td>{formatNumber(row.firstAid)}</td><td>{formatNumber(row.medicalTreatment)}</td><td>{formatNumber(row.reportable)}</td><td>{formatHours(row.lostHours)}</td><td>{formatCurrency(row.medicalExpense)}</td></tr>)}</tbody>
            </table>
          )}
        </div>

        <div className="panel table-panel">
          <div className="chart-title"><h2>Incident Register</h2><span>{formatNumber(report.incidents?.length || 0)} records</span></div>
          {!report.incidents?.length ? <EmptyState text="No accident records" /> : (
            <table>
              <thead><tr><th>No</th><th>Date</th><th>Department</th><th>Type</th><th>Injury</th><th>Lost Hours</th><th>Status</th></tr></thead>
              <tbody>{report.incidents.map((item: any) => <tr key={item.id}><td>{item.incidentNo}</td><td>{formatDate(item.incidentDate)}</td><td>{item.department?.name || "-"}</td><td>{item.incidentType?.name || "-"}</td><td>{item.injuryType?.name || "-"}</td><td>{formatHours(Number(item.lostMinutes || 0) / 60)}</td><td>{item.status}</td></tr>)}</tbody>
            </table>
          )}
        </div>

        <div className="panel table-panel">
          <div className="chart-title"><h2>Corrective Actions</h2><span>{formatNumber(report.actions?.length || 0)} records</span></div>
          {!report.actions?.length ? <EmptyState text="No corrective actions" /> : (
            <table>
              <thead><tr><th>No</th><th>Linked Record</th><th>Due Date</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>{report.actions.map((item: any) => <tr key={item.id}><td>{item.actionNo}</td><td>{item.incident?.incidentNo || item.observation?.observationNo || "-"}</td><td>{formatDate(item.dueDate)}</td><td>{item.status}</td><td>{item.action}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </div>
    </>}
  </section>;
}

