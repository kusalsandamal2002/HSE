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
};

type DataQualitySummary = {
  year: number;
  month: number;
  overallStatus: string;
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
  issues: DataQualityIssue[];
};

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

  const metricCards = useMemo(() => summary?.kpis ?? [], [summary]);

  return (
    <div className="data-entry-page">
      <section className="data-entry-hero">
        <div>
          <p className="eyebrow">DATA QUALITY</p>
          <h2>Data Quality Center</h2>
          <p>Compare source totals, database totals, and dashboard values for the selected month.</p>
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
            <h3>Overall Status</h3>
            <div className="data-entry-card-grid">
              <div className="data-entry-card">
                <span>Period</span>
                <strong>{summary.year}-{String(summary.month).padStart(2, "0")}</strong>
                <p>{summary.overallStatus}</p>
              </div>
              <div className="data-entry-card">
                <span>Matched KPIs</span>
                <strong>{summary.kpis.filter((item) => item.status === "Matched").length}</strong>
                <p>of {summary.kpis.length}</p>
              </div>
              <div className="data-entry-card">
                <span>Issues</span>
                <strong>{summary.issues.length}</strong>
                <p>mismatch entries</p>
              </div>
            </div>
          </section>

          <section className="data-entry-section">
            <h3>KPI Comparison</h3>
            <div className="data-entry-card-grid">
              {metricCards.map((metric) => (
                <div key={metric.key} className="data-entry-card">
                  <span>{metric.label}</span>
                  <strong>Expected: {metric.expectedValue}</strong>
                  <p>Database: {metric.databaseValue}</p>
                  <small>Status: {metric.status}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="data-entry-section">
            <h3>Issue Detail</h3>
            {summary.issues.length ? (
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Issue</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.issues.map((issue) => (
                    <tr key={issue.metric}>
                      <td>{issue.metric}</td>
                      <td>{issue.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No mismatches detected.</p>
            )}
          </section>

          <section className="data-entry-section">
            <h3>Department Breakdown</h3>
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
          </section>
        </>
      ) : null}
    </div>
  );
}
