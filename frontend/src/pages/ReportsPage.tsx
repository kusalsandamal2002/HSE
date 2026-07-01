import { useState } from "react";
import { api } from "../lib/api";
import { months } from "../lib/enums";
import { useLookups } from "../hooks/useLookups";
import { EmptyState, Field, SelectLookup } from "../components/FormTools";
import { appName, brandName, businessUnitName, companyLogoSrc, companyName, companyProfile } from "../lib/brand";
import { downloadCsv, formatCurrency, formatDate, formatHours, formatNumber } from "../lib/format";
import type { User } from "../types";

type ReportMode = "monthly" | "yearly";

type ReportsPageProps = { user?: User | null };

function buildReportQuery(type: ReportMode, year: number, month: number, departmentId: string) {
  const query = new URLSearchParams({ year: String(year) });
  if (type === "monthly") query.set("month", String(month));
  if (departmentId) query.set("departmentId", departmentId);
  return query.toString();
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeDateStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

export function ReportsPage({ user }: ReportsPageProps) {
  const { lookups } = useLookups();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [departmentId, setDepartmentId] = useState("");
  const [report, setReport] = useState<any>(null);
  const [reportMode, setReportMode] = useState<ReportMode>("monthly");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const canUseFullBackup = user?.role === "ADMIN";

  async function load(type: ReportMode) {
    const query = buildReportQuery(type, year, month, departmentId);
    setLoading(`Generating ${type} report...`);
    setError("");
    setMessage("");

    try {
      const data = await api<any>(`/api/reports/${type}?${query}`);
      setReport(data);
      setReportMode(type);
      setMessage(`${type === "monthly" ? "Monthly" : "Yearly"} report generated successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report generation failed");
    } finally {
      setLoading("");
    }
  }

  async function downloadReportJson(type: ReportMode) {
    const query = buildReportQuery(type, year, month, departmentId);
    setLoading(`Preparing ${type} JSON download...`);
    setError("");
    setMessage("");

    try {
      const data = await api<any>(`/api/reports/${type}?${query}`);
      downloadJson(`hse-${type}-report-${safeDateStamp()}.json`, data);
      setMessage(`${type === "monthly" ? "Monthly" : "Yearly"} JSON report downloaded.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "JSON download failed");
    } finally {
      setLoading("");
    }
  }

  async function downloadFullBackup() {
    setLoading("Preparing full system backup...");
    setError("");
    setMessage("");

    try {
      const data = await api<any>("/api/reports/backup/system");
      downloadJson(`hse-full-system-backup-${safeDateStamp()}.json`, data);
      setMessage("Full system JSON backup downloaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Full backup failed");
    } finally {
      setLoading("");
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
    downloadCsv(`${report?.reportType || "HSE_REPORT"}_incidents.csv`, rows);
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
    downloadCsv(`${report?.reportType || "HSE_REPORT"}_corrective_actions.csv`, rows);
  }

  function exportExpenses() {
    const rows = (report?.expenses || []).map((item: any) => ({
      expenseNo: item.expenseNo,
      date: formatDate(item.expenseDate),
      incidentNo: item.incident?.incidentNo || "",
      department: item.incident?.department?.name || "Company Total",
      amount: item.amount,
      type: item.expenseType || "",
      provider: item.provider || "",
      billNo: item.billNo || "",
      remarks: item.remarks || "",
    }));
    downloadCsv(`${report?.reportType || "HSE_REPORT"}_medical_expenses.csv`, rows);
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
    downloadCsv(`${report?.reportType || "HSE_REPORT"}_near_miss_unsafe.csv`, rows);
  }

  function exportWorkingHours() {
    const rows = (report?.workingHours || []).map((item: any) => ({
      year: item.year,
      month: item.month,
      department: item.department?.name || "Company Total",
      totalEmployees: item.totalEmployees,
      regularHours: item.regularHours,
      overtimeHours: item.overtimeHours,
      remarks: item.remarks || "",
    }));
    downloadCsv(`${report?.reportType || "HSE_REPORT"}_working_hours.csv`, rows);
  }

  const k = report?.dashboard?.kpis || {};
  const hasReport = Boolean(report);

  const downloadCards = [
    {
      title: "Accident Register CSV",
      detail: "Download accident records from the generated report.",
      action: exportIncidents,
      disabled: !hasReport,
      count: report?.incidents?.length || 0,
    },
    {
      title: "Corrective Actions CSV",
      detail: "Download action status, responsible person and due date list.",
      action: exportActions,
      disabled: !hasReport,
      count: report?.actions?.length || 0,
    },
    {
      title: "Medical Expenses CSV",
      detail: "Download medical cost details linked to incidents.",
      action: exportExpenses,
      disabled: !hasReport,
      count: report?.expenses?.length || 0,
    },
    {
      title: "Near Miss / Unsafe CSV",
      detail: "Download near miss, unsafe act and unsafe condition records.",
      action: exportObservations,
      disabled: !hasReport,
      count: report?.observations?.length || 0,
    },
    {
      title: "Working Hours CSV",
      detail: "Download working hours and employee exposure records.",
      action: exportWorkingHours,
      disabled: !hasReport,
      count: report?.workingHours?.length || 0,
    },
  ];

  return (
    <section className="reports-download-page">
      <header className="rd-hero panel">
        <div className="report-brand-title">
          <span className="logo-mark report-logo">
            <img src={companyLogoSrc} alt={brandName} />
          </span>
          <div>
            <p>Reporting Center</p>
            <h2>Reports & Downloads</h2>
            <small>{companyName}</small>
            <small>{brandName} / {businessUnitName}</small>
          </div>
        </div>

        <div className="rd-hero-meta">
          <strong>{appName}</strong>
          <span>Report exports, CSV downloads, JSON backup and archive support</span>
          <small>Factory: {companyProfile.factory}</small>
        </div>
      </header>

      <div className="panel rd-filters">
        <Field label="Year">
          <input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} />
        </Field>

        <Field label="Month">
          <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
            {months.map(([m, label]) => <option value={m} key={m}>{label}</option>)}
          </select>
        </Field>

        <Field label="Department">
          <SelectLookup value={departmentId} onChange={setDepartmentId} items={lookups.departments} placeholder="All Departments" />
        </Field>

        <button className="primary" onClick={() => load("monthly")} disabled={Boolean(loading)}>Generate Monthly Report</button>
        <button onClick={() => load("yearly")} disabled={Boolean(loading)}>Generate Yearly Report</button>
      </div>

      {loading && <div className="panel loading-state">{loading}</div>}
      {error && <div className="panel error-state"><strong>Report error</strong><span>{error}</span></div>}
      {message && <div className="panel success-state"><strong>Done</strong><span>{message}</span></div>}

      <div className="rd-grid">
        <section className="panel rd-card rd-main-card">
          <span className="rd-kicker">Generated Report</span>
          <h2>{hasReport ? report.reportType.replace(/_/g, " ") : "No report generated"}</h2>
          <p>{hasReport ? `Generated at ${new Date(report.generatedAt).toLocaleString()}` : "Choose filters and generate a monthly or yearly report first."}</p>

          {hasReport ? (
            <div className="kpi-list rd-kpis">
              <div className="kpi"><span>Total Accidents</span><strong>{formatNumber(k.totalIncidents)}</strong><small>Selected period</small></div>
              <div className="kpi"><span>Lost Hours</span><strong>{formatHours(k.totalLostHours)}</strong><small>Incident lost time</small></div>
              <div className="kpi"><span>Medical Expense</span><strong>{formatCurrency(k.medicalExpenseTotal)}</strong><small>Linked expenses</small></div>
              <div className="kpi"><span>Near Miss / Unsafe</span><strong>{formatNumber(k.observations)}</strong><small>Observation records</small></div>
            </div>
          ) : (
            <EmptyState text="No report generated" detail="Generate a report to enable CSV download buttons." />
          )}
        </section>

        <section className="panel rd-card">
          <span className="rd-kicker">JSON Reports</span>
          <h2>Structured Report Downloads</h2>
          <p>Download report data as JSON for audit, archive, or future analysis.</p>
          <div className="rd-button-stack">
            <button onClick={() => downloadReportJson("monthly")} disabled={Boolean(loading)}>Download Monthly JSON</button>
            <button onClick={() => downloadReportJson("yearly")} disabled={Boolean(loading)}>Download Yearly JSON</button>
          </div>
        </section>
        {canUseFullBackup && (
          <section className="panel rd-card rd-danger-card">
            <span className="rd-kicker">System Backup</span>
            <h2>Full System JSON Backup</h2>
            <p>Exports master data, HSE records, ESG snapshots, company profile, TV settings and import history. Password hashes are excluded.</p>
            <button className="primary" onClick={downloadFullBackup} disabled={Boolean(loading)}>Download Full Backup</button>
            <small>This is a JSON export archive, not a one-click database restore file.</small>
          </section>
        )}
      </div>

      <section className="panel">
        <div className="chart-title">
          <h2>CSV Download Center</h2>
          <span>{hasReport ? `${reportMode.toUpperCase()} report loaded` : "Generate a report first"}</span>
        </div>

        <div className="rd-download-grid">
          {downloadCards.map((card) => (
            <button key={card.title} className="rd-download-card" onClick={card.action} disabled={card.disabled}>
              <span>{card.count} records</span>
              <strong>{card.title}</strong>
              <small>{card.detail}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel rd-note">
        <strong>Recommended workflow</strong>
        <p>
          Generate monthly/yearly report first, review KPI summary, then download required CSV files.
          Use Full System JSON Backup before major data changes or monthly archive submission.
        </p>
      </section>
    </section>
  );
}

