import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Lookups, Lookup } from "../types";

type FieldType = "text" | "textarea" | "number" | "date" | "select" | "boolean" | "json";

type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  readonly?: boolean;
  optionKey?: keyof Lookups;
  options?: string[];
};

type TableMeta = {
  key: string;
  title: string;
  description: string;
  category: string;
  fields: FieldDef[];
};

type RowData = Record<string, any> & {
  id?: string;
  __isNew?: boolean;
  __dirty?: boolean;
};

type Props = {
  tableKey: string;
  onNavigate: (path: string) => void;
};

const emptyLookups: Lookups = {
  departments: [],
  shifts: [],
  employees: [],
  machines: [],
  incidentTypes: [],
  injuryTypes: [],
  rootCauses: [],
};

function makeEmptyRow(meta: TableMeta): RowData {
  const row: RowData = {
    id: `temp-${Date.now()}`,
    __isNew: true,
    __dirty: true,
  };

  for (const field of meta.fields) {
    if (field.type === "number") row[field.key] = 0;
    else if (field.type === "boolean") row[field.key] = true;
    else if (field.type === "json") row[field.key] = "{}";
    else if (field.type === "select" && field.options?.length) row[field.key] = field.options[0];
    else row[field.key] = "";
  }

  return row;
}

function optionLabel(item: Lookup) {
  if (item.empNo) return `${item.name} (${item.empNo})`;
  if (item.code) return `${item.name} (${item.code})`;
  return item.name;
}

export function DataEntryTablePage({ tableKey, onNavigate }: Props) {
  const [meta, setMeta] = useState<TableMeta | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);
  const [lookups, setLookups] = useState<Lookups>(emptyLookups);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [metaResult, rowsResult, lookupResult] = await Promise.all([
        api<TableMeta>(`/api/data-entry/tables/${tableKey}`),
        api<RowData[]>(`/api/data-entry/${tableKey}`),
        api<Lookups>("/api/master/lookups"),
      ]);

      setMeta(metaResult);
      setRows(rowsResult);
      setLookups(lookupResult);
    } catch (err: any) {
      setError(err.message || "Failed to load data table");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [tableKey]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }, [rows, query]);

  function updateCell(rowId: string | undefined, key: string, value: any) {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, [key]: value, __dirty: true } : row
      )
    );
  }

  function addRow() {
    if (!meta) return;
    setRows((current) => [makeEmptyRow(meta), ...current]);
  }

  function cleanPayload(row: RowData) {
    if (!meta) return {};
    const payload: Record<string, any> = {};

    for (const field of meta.fields) {
      payload[field.key] = row[field.key];
    }

    return payload;
  }

  async function saveRow(row: RowData) {
    if (!meta || !row.id) return;
    setSavingId(row.id);
    setError("");

    try {
      const payload = cleanPayload(row);
      const saved = row.__isNew
        ? await api<RowData>(`/api/data-entry/${tableKey}`, {
            method: "POST",
            body: JSON.stringify(payload),
          })
        : await api<RowData>(`/api/data-entry/${tableKey}/${row.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });

      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...saved, __dirty: false, __isNew: false } : item
        )
      );
    } catch (err: any) {
      setError(err.message || "Failed to save row");
    } finally {
      setSavingId("");
    }
  }

  async function deleteRow(row: RowData) {
    if (!row.id) return;

    if (row.__isNew) {
      setRows((current) => current.filter((item) => item.id !== row.id));
      return;
    }

    const ok = window.confirm("Delete this row? This will update the database.");
    if (!ok) return;

    setSavingId(row.id);
    setError("");

    try {
      await api(`/api/data-entry/${tableKey}/${row.id}`, { method: "DELETE" });
      setRows((current) => current.filter((item) => item.id !== row.id));
    } catch (err: any) {
      setError(err.message || "Failed to delete row");
    } finally {
      setSavingId("");
    }
  }

  function renderInput(row: RowData, field: FieldDef) {
    const value = row[field.key] ?? "";

    if (field.type === "textarea" || field.type === "json") {
      return (
        <textarea
          value={value}
          onChange={(event) => updateCell(row.id, field.key, event.target.value)}
          rows={field.type === "json" ? 6 : 2}
        />
      );
    }

    if (field.type === "select") {
      const lookupItems = field.optionKey ? lookups[field.optionKey] || [] : [];

      return (
        <select
          value={value ?? ""}
          onChange={(event) => updateCell(row.id, field.key, event.target.value)}
        >
          <option value="">-- Select --</option>

          {field.options?.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}

          {lookupItems.map((item) => (
            <option key={item.id} value={item.id}>{optionLabel(item)}</option>
          ))}
        </select>
      );
    }

    if (field.type === "boolean") {
      return (
        <select
          value={String(Boolean(value))}
          onChange={(event) => updateCell(row.id, field.key, event.target.value === "true")}
        >
          <option value="true">Active / Yes</option>
          <option value="false">Inactive / No</option>
        </select>
      );
    }

    return (
      <input
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        value={value}
        onChange={(event) => updateCell(row.id, field.key, event.target.value)}
      />
    );
  }

  if (loading) {
    return <div className="data-entry-page"><div className="data-entry-loading">Loading data entry table...</div></div>;
  }

  if (!meta) {
    return (
      <div className="data-entry-page">
        <button className="ghost-btn" onClick={() => onNavigate("/data-entry")}>Back</button>
        <div className="data-entry-error">{error || "Table not found"}</div>
      </div>
    );
  }

  return (
    <div className="data-entry-page">
      <section className="data-entry-table-header">
        <div>
          <button className="ghost-btn" onClick={() => onNavigate("/data-entry")}>← Back to Data Entry Center</button>
          <p className="eyebrow">{meta.category} DATA ENTRY</p>
          <h2>{meta.title}</h2>
          <p>{meta.description}</p>
        </div>

        <div className="data-entry-actions">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search in table..."
          />
          <button onClick={addRow}>+ Add Row</button>
          <button onClick={() => void loadData()}>Refresh</button>
        </div>
      </section>

      {error && <div className="data-entry-error">{error}</div>}

      <div className="data-entry-grid-wrap">
        <table className="data-entry-grid">
          <thead>
            <tr>
              <th className="sticky-action">Actions</th>
              {meta.fields.map((field) => (
                <th key={field.key}>
                  {field.label}
                  {field.required && <span className="required-star">*</span>}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className={row.__dirty ? "dirty-row" : ""}>
                <td className="sticky-action action-cell">
                  <button
                    disabled={!row.__dirty || savingId === row.id}
                    onClick={() => void saveRow(row)}
                  >
                    {savingId === row.id ? "Saving..." : "Save"}
                  </button>
                  <button
                    className="danger-btn"
                    disabled={savingId === row.id}
                    onClick={() => void deleteRow(row)}
                  >
                    Delete
                  </button>
                </td>

                {meta.fields.map((field) => (
                  <td key={field.key}>{renderInput(row, field)}</td>
                ))}
              </tr>
            ))}

            {!filteredRows.length && (
              <tr>
                <td colSpan={meta.fields.length + 1} className="empty-cell">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="data-entry-help">
        Tip: Edit cells like Excel, then click Save on that row. Delete uses safe soft-delete where supported.
      </p>
    </div>
  );
}

