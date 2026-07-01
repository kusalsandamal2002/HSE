import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type UserRole =
  | "ADMIN"
  | "HSE_MANAGER"
  | "HSE_OFFICER"
  | "DEPARTMENT_HEAD"
  | "MANAGEMENT_VIEWER"
  | "TV_DISPLAY";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const roleOptions: Array<{ value: UserRole; label: string; note: string }> = [
  { value: "ADMIN", label: "ADMIN", note: "Full system control" },
  { value: "HSE_MANAGER", label: "HSE MANAGER", note: "Dashboards, data, imports, reports" },
  { value: "HSE_OFFICER", label: "HSE OFFICER", note: "Operational data entry" },
  { value: "DEPARTMENT_HEAD", label: "DEPARTMENT HEAD", note: "Dashboard and report view" },
  { value: "MANAGEMENT_VIEWER", label: "MANAGEMENT VIEWER", note: "Read-only management view" },
  { value: "TV_DISPLAY", label: "TV DISPLAY", note: "TV dashboard only" },
];

const emptyForm = {
  name: "",
  email: "",
  role: "HSE_OFFICER" as UserRole,
  password: "",
  isActive: true,
};

function roleLabel(role: string) {
  return role.replace(/_/g, " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

export function UserManagementPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter) params.set("role", roleFilter);
    if (activeFilter) params.set("isActive", activeFilter);
    return params.toString();
  }, [search, roleFilter, activeFilter]);

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const result = await api<{ users: ManagedUser[] }>(`/api/users${query ? `?${query}` : ""}`);
      setUsers(result.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, [query]);

  function startEdit(user: ManagedUser) {
    setEditingUserId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      password: "",
      isActive: user.isActive,
    });
    setMessage("");
    setError("");
  }

  function cancelEdit() {
    setEditingUserId(null);
    setForm(emptyForm);
    setMessage("");
    setError("");
  }

  async function submitUser(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (editingUserId) {
        await api(`/api/users/${editingUserId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            role: form.role,
            isActive: form.isActive,
          }),
        });
        setMessage("User updated successfully.");
      } else {
        await api("/api/users", {
          method: "POST",
          body: JSON.stringify(form),
        });
        setMessage("User created successfully.");
      }

      cancelEdit();
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: ManagedUser) {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await api(`/api/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      setMessage(user.isActive ? "User deactivated." : "User activated.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user status");
    } finally {
      setSaving(false);
    }
  }

  async function submitResetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!resetUser) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await api(`/api/users/${resetUser.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: resetPassword }),
      });

      setMessage(`Password reset for ${resetUser.name}.`);
      setResetUser(null);
      setResetPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="data-entry-page">
      <section className="data-entry-hero">
        <div>
          <p className="eyebrow">ADMIN CENTER</p>
          <h2>User Management</h2>
          <p>Create users, assign roles, deactivate accounts, and reset passwords for the HSE system.</p>
        </div>
        <div className="data-entry-search">
          <label>Search</label>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email..." />
          <label>Role</label>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All roles</option>
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
          <label>Status</label>
          <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </section>

      {error ? <div className="data-entry-error">{error}</div> : null}
      {message ? <div className="data-entry-success">{message}</div> : null}

      <section className="data-entry-section">
        <h3>{editingUserId ? "Edit User" : "Create User"}</h3>
        <form className="data-entry-form" onSubmit={submitUser}>
          <label>
            Name
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
          </label>

          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required />
          </label>

          <label>
            Role
            <select value={form.role} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as UserRole }))}>
              {roleOptions.map((role) => (
                <option key={role.value} value={role.value}>{role.label} - {role.note}</option>
              ))}
            </select>
          </label>

          {!editingUserId ? (
            <label>
              Initial Password
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Minimum 8 chars, upper/lower/number/symbol"
                required
              />
            </label>
          ) : null}

          <label className="data-entry-checkbox">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
            Active account
          </label>

          <div className="data-entry-actions">
            <button type="submit" disabled={saving}>{saving ? "Saving..." : editingUserId ? "Update User" : "Create User"}</button>
            {editingUserId ? <button type="button" onClick={cancelEdit}>Cancel</button> : null}
          </div>
        </form>
      </section>

      {resetUser ? (
        <section className="data-entry-section">
          <h3>Reset Password: {resetUser.name}</h3>
          <form className="data-entry-form" onSubmit={submitResetPassword}>
            <label>
              New Password
              <input
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                placeholder="Minimum 8 chars, upper/lower/number/symbol"
                required
              />
            </label>
            <div className="data-entry-actions">
              <button type="submit" disabled={saving}>Reset Password</button>
              <button type="button" onClick={() => { setResetUser(null); setResetPassword(""); }}>Cancel</button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="data-entry-section">
        <h3>System Users</h3>
        {loading ? <p>Loading users...</p> : null}

        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Admin Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{roleLabel(user.role)}</td>
                <td>
                  <span className={`status-badge ${user.isActive ? "status-approved" : "status-failed"}`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>{formatDate(user.createdAt)}</td>
                <td>{formatDate(user.updatedAt)}</td>
                <td>
                  <div className="data-entry-actions compact">
                    <button type="button" onClick={() => startEdit(user)}>Edit</button>
                    <button type="button" onClick={() => setResetUser(user)}>Reset Password</button>
                    <button type="button" onClick={() => void toggleActive(user)}>
                      {user.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
