const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const TV_DASHBOARD_URL = `${API_URL}/tv`;

export type ApiOptions = RequestInit & { skipAuth?: boolean };

export function getToken() {
  return localStorage.getItem("hse_token");
}

export function setToken(token: string) {
  localStorage.setItem("hse_token", token);
}

export function clearToken() {
  localStorage.removeItem("hse_token");
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (!options.skipAuth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const err = await res.json();
      const issueText = Array.isArray(err.issues)
        ? err.issues.map((issue: any) => `${issue.path?.join(".") || "field"}: ${issue.message}`).join("; ")
        : "";
      message = issueText ? `${err.message || message}: ${issueText}` : err.message || message;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

export function openExternalUrl(url: string) {
  if (window.hseDesktop?.openExternal) {
    void window.hseDesktop.openExternal(url).catch(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

export function openTvUrl() {
  openExternalUrl(TV_DASHBOARD_URL);
}