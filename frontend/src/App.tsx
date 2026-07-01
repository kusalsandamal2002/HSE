import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import { api, clearToken, getToken } from "./lib/api";
import { appName, companyLogoSrc, companyProfile } from "./lib/brand";
import type { User } from "./types";

const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const MasterDashboardPage = lazy(() => import("./pages/MasterDashboardPage").then((m) => ({ default: m.MasterDashboardPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const CompanyProfilePage = lazy(() => import("./pages/CompanyProfilePage").then((m) => ({ default: m.CompanyProfilePage })));
const IncidentsPage = lazy(() => import("./pages/IncidentsPage").then((m) => ({ default: m.IncidentsPage })));
const MasterDataPage = lazy(() => import("./pages/MasterDataPage").then((m) => ({ default: m.MasterDataPage })));
const ActionsPage = lazy(() => import("./pages/ActionsPage").then((m) => ({ default: m.ActionsPage })));
const MedicalPage = lazy(() => import("./pages/MedicalPage").then((m) => ({ default: m.MedicalPage })));
const ObservationsPage = lazy(() => import("./pages/ObservationsPage").then((m) => ({ default: m.ObservationsPage })));
const WorkingHoursPage = lazy(() => import("./pages/WorkingHoursPage").then((m) => ({ default: m.WorkingHoursPage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const TvControlPage = lazy(() => import("./pages/TvControlPage").then((m) => ({ default: m.TvControlPage })));
const EsgDashboardPage = lazy(() => import("./pages/EsgModule").then((m) => ({ default: m.EsgDashboardPage })));
const EsgReportsPage = lazy(() => import("./pages/EsgModule").then((m) => ({ default: m.EsgReportsPage })));
const DataUploadCenterPage = lazy(() => import("./pages/DataUploadCenterPage").then((m) => ({ default: m.DataUploadCenterPage })));
const DataEntryCenterPage = lazy(() => import("./pages/DataEntryCenterPage").then((m) => ({ default: m.DataEntryCenterPage })));
const DataEntryTablePage = lazy(() => import("./pages/DataEntryTablePage").then((m) => ({ default: m.DataEntryTablePage })));
const DataQualityCenterPage = lazy(() => import("./pages/DataQualityCenterPage").then((m) => ({ default: m.DataQualityCenterPage })));
const AuditTrailPage = lazy(() => import("./pages/AuditTrailPage").then((m) => ({ default: m.AuditTrailPage }))); 

function PageLoading({ label = "Loading module..." }: { label?: string }) {
  return (
    <div className="route-loading">
      <span className="route-loading-spinner" />
      <strong>{label}</strong>
    </div>
  );
}

const mainDashboardPages = [
  { key: "dashboard", path: "/dashboard", label: "Executive Dashboard" },
  { key: "master-dashboard", path: "/master-dashboard", label: "HSE Master Dashboard" },
  { key: "esg-dashboard", path: "/esg-dashboard", label: "ESG Master Dashboard" },
] as const;

const dataCenterPages = [
  { key: "data-entry", path: "/data-entry", label: "Data Entry Center" },
  { key: "data-upload", path: "/data-upload", label: "Data Upload Center" },
  { key: "data-quality", path: "/data-quality", label: "Data Quality Center" },
] as const;

const organizationPages = [
  { key: "company", path: "/company-profile", label: "Company Profile" },
] as const;

const reportingPages = [
  { key: "reports", path: "/reports", label: "Reports & Downloads" },
  { key: "audit-logs", path: "/audit-logs", label: "Audit Trail" },
] as const;

const displayPages = [
  { key: "tv", path: "/tv-dashboard", label: "TV Dashboard" },
] as const;

/*
  Hidden legacy routes:
  These pages are kept working but removed from the main sidebar because data entry
  will now be centralized through Common > Data Entry Center.
*/
const hiddenLegacyPages = [
  { key: "incidents", path: "/incidents", label: "Accident Register" },
  { key: "actions", path: "/corrective-actions", label: "Corrective Actions" },
  { key: "medical", path: "/medical-expenses", label: "Medical Expenses" },
  { key: "observations", path: "/observations", label: "Near Miss / Unsafe" },
  { key: "hours", path: "/working-hours", label: "Working Hours" },
  { key: "master", path: "/master-data", label: "Master Data" },
  { key: "esg-upload", path: "/esg-upload", label: "ESG Data Upload" },
  { key: "esg-reports", path: "/esg-reports", label: "ESG Reports" },
] as const;

const navSections = [
  { title: "Main Dashboards", pages: mainDashboardPages },
  { title: "Data Center", pages: dataCenterPages },
  { title: "Organization", pages: organizationPages },
  { title: "Reporting", pages: reportingPages },
  { title: "Display", pages: displayPages },
] as const;

const allPages = [
  ...mainDashboardPages,
  ...dataCenterPages,
  ...organizationPages,
  ...reportingPages,
  ...displayPages,
  ...hiddenLegacyPages,
] as const;

type PageKey = typeof allPages[number]["key"];

const pageByPath = new Map<string, PageKey>();
for (const item of allPages) {
  pageByPath.set(item.path.replace(/^\/+/, ""), item.key);
  pageByPath.set(item.key, item.key);
}

function resolvePage(pathname: string): PageKey {
  const slug = pathname.replace(/^\/+/, "");
  if (slug === "data-entry" || slug.startsWith("data-entry/")) return "data-entry";
  return pageByPath.get(slug) ?? "dashboard";
}

function getPageLabel(page: PageKey) {
  return allPages.find((item) => item.key === page)?.label ?? "Executive Dashboard";
}

function getPageGroup(page: PageKey) {
  if (mainDashboardPages.some((item) => item.key === page)) return "Dashboards";
  if (dataCenterPages.some((item) => item.key === page)) return "Data Center";
  if (organizationPages.some((item) => item.key === page)) return "Organization";
  if (reportingPages.some((item) => item.key === page)) return "Reporting";
  if (displayPages.some((item) => item.key === page)) return "Display";
  if (String(page).startsWith("esg-")) return "ESG";
  return "HSE";
}

function getDataEntryTableKey(routePath: string) {
  const parts = routePath.replace(/^\/+/, "").split("/");
  return parts[0] === "data-entry" ? parts[1] || "" : "";
}

type AccessRole =
  | "ADMIN"
  | "HSE_MANAGER"
  | "HSE_OFFICER"
  | "DEPARTMENT_HEAD"
  | "MANAGEMENT_VIEWER"
  | "TV_DISPLAY"
  | string;

function roleIn(role: AccessRole | undefined, allowed: readonly string[]) {
  return Boolean(role && allowed.includes(role));
}

function defaultPathForRole(role: AccessRole | undefined) {
  if (role === "TV_DISPLAY") return "/tv-dashboard";
  return "/dashboard";
}

function canAccessPage(role: AccessRole | undefined, page: PageKey) {
  const fullAccess = ["ADMIN", "HSE_MANAGER"];
  const dashboardViewers = ["ADMIN", "HSE_MANAGER", "HSE_OFFICER", "DEPARTMENT_HEAD", "MANAGEMENT_VIEWER"];
  const operationalUsers = ["ADMIN", "HSE_MANAGER", "HSE_OFFICER"];

  if (page === "audit-logs") return roleIn(role, ["ADMIN"]);

  if (roleIn(role, fullAccess)) return true;

  switch (page) {
    case "dashboard":
    case "master-dashboard":
    case "esg-dashboard":
    case "company":
    case "reports":
      return roleIn(role, dashboardViewers);

    case "data-upload":
    case "esg-upload":
      return roleIn(role, operationalUsers);

    case "data-quality":
      return roleIn(role, dashboardViewers);

    case "tv":
      return roleIn(role, ["ADMIN", "HSE_MANAGER", "TV_DISPLAY"]);

    case "incidents":
    case "actions":
    case "medical":
    case "observations":
    case "hours":
      return roleIn(role, operationalUsers);

    case "data-entry":
    case "master":
      return roleIn(role, fullAccess);

    case "esg-reports":
      return roleIn(role, dashboardViewers);

    default:
      return false;
  }
}

function AccessDeniedPage({
  role,
  pageLabel,
  onNavigate,
}: {
  role: string;
  pageLabel: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <section className="panel access-denied-panel">
      <span className="rd-kicker">Access Control</span>
      <h2>Permission required</h2>
      <p>
        Your current role <strong>{role.replace(/_/g, " ")}</strong> does not have access to <strong>{pageLabel}</strong>.
      </p>
      <button type="button" className="primary" onClick={() => onNavigate(defaultPathForRole(role))}>
        Go to allowed workspace
      </button>
    </section>
  );
}


function ChangePasswordModal({
  onClose,
  onPasswordChanged,
}: {
  onClose: () => void;
  onPasswordChanged: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    const strongEnough =
      newPassword.length >= 10 &&
      /[A-Z]/.test(newPassword) &&
      /[a-z]/.test(newPassword) &&
      /[0-9]/.test(newPassword) &&
      /[^A-Za-z0-9]/.test(newPassword);

    if (!strongEnough) {
      setError("Password must be at least 10 characters and include uppercase, lowercase, number, and symbol.");
      return;
    }

    try {
      setSaving(true);
      const result = await api<{ message: string }>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(`${result.message}. Please login again.`);
      window.setTimeout(onPasswordChanged, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="password-modal-backdrop">
      <section className="password-modal" role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
        <div className="password-modal-header">
          <div>
            <p>Account Security</p>
            <h2 id="password-modal-title">Change Password</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close password change dialog">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="password-modal-form">
          <label>
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <label>
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <small className="password-help">
            Minimum 10 characters with uppercase, lowercase, number, and symbol.
          </small>

          {error && <div className="password-alert password-alert-error">{error}</div>}
          {message && <div className="password-alert password-alert-success">{message}</div>}

          <div className="password-modal-actions">
            <button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Change Password"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function App() {
  const [routePath, setRoutePath] = useState(window.location.pathname);
  const [page, setPage] = useState<PageKey>(() => resolvePage(window.location.pathname));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("hse_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [hasToken, setHasToken] = useState(Boolean(getToken()));
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    const onPopState = () => {
      setRoutePath(window.location.pathname);
      setPage(resolvePage(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => setHasToken(Boolean(getToken())), [user]);

  function navigate(nextPath: string) {
    const cleanPath = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
    window.history.pushState({}, "", cleanPath);
    setRoutePath(cleanPath);
    setPage(resolvePage(cleanPath));
  }

  function handleLogout() {
    clearToken();
    localStorage.removeItem("hse_user");
    setUser(null);
    setHasToken(false);
  }

  const isHseMasterDashboard = page === "master-dashboard";
  const isCompanyProfile = page === "company";
  const isCommonUpload = page === "data-upload";
  const isEsgPage = String(page).startsWith("esg-");
  const isShelllessPage = isCommonUpload || isEsgPage;

  if (!hasToken || !user) {
    return <LoginPage onLogin={(u) => { setUser(u); setHasToken(true); }} />;
  }

  const visibleNavSections = navSections
    .map((section) => ({
      ...section,
      pages: section.pages.filter((item) => canAccessPage(user.role, item.key)),
    }))
    .filter((section) => section.pages.length > 0);
  function renderPage() {
    switch (page) {
      case "dashboard": return <DashboardPage onNavigate={(next) => navigate(next)} />;
      case "master-dashboard": return <MasterDashboardPage />;
      case "esg-dashboard": return <EsgDashboardPage onNavigate={(next) => navigate(next)} onLogout={handleLogout} user={user} />;

      case "data-entry": {
        const tableKey = getDataEntryTableKey(routePath);
        return tableKey
          ? <DataEntryTablePage tableKey={tableKey} onNavigate={(next) => navigate(next)} />
          : <DataEntryCenterPage onNavigate={(next) => navigate(next)} />;
      }
      case "data-quality": return <DataQualityCenterPage />;
      case "data-upload": return <DataUploadCenterPage scope="all" onNavigate={(next) => navigate(next)} onLogout={handleLogout} user={user} />;

      case "company": return <CompanyProfilePage />;
      case "reports": return <ReportsPage user={user} />;
      case "audit-logs": return <AuditTrailPage />;
      case "tv": return <TvControlPage />;

      /* Hidden legacy routes still work if opened directly */
      case "incidents": return <IncidentsPage />;
      case "actions": return <ActionsPage />;
      case "medical": return <MedicalPage />;
      case "observations": return <ObservationsPage />;
      case "hours": return <WorkingHoursPage />;
      case "master": return <MasterDataPage />;
      case "esg-upload": return <DataUploadCenterPage scope="esg" onNavigate={(next) => navigate(next)} onLogout={handleLogout} user={user} />;
      case "esg-reports": return <EsgReportsPage onNavigate={(next) => navigate(next)} onLogout={handleLogout} user={user} />;

      default: return <DashboardPage onNavigate={(next) => navigate(next)} />;
    }
  }

  return (
    <div className={isHseMasterDashboard ? "app-shell master-shell" : "app-shell"}>
      <aside className="sidebar">
        <div className="brand sidebar-brand">
          <span className="logo-mark sidebar-logo">
            <img src={companyLogoSrc} alt="LAUGFS Rubber" />
          </span>
          <div>
            <strong>{appName}</strong>
            <small>Live, Learn, Protect.</small>
          </div>
        </div>

        {visibleNavSections.map((section) => (
          <section key={section.title} className="sidebar-section">
            <span className="sidebar-section-title">{section.title}</span>
            <nav aria-label={`${section.title} navigation`}>
              {section.pages.map((item) => (
                <button
                  key={item.key}
                  className={page === item.key ? "active" : ""}
                  onClick={() => navigate(item.path)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </section>
        ))}

        <footer className="sidebar-foot">
          <span>Factory</span>
          <strong>{companyProfile.factory}</strong>
        </footer>
      </aside>

      <main className={
        isHseMasterDashboard
          ? "main master-main"
          : isCompanyProfile
            ? "main company-profile-main"
            : isCommonUpload
              ? "main upload-center-main"
              : "main"
      }>
        {!isHseMasterDashboard && !isShelllessPage && (
          <header className="topbar">
            <div className="topbar-title">
              <span className="logo-mark topbar-logo">
                <img src={companyLogoSrc} alt="LAUGFS Rubber" />
              </span>
              <div>
                <p>{getPageGroup(page)}</p>
                <h1>{getPageLabel(page)}</h1>
                <small>{isCompanyProfile ? "Shared company profile" : appName}</small>
              </div>
            </div>
            <div className="userbox">
              <div>
                <span>{user.name}</span>
                <small>{user.role.replace(/_/g, " ")}</small>
              </div>
              <button type="button" onClick={() => setShowPasswordModal(true)}>Change Password</button>
              <button type="button" onClick={handleLogout}>Logout</button>
            </div>
          </header>
        )}
        <Suspense fallback={<PageLoading />}>{canAccessPage(user.role, page) ? renderPage() : <AccessDeniedPage role={user.role} pageLabel={getPageLabel(page)} onNavigate={navigate} />}</Suspense>
        {showPasswordModal && (
          <ChangePasswordModal
            onClose={() => setShowPasswordModal(false)}
            onPasswordChanged={handleLogout}
          />
        )}
      </main>
    </div>
  );
}








