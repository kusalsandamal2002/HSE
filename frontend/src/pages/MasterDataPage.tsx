import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { Field } from "../components/FormTools";
import { companyProfile } from "../lib/brand";

const configs = [
  ["departments", "Departments"],
  ["employees", "Employees"],
  ["machines", "Machines"],
  ["shifts", "Shifts"],
  ["incident-types", "Accident Types"],
  ["injury-types", "Injury Types"],
  ["root-causes", "Root Causes"],
] as const;

type Key = typeof configs[number][0];

export function MasterDataPage() {
  const [tab, setTab] = useState<Key>("departments");
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ code: "", empNo: "", name: "", designation: "", category: "" });

  function load() {
    api<any[]>("/api/master/" + tab + "?includeInactive=true").then(setItems);
  }

  useEffect(load, [tab]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const payload: any = { name: form.name };
    if (tab === "departments") payload.code = form.code || form.name.toUpperCase().slice(0, 8);
    if (tab === "employees") {
      payload.empNo = form.empNo || "EMP-" + Date.now();
      payload.designation = form.designation;
    }
    if (tab === "machines") payload.code = form.code || null;
    if (tab === "shifts") {
      payload.startTime = form.startTime || null;
      payload.endTime = form.endTime || null;
    }
    if (tab === "root-causes") payload.category = form.category || null;
    await api("/api/master/" + tab, { method: "POST", body: JSON.stringify(payload) });
    setForm({ code: "", empNo: "", name: "", designation: "", category: "" });
    load();
  }

  async function remove(id: string) {
    if (confirm("Deactivate this record?")) {
      await api("/api/master/" + tab + "/" + id, { method: "DELETE" });
      load();
    }
  }

  return (
    <section className="page-stack">
      <div className="tabs panel">
        {configs.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
      </div>

      <form className="panel form-grid compact" onSubmit={submit}>
        <h2>Add {configs.find(([key]) => key === tab)?.[1]}</h2>
        {["departments", "machines"].includes(tab) && <Field label="Code"><input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>}
        {tab === "employees" && <Field label="EMP No"><input value={form.empNo || ""} onChange={(e) => setForm({ ...form, empNo: e.target.value })} /></Field>}
        <Field label="Name"><input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
        {tab === "employees" && <Field label="Designation"><input value={form.designation || ""} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>}
        {tab === "root-causes" && <Field label="Category"><input value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>}
        <div className="form-actions"><button className="primary">Add</button></div>
      </form>

      <div className="panel table-panel">
        <h2>{configs.find(([key]) => key === tab)?.[1]}</h2>
        <table>
          <thead><tr><th>Code / No</th><th>Name</th><th>Extra</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.code || item.empNo || "-"}</td>
                <td>{item.name}</td>
                <td>{item.designation || item.category || item.startTime || "-"}</td>
                <td>{item.isActive ? "Active" : "Inactive"}</td>
                <td className="row-actions"><button onClick={() => remove(item.id)}>Deactivate</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel company-card">
        <div className="section-heading">
          <div>
            <h2>Process / Product Area Reference</h2>
            <p>Read-only company context for classifying HSE discussions without changing the database schema.</p>
          </div>
        </div>
        <div className="chip-list">
          {companyProfile.productAreas.map((area) => <span className="info-chip" key={area}>{area}</span>)}
        </div>
      </div>
    </section>
  );
}
