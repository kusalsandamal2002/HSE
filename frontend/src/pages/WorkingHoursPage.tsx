import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { months } from "../lib/enums";
import { useLookups } from "../hooks/useLookups";
import { EmptyState, ErrorState, Field, LoadingState, SelectLookup } from "../components/FormTools";
import { formatHours, formatMonthName, formatNumber } from "../lib/format";

const blank = { year: new Date().getFullYear(), month: new Date().getMonth() + 1, departmentId: "", totalEmployees: 0, regularHours: 0, overtimeHours: 0, remarks: "" };

export function WorkingHoursPage() {
  const { lookups } = useLookups();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    const params = new URLSearchParams({ year: String(year) });
    if (month) params.set("month", month);
    if (departmentId) params.set("departmentId", departmentId);
    setLoading(true);
    setError("");
    api<any[]>(`/api/working-hours?${params}`)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load working hours"))
      .finally(() => setLoading(false));
  }
  useEffect(load, [year, month, departmentId]);

  const totalHours = useMemo(() => items.reduce((sum, item) => sum + Number(item.regularHours || 0) + Number(item.overtimeHours || 0), 0), [items]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api(editingId ? `/api/working-hours/${editingId}` : "/api/working-hours", { method: editingId ? "PUT" : "POST", body: JSON.stringify({ ...form, year: Number(form.year), month: Number(form.month), totalEmployees: Number(form.totalEmployees), regularHours: Number(form.regularHours), overtimeHours: Number(form.overtimeHours), departmentId: form.departmentId || null }) });
      setForm(blank);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function remove(id: string) {
    if (confirm("Delete working hours record?")) {
      await api(`/api/working-hours/${id}`, { method: "DELETE" });
      load();
    }
  }

  if (loading) return <LoadingState text="Loading working hours..." />;
  if (error && !items.length) return <ErrorState message={error} />;

  return <section className="page-stack">
    <form className="panel form-grid" onSubmit={submit}>
      <h2>{editingId ? "Edit Working Hours" : "Working Hours Entry"}</h2>
      <Field label="Year" required><input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} required /></Field>
      <Field label="Month" required><select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}>{months.map(([m, label]) => <option key={m} value={m}>{label}</option>)}</select></Field>
      <Field label="Department"><SelectLookup value={form.departmentId} onChange={(value) => setForm({ ...form, departmentId: value })} items={lookups.departments} placeholder="Company Total" /></Field>
      <Field label="Employees"><input type="number" min="0" value={form.totalEmployees} onChange={(e) => setForm({ ...form, totalEmployees: e.target.value })} /></Field>
      <Field label="Regular Hours"><input type="number" min="0" value={form.regularHours} onChange={(e) => setForm({ ...form, regularHours: e.target.value })} /></Field>
      <Field label="Overtime Hours"><input type="number" min="0" value={form.overtimeHours} onChange={(e) => setForm({ ...form, overtimeHours: e.target.value })} /></Field>
      <label className="field wide"><span>Remarks</span><textarea value={form.remarks || ""} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></label>
      {error && <p className="error wide">{error}</p>}
      <div className="form-actions wide"><button className="primary">Save</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }}>Cancel</button>}</div>
    </form>

    <div className="panel filters">
      <Field label="Year"><input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></Field>
      <Field label="Month"><select value={month} onChange={(e) => setMonth(e.target.value)}><option value="">Full Year</option>{months.map(([m, label]) => <option key={m} value={m}>{label}</option>)}</select></Field>
      <Field label="Department"><SelectLookup value={departmentId} onChange={setDepartmentId} items={lookups.departments} placeholder="All / Company Total" /></Field>
      <div className="summary-item"><span>Total Working Hours</span><strong>{formatNumber(totalHours)}</strong></div>
    </div>

    <div className="panel">
      <strong>AFR calculation:</strong> <span className="hint">Accident Frequency Rate = total accidents x 200,000 / working hours. The dashboard uses company-total working-hour rows when no department is selected.</span>
    </div>

    <div className="panel table-panel">
      <div className="section-heading"><div><h2>Working Hours</h2><p>{items.length} record(s)</p></div></div>
      {!items.length ? <EmptyState text="No working-hour records found" /> : <table><thead><tr><th>Year</th><th>Month</th><th>Department</th><th>Employees</th><th>Regular</th><th>Overtime</th><th>Total</th><th>Remarks</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.year}</td><td>{formatMonthName(item.month)}</td><td>{item.department?.name || "Company Total"}</td><td>{item.totalEmployees}</td><td>{formatNumber(item.regularHours)}</td><td>{formatNumber(item.overtimeHours)}</td><td>{formatHours(Number(item.regularHours || 0) + Number(item.overtimeHours || 0))}</td><td>{item.remarks || "-"}</td><td className="row-actions"><button onClick={() => { setEditingId(item.id); setForm({ ...item, departmentId: item.department?.id || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button><button className="danger" onClick={() => remove(item.id)}>Delete</button></td></tr>)}</tbody></table>}
    </div>
  </section>;
}