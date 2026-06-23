import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { months, observationTypes, recordStatuses, riskLevels } from "../lib/enums";
import { useLookups } from "../hooks/useLookups";
import { EmptyState, ErrorState, Field, LoadingState, SelectLookup, StatusBadge } from "../components/FormTools";
import { formatDate } from "../lib/format";

const blank = { observationDate: new Date().toISOString().slice(0, 10), observationTime: "", departmentId: "", type: "NEAR_MISS", riskLevel: "LOW", description: "", actionTaken: "", reportedBy: "", status: "PENDING" };

export function ObservationsPage() {
  const { lookups } = useLookups();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    const params = new URLSearchParams({ year: String(year) });
    if (month) params.set("month", month);
    if (departmentId) params.set("departmentId", departmentId);
    if (type) params.set("type", type);
    setLoading(true);
    setError("");
    api<any[]>(`/api/observations?${params}`)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load observations"))
      .finally(() => setLoading(false));
  }
  useEffect(load, [year, month, departmentId, type]);

  const summary = useMemo(() => ({
    total: items.length,
    nearMiss: items.filter((item) => item.type === "NEAR_MISS").length,
    unsafeCondition: items.filter((item) => item.type === "UNSAFE_CONDITION").length,
    pending: items.filter((item) => ["PENDING", "IN_PROGRESS"].includes(item.status)).length,
  }), [items]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api(editingId ? `/api/observations/${editingId}` : "/api/observations", { method: editingId ? "PUT" : "POST", body: JSON.stringify(form) });
      setForm(blank);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function remove(id: string) {
    if (confirm("Delete observation?")) {
      await api(`/api/observations/${id}`, { method: "DELETE" });
      load();
    }
  }

  if (loading) return <LoadingState text="Loading near miss / unsafe records..." />;
  if (error && !items.length) return <ErrorState message={error} />;

  return <section className="page-stack">
    <form className="panel form-grid" onSubmit={submit}>
      <h2>{editingId ? "Edit Observation" : "Near Miss / Unsafe Condition"}</h2>
      <Field label="Date" required><input type="date" value={form.observationDate} onChange={(e) => setForm({ ...form, observationDate: e.target.value })} required /></Field>
      <Field label="Time"><input value={form.observationTime || ""} onChange={(e) => setForm({ ...form, observationTime: e.target.value })} /></Field>
      <Field label="Department"><SelectLookup value={form.departmentId} onChange={(value) => setForm({ ...form, departmentId: value })} items={lookups.departments} /></Field>
      <Field label="Type"><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{observationTypes.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Risk"><select value={form.riskLevel} onChange={(e) => setForm({ ...form, riskLevel: e.target.value })}>{riskLevels.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{recordStatuses.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Reported By"><input value={form.reportedBy || ""} onChange={(e) => setForm({ ...form, reportedBy: e.target.value })} /></Field>
      <label className="field wide"><span>Description <b>*</b></span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></label>
      <label className="field wide"><span>Action Taken</span><textarea value={form.actionTaken || ""} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} /></label>
      {error && <p className="error wide">{error}</p>}
      <div className="form-actions wide"><button className="primary">Save</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }}>Cancel</button>}</div>
    </form>

    <div className="panel filters">
      <Field label="Year"><input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></Field>
      <Field label="Month"><select value={month} onChange={(e) => setMonth(e.target.value)}><option value="">Full Year</option>{months.map(([m, label]) => <option key={m} value={m}>{label}</option>)}</select></Field>
      <Field label="Department"><SelectLookup value={departmentId} onChange={setDepartmentId} items={lookups.departments} placeholder="All Departments" /></Field>
      <Field label="Type"><select value={type} onChange={(e) => setType(e.target.value)}><option value="">All Types</option>{observationTypes.map((item) => <option key={item}>{item}</option>)}</select></Field>
    </div>

    <div className="summary-strip">
      <div className="summary-item"><span>Total Records</span><strong>{summary.total}</strong></div>
      <div className="summary-item"><span>Near Miss</span><strong>{summary.nearMiss}</strong></div>
      <div className="summary-item"><span>Unsafe Conditions</span><strong>{summary.unsafeCondition}</strong></div>
      <div className="summary-item"><span>Open Actions</span><strong>{summary.pending}</strong></div>
    </div>

    <div className="panel table-panel">
      <div className="section-heading"><div><h2>Near Miss / Unsafe Records</h2><p>{items.length} record(s)</p></div></div>
      {!items.length ? <EmptyState text="No near miss or unsafe records found" /> : <table><thead><tr><th>No</th><th>Date</th><th>Department</th><th>Type</th><th>Risk</th><th>Reported By</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.observationNo}</td><td>{formatDate(item.observationDate)}</td><td>{item.department?.name || "Company Summary"}</td><td><StatusBadge value={item.type} tone="neutral" /></td><td><StatusBadge value={item.riskLevel} /></td><td>{item.reportedBy || "-"}</td><td>{item.description}</td><td><StatusBadge value={item.status} /></td><td className="row-actions"><button onClick={() => { setEditingId(item.id); setForm({ ...item, observationDate: item.observationDate.slice(0, 10), departmentId: item.department?.id || item.departmentId || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button><button className="danger" onClick={() => remove(item.id)}>Delete</button></td></tr>)}</tbody></table>}
    </div>
  </section>;
}