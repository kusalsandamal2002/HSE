import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { months, recordStatuses, severities } from "../lib/enums";
import { useLookups } from "../hooks/useLookups";
import { EmptyState, ErrorState, Field, LoadingState, SelectLookup, StatusBadge } from "../components/FormTools";
import { formatCurrency, formatDate, lostMinutesToHours } from "../lib/format";
import type { Incident } from "../types";

const blank = {
  incidentDate: new Date().toISOString().slice(0, 10), incidentTime: "", departmentId: "", shiftId: "", employeeId: "", machineId: "",
  incidentTypeId: "", injuryTypeId: "", rootCauseId: "", description: "", immediateAction: "", correctiveAction: "", lostMinutes: 0,
  medicalExpenseTotal: 0, severity: "LOW", status: "PENDING",
};

export function IncidentsPage() {
  const { lookups } = useLookups();
  const [items, setItems] = useState<Incident[]>([]);
  const [form, setForm] = useState<any>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    const params = new URLSearchParams({ year: String(year) });
    if (month) params.set("month", month);
    if (departmentId) params.set("departmentId", departmentId);
    if (status) params.set("status", status);
    setLoading(true);
    setError("");
    api<Incident[]>(`/api/incidents?${params}`)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load incidents"))
      .finally(() => setLoading(false));
  }
  useEffect(load, [year, month, departmentId, status]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => [
      item.incidentNo,
      item.description,
      item.department?.name,
      item.employee?.name,
      item.employee?.empNo,
      item.incidentType?.name,
      item.injuryType?.name,
      item.rootCause?.name,
      item.status,
    ].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [items, search]);

  function update(key: string, value: any) { setForm((previous: any) => ({ ...previous, [key]: value })); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/incidents/${editingId}` : "/api/incidents";
    try {
      await api(url, { method, body: JSON.stringify({ ...form, lostMinutes: Number(form.lostMinutes || 0), medicalExpenseTotal: Number(form.medicalExpenseTotal || 0) }) });
      setForm(blank);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  function edit(item: Incident) {
    setEditingId(item.id);
    setSelected(null);
    setForm({
      incidentNo: item.incidentNo,
      incidentDate: item.incidentDate.slice(0, 10),
      incidentTime: item.incidentTime || "",
      departmentId: item.department?.id || "", shiftId: item.shift?.id || "", employeeId: item.employee?.id || "", machineId: item.machine?.id || "",
      incidentTypeId: item.incidentType?.id || "", injuryTypeId: item.injuryType?.id || "", rootCauseId: item.rootCause?.id || "",
      description: item.description, immediateAction: item.immediateAction || "", correctiveAction: item.correctiveAction || "",
      lostMinutes: item.lostMinutes || 0, medicalExpenseTotal: Number(item.medicalExpenseTotal || 0), severity: item.severity, status: item.status,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id: string) {
    if (confirm("Soft delete this accident record?")) {
      await api(`/api/incidents/${id}`, { method: "DELETE" });
      load();
    }
  }

  if (loading) return <LoadingState text="Loading accident register..." />;
  if (error && !items.length) return <ErrorState message={error} />;

  return (
    <section className="page-stack">
      <form className="panel form-grid" onSubmit={submit}>
        <h2>{editingId ? "Edit Accident / Incident" : "Add Accident / Incident"}</h2>
        <Field label="Incident No"><input value={form.incidentNo || ""} placeholder="Auto" onChange={(e) => update("incidentNo", e.target.value)} /></Field>
        <Field label="Date" required><input type="date" value={form.incidentDate} onChange={(e) => update("incidentDate", e.target.value)} required /></Field>
        <Field label="Time"><input value={form.incidentTime} onChange={(e) => update("incidentTime", e.target.value)} /></Field>
        <Field label="Department"><SelectLookup value={form.departmentId} onChange={(v) => update("departmentId", v)} items={lookups.departments} /></Field>
        <Field label="Shift"><SelectLookup value={form.shiftId} onChange={(v) => update("shiftId", v)} items={lookups.shifts} /></Field>
        <Field label="Employee"><SelectLookup value={form.employeeId} onChange={(v) => update("employeeId", v)} items={lookups.employees} /></Field>
        <Field label="Line / Machine"><SelectLookup value={form.machineId} onChange={(v) => update("machineId", v)} items={lookups.machines} /></Field>
        <Field label="Accident Type"><SelectLookup value={form.incidentTypeId} onChange={(v) => update("incidentTypeId", v)} items={lookups.incidentTypes} /></Field>
        <Field label="Injury Type"><SelectLookup value={form.injuryTypeId} onChange={(v) => update("injuryTypeId", v)} items={lookups.injuryTypes} /></Field>
        <Field label="Root Cause"><SelectLookup value={form.rootCauseId} onChange={(v) => update("rootCauseId", v)} items={lookups.rootCauses} /></Field>
        <Field label="Lost Minutes"><input type="number" min="0" value={form.lostMinutes} onChange={(e) => update("lostMinutes", e.target.value)} /></Field>
        <Field label="Medical Expense"><input type="number" min="0" value={form.medicalExpenseTotal} onChange={(e) => update("medicalExpenseTotal", e.target.value)} /></Field>
        <Field label="Severity"><select value={form.severity} onChange={(e) => update("severity", e.target.value)}>{severities.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Status"><select value={form.status} onChange={(e) => update("status", e.target.value)}>{recordStatuses.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <label className="field wide"><span>Description <b>*</b></span><textarea value={form.description} onChange={(e) => update("description", e.target.value)} required /></label>
        <label className="field wide"><span>Immediate Action</span><textarea value={form.immediateAction} onChange={(e) => update("immediateAction", e.target.value)} /></label>
        <label className="field wide"><span>Corrective Action</span><textarea value={form.correctiveAction} onChange={(e) => update("correctiveAction", e.target.value)} /></label>
        {error && <p className="error wide">{error}</p>}
        <div className="form-actions wide"><button className="primary">{editingId ? "Update" : "Save"}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }}>Cancel</button>}</div>
      </form>

      <div className="panel filters">
        <Field label="Search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Incident no, employee, department, root cause" /></Field>
        <Field label="Year"><input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></Field>
        <Field label="Month"><select value={month} onChange={(e) => setMonth(e.target.value)}><option value="">Full Year</option>{months.map(([m, label]) => <option key={m} value={m}>{label}</option>)}</select></Field>
        <Field label="Department"><SelectLookup value={departmentId} onChange={setDepartmentId} items={lookups.departments} placeholder="All Departments" /></Field>
        <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All Statuses</option>{recordStatuses.map((item) => <option key={item}>{item}</option>)}</select></Field>
      </div>

      {selected && (
        <div className="panel details-box">
          <div className="section-heading"><h2>{selected.incidentNo}</h2><button onClick={() => setSelected(null)}>Close</button></div>
          <p><strong>Description:</strong> {selected.description}</p>
          <p><strong>Immediate Action:</strong> {selected.immediateAction || "-"}</p>
          <p><strong>Corrective Action:</strong> {selected.correctiveAction || "-"}</p>
        </div>
      )}

      <div className="panel table-panel">
        <div className="section-heading"><div><h2>Accident Register</h2><p>{filteredItems.length} record(s)</p></div></div>
        {!filteredItems.length ? <EmptyState text="No accident records found" detail="Adjust filters or add a new accident record." /> : <table><thead><tr><th>Incident No</th><th>Date</th><th>Department</th><th>Employee / EMP No</th><th>Accident Type</th><th>Injury Type</th><th>Root Cause</th><th>Lost Hours</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredItems.map((item) => <tr key={item.id}><td>{item.incidentNo}</td><td>{formatDate(item.incidentDate)}</td><td>{item.department?.name || "-"}</td><td>{item.employee ? `${item.employee.name}${item.employee.empNo ? ` / ${item.employee.empNo}` : ""}` : "-"}</td><td>{item.incidentType?.name || "-"}</td><td>{item.injuryType?.name || "-"}</td><td>{item.rootCause?.name || "-"}</td><td>{lostMinutesToHours(item.lostMinutes)}</td><td><StatusBadge value={item.status} /></td><td className="row-actions"><button onClick={() => setSelected(item)}>View</button><button onClick={() => edit(item)}>Edit</button><button className="danger" onClick={() => remove(item.id)}>Delete</button></td></tr>)}</tbody></table>}
      </div>
    </section>
  );
}