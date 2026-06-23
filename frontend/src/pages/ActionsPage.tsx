import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { recordStatuses } from "../lib/enums";
import { EmptyState, ErrorState, Field, LoadingState, StatusBadge } from "../components/FormTools";
import { formatDate, isOverdue } from "../lib/format";

const blank = { action: "", responsiblePerson: "", dueDate: "", completedDate: "", status: "PENDING", remarks: "" };

export function ActionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    setError("");
    api<any[]>("/api/corrective-actions")
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load actions"))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const summary = useMemo(() => ({
    pending: items.filter((item) => item.status === "PENDING").length,
    inProgress: items.filter((item) => item.status === "IN_PROGRESS").length,
    completed: items.filter((item) => ["COMPLETED", "CLOSED"].includes(item.status)).length,
    overdue: items.filter((item) => isOverdue(item.dueDate, item.status)).length,
  }), [items]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api(editingId ? `/api/corrective-actions/${editingId}` : "/api/corrective-actions", { method: editingId ? "PUT" : "POST", body: JSON.stringify(form) });
      setForm(blank);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function remove(id: string) {
    if (confirm("Delete this corrective action?")) {
      await api(`/api/corrective-actions/${id}`, { method: "DELETE" });
      load();
    }
  }

  if (loading) return <LoadingState text="Loading corrective actions..." />;
  if (error && !items.length) return <ErrorState message={error} />;

  return <section className="page-stack">
    <form className="panel form-grid" onSubmit={submit}>
      <h2>{editingId ? "Edit Corrective Action" : "Add Corrective Action"}</h2>
      <label className="field wide"><span>Action <b>*</b></span><textarea value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} required /></label>
      <Field label="Responsible Person"><input value={form.responsiblePerson || ""} onChange={(e) => setForm({ ...form, responsiblePerson: e.target.value })} /></Field>
      <Field label="Due Date"><input type="date" value={form.dueDate || ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
      <Field label="Completed Date"><input type="date" value={form.completedDate || ""} onChange={(e) => setForm({ ...form, completedDate: e.target.value })} /></Field>
      <Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{recordStatuses.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <label className="field wide"><span>Remarks</span><textarea value={form.remarks || ""} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></label>
      {error && <p className="error wide">{error}</p>}
      <div className="form-actions wide"><button className="primary">Save</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }}>Cancel</button>}</div>
    </form>

    <div className="summary-strip">
      <div className="summary-item"><span>Pending</span><strong>{summary.pending}</strong></div>
      <div className="summary-item"><span>In Progress</span><strong>{summary.inProgress}</strong></div>
      <div className="summary-item"><span>Completed</span><strong>{summary.completed}</strong></div>
      <div className="summary-item"><span>Overdue</span><strong>{summary.overdue}</strong></div>
    </div>

    <div className="panel table-panel">
      <div className="section-heading"><div><h2>Corrective Action Tracker</h2><p>{items.length} action(s)</p></div></div>
      {!items.length ? <EmptyState text="No corrective actions found" /> : <table><thead><tr><th>No</th><th>Action</th><th>Related Record</th><th>Responsible</th><th>Due Date</th><th>Completed Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map((item) => {
        const overdue = isOverdue(item.dueDate, item.status);
        return <tr key={item.id}><td>{item.actionNo}</td><td>{item.action}</td><td>{item.incident?.incidentNo || item.observation?.observationNo || "-"}</td><td>{item.responsiblePerson || "-"}</td><td>{formatDate(item.dueDate)} {overdue && <StatusBadge value="Overdue" tone="overdue" />}</td><td>{formatDate(item.completedDate)}</td><td><StatusBadge value={item.status} /></td><td className="row-actions"><button onClick={() => { setEditingId(item.id); setForm({ ...item, dueDate: item.dueDate?.slice(0, 10) || "", completedDate: item.completedDate?.slice(0, 10) || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button><button className="danger" onClick={() => remove(item.id)}>Delete</button></td></tr>;
      })}</tbody></table>}
    </div>
  </section>;
}