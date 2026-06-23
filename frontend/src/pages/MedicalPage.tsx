import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { months } from "../lib/enums";
import { EmptyState, ErrorState, Field, LoadingState } from "../components/FormTools";
import { formatCurrency, formatDate } from "../lib/format";
import type { Incident } from "../types";

const blank = { incidentId: "", expenseDate: new Date().toISOString().slice(0, 10), amount: 0, expenseType: "", provider: "", billNo: "", remarks: "" };

export function MedicalPage() {
  const [items, setItems] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [form, setForm] = useState<any>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    const params = new URLSearchParams({ year: String(year) });
    if (month) params.set("month", month);
    setLoading(true);
    setError("");
    Promise.all([
      api<any[]>(`/api/medical-expenses?${params}`),
      api<Incident[]>(`/api/incidents?year=${year}&limit=1000`),
    ])
      .then(([expenses, incidentRows]) => { setItems(expenses); setIncidents(incidentRows); })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load medical expenses"))
      .finally(() => setLoading(false));
  }
  useEffect(load, [year, month]);

  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.amount || 0), 0), [items]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api(editingId ? `/api/medical-expenses/${editingId}` : "/api/medical-expenses", { method: editingId ? "PUT" : "POST", body: JSON.stringify({ ...form, amount: Number(form.amount || 0), incidentId: form.incidentId || null }) });
      setForm(blank);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function remove(id: string) {
    if (confirm("Delete this expense?")) {
      await api(`/api/medical-expenses/${id}`, { method: "DELETE" });
      load();
    }
  }

  if (loading) return <LoadingState text="Loading medical expenses..." />;
  if (error && !items.length) return <ErrorState message={error} />;

  return <section className="page-stack">
    <form className="panel form-grid" onSubmit={submit}>
      <h2>{editingId ? "Edit Medical Expense" : "Medical Expense Entry"}</h2>
      <Field label="Related Incident"><select value={form.incidentId || ""} onChange={(e) => setForm({ ...form, incidentId: e.target.value })}><option value="">Monthly / unlinked expense</option>{incidents.map((incident) => <option key={incident.id} value={incident.id}>{incident.incidentNo} - {incident.department?.name || "Unassigned"}</option>)}</select></Field>
      <Field label="Date" required><input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} required /></Field>
      <Field label="Amount" required><input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
      <Field label="Type"><input value={form.expenseType || ""} onChange={(e) => setForm({ ...form, expenseType: e.target.value })} /></Field>
      <Field label="Provider"><input value={form.provider || ""} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></Field>
      <Field label="Bill No"><input value={form.billNo || ""} onChange={(e) => setForm({ ...form, billNo: e.target.value })} /></Field>
      <label className="field wide"><span>Remarks</span><textarea value={form.remarks || ""} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></label>
      {error && <p className="error wide">{error}</p>}
      <div className="form-actions wide"><button className="primary">Save</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }}>Cancel</button>}</div>
    </form>

    <div className="panel filters">
      <Field label="Year"><input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></Field>
      <Field label="Month"><select value={month} onChange={(e) => setMonth(e.target.value)}><option value="">Full Year</option>{months.map(([m, label]) => <option key={m} value={m}>{label}</option>)}</select></Field>
      <div className="summary-item"><span>Total Medical Expense</span><strong>{formatCurrency(total)}</strong></div>
    </div>

    <div className="panel table-panel">
      <div className="section-heading"><div><h2>Medical Expenses</h2><p>{items.length} expense record(s)</p></div></div>
      {!items.length ? <EmptyState text="No medical expenses found" /> : <table><thead><tr><th>No</th><th>Date</th><th>Incident / Month</th><th>Department</th><th>Amount</th><th>Description / Remarks</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.expenseNo}</td><td>{formatDate(item.expenseDate)}</td><td>{item.incident?.incidentNo || item.expenseType || "Monthly Summary"}</td><td>{item.incident?.department?.name || "Company Total"}</td><td>{formatCurrency(item.amount)}</td><td>{item.remarks || item.provider || "-"}</td><td className="row-actions"><button onClick={() => { setEditingId(item.id); setForm({ ...item, incidentId: item.incidentId || item.incident?.id || "", expenseDate: item.expenseDate.slice(0, 10) }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button><button className="danger" onClick={() => remove(item.id)}>Delete</button></td></tr>)}</tbody></table>}
    </div>
  </section>;
}