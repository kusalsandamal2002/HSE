import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type DataEntryTable = {
  key: string;
  title: string;
  description: string;
  category: "HSE" | "Common" | "Master";
  fields: Array<{ key: string; label: string; type: string }>;
  deleteMode: string;
};

type Props = {
  onNavigate: (path: string) => void;
};

export function DataEntryCenterPage({ onNavigate }: Props) {
  const [tables, setTables] = useState<DataEntryTable[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<DataEntryTable[]>("/api/data-entry/tables")
      .then(setTables)
      .catch((err) => setError(err.message || "Failed to load data entry tables"));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter((table) =>
      `${table.title} ${table.description} ${table.category}`.toLowerCase().includes(q)
    );
  }, [tables, query]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, DataEntryTable[]>>((acc, table) => {
      acc[table.category] = acc[table.category] || [];
      acc[table.category].push(table);
      return acc;
    }, {});
  }, [filtered]);

  return (
    <div className="data-entry-page">
      <section className="data-entry-hero">
        <div>
          <p className="eyebrow">COMMON MODULE</p>
          <h2>Data Entry Center</h2>
          <p>
            Select a data topic below. Each card opens an Excel-like table where you can add,
            edit, delete, and save records directly to the PostgreSQL database.
          </p>
        </div>
        <div className="data-entry-search">
          <label>Search data topic</label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search accident, employee, department..."
          />
        </div>
      </section>

      {error && <div className="data-entry-error">{error}</div>}

      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} className="data-entry-section">
          <h3>{category}</h3>
          <div className="data-entry-card-grid">
            {items.map((table) => (
              <button
                key={table.key}
                className="data-entry-card"
                onClick={() => onNavigate(`/data-entry/${table.key}`)}
              >
                <span>{table.category}</span>
                <strong>{table.title}</strong>
                <p>{table.description}</p>
                <small>{table.fields.length} editable fields</small>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
