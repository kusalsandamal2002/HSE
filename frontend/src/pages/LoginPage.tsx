import { useState } from "react";
import { api, setToken } from "../lib/api";
import { appName, companyLogoSrc } from "../lib/brand";
import type { User } from "../types";

export function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("admin@hse.local");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api<{ token: string; user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }), skipAuth: true });
      setToken(res.token);
      localStorage.setItem("hse_user", JSON.stringify(res.user));
      onLogin(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="brand login-brand">
          <span className="logo-mark login-logo">
            <img src={companyLogoSrc} alt="LAUGFS Rubber" />
          </span>
          <div>
            <strong>{appName}</strong>
            <small>Safety Operations</small>
          </div>
        </div>
        <h1>Sign in</h1>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input value={password} type="password" onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={loading}>{loading ? "Signing in..." : "Login"}</button>
        <small className="hint">Default development login is pre-filled after seed.</small>
      </form>
    </div>
  );
}
