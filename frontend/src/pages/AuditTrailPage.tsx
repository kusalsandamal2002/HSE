import { useEffect, useState } from "react";
import { api } from "../lib/api";

type AuditUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AuditLogItem = {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
  user: AuditUser | null;
};

type AuditLogResponse = {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatPayload(value: unknown) {
  if (value === null || value === undefined) return "—";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Unable to display payload";
  }
}

function actorName(item: AuditLogItem) {
  if (item.user?.name) return item.user.name;
  if (item.user?.email) return item.user.email;
  return "System / Unknown";
}

export function AuditTrailPage() {
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [entityId, setEntityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<AuditLogResponse>({
    items: [],
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(nextPage = 1) {
    const params = new URLSearchParams({
      page: String(nextPage),
      limit: "25",
    });

    if (action.trim()) params.set("action", action.trim());
    if (entity.trim()) params.set("entity", entity.trim());
    if (entityId.trim()) params.set("entityId", entityId.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    setLoading(true);
    setError("");

    try {
      const result = await api<AuditLogResponse>(`/api/audit-logs?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
  }, []);

  return (
    <section className="audit-page">
      <header className="panel audit-hero">
        <div>
          <span className="rd-kicker">Admin Control</span>
          <h2>Audit Trail</h2>
          <p>Review create, update, delete, upload and approval activity across the HSE system.</p>
        </div>
        <div className="audit-hero-meta">
          <strong>{data.total}</strong>
          <span>matching records</span>
        </div>
      </header>

      <form
        className="panel audit-filters"
        onSubmit={(event) => {
          event.preventDefault();
          void load(1);
        }}
      >
        <label>
          Action
          <input value={action} onChange={(event) => setAction(event.target.value)} placeholder="CREATE_INCIDENT" />
        </label>

        <label>
          Entity
          <input value={entity} onChange={(event) => setEntity(event.target.value)} placeholder="Incident" />
        </label>

        <label>
          Entity ID
          <input value={entityId} onChange={(event) => setEntityId(event.target.value)} placeholder="Record UUID" />
        </label>

        <label>
          From
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>

        <label>
          To
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>

        <div className="audit-filter-actions">
          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Loading..." : "Search"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setAction("");
              setEntity("");
              setEntityId("");
              setFrom("");
              setTo("");
              void load(1);
            }}
          >
            Reset
          </button>
        </div>
      </form>

      {error && <div className="panel error-state"><strong>Audit log error</strong><span>{error}</span></div>}

      <section className="panel audit-table-card">
        <div className="chart-title">
          <h2>Activity Log</h2>
          <span>Page {data.page} of {Math.max(data.totalPages, 1)}</span>
        </div>

        {data.items.length === 0 ? (
          <div className="empty-state">
            <strong>No audit records found</strong>
            <span>Try changing the filter criteria.</span>
          </div>
        ) : (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Entity ID</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td>
                      <strong>{actorName(item)}</strong>
                      <small>{item.user?.role?.replace(/_/g, " ") || "Unknown role"}</small>
                    </td>
                    <td><span className="audit-badge">{item.action}</span></td>
                    <td>{item.entity}</td>
                    <td><code>{item.entityId || "—"}</code></td>
                    <td>
                      <details className="audit-details">
                        <summary>View before / after</summary>
                        <div className="audit-json-grid">
                          <article>
                            <strong>Before</strong>
                            <pre>{formatPayload(item.before)}</pre>
                          </article>
                          <article>
                            <strong>After</strong>
                            <pre>{formatPayload(item.after)}</pre>
                          </article>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="audit-pagination">
          <button disabled={loading || data.page <= 1} onClick={() => void load(data.page - 1)}>
            Previous
          </button>
          <span>{data.total} total records</span>
          <button disabled={loading || data.page >= data.totalPages} onClick={() => void load(data.page + 1)}>
            Next
          </button>
        </div>
      </section>
    </section>
  );
}
