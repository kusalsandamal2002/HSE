import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type DataQualityMetric = {
  key: string;
  label: string;
  expectedValue: number;
  databaseValue: number;
  status: "Matched" | "Mismatch";
};

type DataQualityIssue = {
  metric: string;
  message: string;
  severity: "INFO" | "WARNING" | "ERROR";
  category: string;
  action: string;
};

type DataQualityCheck = {
  key: string;
  label: string;
  value: number;
  status: "Passed" | "Warning" | "Failed" | "Info";
  severity: "PASS" | "INFO" | "WARNING" | "ERROR";
  description: string;
  action: string;
};

type DataQualitySummary = {
  year: number;
  month: number;
  overallStatus: string;
  healthScore: number;
  sourceTotals: {
    totalAccidents: number;
    firstAidCount: number;
    medicalTreatmentCount: number;
    reportableCount: number;
    totalMedicalExpenses: number;
    nearMissUnsafeCount: number;
    workingHoursTotal: number;
  };
  databaseTotals: {
    totalAccidents: number;
    firstAidCount: number;
    medicalTreatmentCount: number;
    reportableCount: number;
    totalMedicalExpenses: number;
    nearMissUnsafeCount: number;
    workingHoursTotal: number;
  };
  departmentIncidentCounts: Array<{ department: string; count: number }>;
  kpis: DataQualityMetric[];
  checks: DataQualityCheck[];
  issues: DataQualityIssue[];
};

const severityLabel = {
  PASS: "Passed",
  INFO: "Info",
  WARNING: "Warning",
  ERROR: "Critical",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function pillClass(severity: DataQualityCheck["severity"] | DataQualityIssue["severity"]) {
  return `quality-pill quality-${severity.toLowerCase()}`;
}

export function DataQualityCenterPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<DataQualitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadSummary = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await api<DataQualitySummary>(`/api/data-quality/monthly?year=${year}&month=${month}`);
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data quality summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, [year, month]);

  const groupedChecks = useMemo(() => {
    const priority = { ERROR: 0, WARNING: 1, INFO: 2, PASS: 3 };
    return [...(summary?.checks ?? [])].sort((a, b) => priority[a.severity] - priority[b.severity]);
  }, [summary]);

  const criticalCount = summary?.checks.filter((item) => item.severity === "ERROR").length ?? 0;
  const warningCount = summary?.checks.filter((item) => item.severity === "WARNING").length ?? 0;
  const infoCount = summary?.checks.filter((item) => item.severity === "INFO").length ?? 0;

  return (
    <div className="data-entry-page">
      <section className="data-entry-hero">
        <div>
          <p className="eyebrow">DATA QUALITY</p>
          <h2>Data Quality Center</h2>
          <p>Monitor dashboard reliability, missing master-data links, open actions, import failures, and ESG/working-hour coverage.</p>
        </div>
        <div className="data-entry-search">
          <label>Year</label>
          <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {[2025, 2026, 2027].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <label>Month</label>
          <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <button onClick={() => void loadSummary()}>Refresh</button>
        </div>
      </section>

      {error ? <div className="data-entry-error">{error}</div> : null}
      {loading ? <div className="data-entry-loading">Loading quality report...</div> : null}

      {summary ? (
        <>
          <section className="data-entry-section">
            <h3>Quality Health</h3>
            <div className="quality-hero-grid">
              <div className="quality-score-card">
                <span>Health Score</span>
                <strong>{summary.healthScore}%</strong>
                <p>{summary.overallStatus}</p>
              </div>
              <div className="data-entry-card">
                <span>Critical</span>
                <strong>{criticalCount}</strong>
                <p>must fix before final reports</p>
              </div>
              <div className="data-entry-card">
                <span>Warnings</span>
                <strong>{warningCount}</strong>
                <p>follow-up required</p>
              </div>
              <div className="data-entry-card">
                <span>Info</span>
                <strong>{infoCount}</strong>
                <p>tracked items</p>
              </div>
            </div>
          </section>

          <section className="data-entry-section">
            <h3>Monthly KPI Snapshot</h3>
            <div className="data-entry-card-grid">
              {summary.kpis.map((metric) => (
                <div key={metric.key} className="data-entry-card">
                  <span>{metric.label}</span>
                  <strong>{formatNumber(metric.databaseValue)}</strong>
                  <p>Period: {summary.year}-{String(summary.month).padStart(2, "0")}</p>
                  <small>Status: {metric.status}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="data-entry-section">
            <h3>Quality Checks</h3>
            <div className="quality-check-list">
              {groupedChecks.map((item) => (
                <article key={item.key} className={`quality-check quality-${item.severity.toLowerCase()}`}>
                  <div>
                    <span className={pillClass(item.severity)}>{severityLabel[item.severity]}</span>
                    <h4>{item.label}</h4>
                    <p>{item.description}</p>
                    <small>{item.action}</small>
                  </div>
                  <strong>{formatNumber(item.value)}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="data-entry-section">
            <h3>Issue Details</h3>
            {summary.issues.length ? (
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Metric</th>
                    <th>Issue</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.issues.map((issue) => (
                    <tr key={`${issue.severity}-${issue.metric}`}>
                      <td><span className={pillClass(issue.severity)}>{issue.severity}</span></td>
                      <td>{issue.metric}</td>
                      <td>{issue.message}</td>
                      <td>{issue.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No data quality issues detected.</p>
            )}
          </section>

          <section className="data-entry-section">
            <h3>Department Breakdown</h3>
            {summary.departmentIncidentCounts.length ? (
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Incident Count</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.departmentIncidentCounts.map((row) => (
                    <tr key={row.department}>
                      <td>{row.department}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No incidents recorded for the selected month.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
