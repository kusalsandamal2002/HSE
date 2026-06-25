import { useEffect, useState } from "react";
import { clearToken, getToken } from "./lib/api";
import { appName, companyLogoSrc, companyProfile } from "./lib/brand";
import type { User } from "./types";
import { LoginPage } from "./pages/LoginPage";
import { MasterDashboardPage } from "./pages/MasterDashboardPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CompanyProfilePage } from "./pages/CompanyProfilePage";
import { IncidentsPage } from "./pages/IncidentsPage";
import { MasterDataPage } from "./pages/MasterDataPage";
import { ActionsPage } from "./pages/ActionsPage";
import { MedicalPage } from "./pages/MedicalPage";
import { ObservationsPage } from "./pages/ObservationsPage";
import { WorkingHoursPage } from "./pages/WorkingHoursPage";
import { ReportsPage } from "./pages/ReportsPage";
import { TvControlPage } from "./pages/TvControlPage";
import { EsgDashboardPage, EsgReportsPage } from "./pages/EsgModule";
import { DataUploadCenterPage } from "./pages/DataUploadCenterPage";
import { DataEntryCenterPage } from "./pages/DataEntryCenterPage";
import { DataEntryTablePage } from "./pages/DataEntryTablePage";

const mainDashboardPages = [
  { key: "dashboard", path: "/dashboard", label: "Executive Dashboard" },
  { key: "master-dashboard", path: "/master-dashboard", label: "HSE Master Dashboard" },
  { key: "esg-dashboard", path: "/esg-dashboard", label: "ESG Master Dashboard" },
] as const;

const dataCenterPages = [
  { key: "data-entry", path: "/data-entry", label: "Data Entry Center" },
  { key: "data-upload", path: "/data-upload", label: "Data Upload Center" },
] as const;

const organizationPages = [
  { key: "company", path: "/company-profile", label: "Company Profile" },
] as const;

const reportingPages = [
  { key: "reports", path: "/reports", label: "Reports & Downloads" },
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

export function App() {
  const [routePath, setRoutePath] = useState(window.location.pathname);
  const [page, setPage] = useState<PageKey>(() => resolvePage(window.location.pathname));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("hse_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [hasToken, setHasToken] = useState(Boolean(getToken()));

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

  function renderPage() {
    switch (page) {
      case "dashboard": return <DashboardPage />;
      case "master-dashboard": return <MasterDashboardPage />;
      case "esg-dashboard": return <EsgDashboardPage onNavigate={(next) => navigate(next)} onLogout={handleLogout} user={user} />;

      case "data-entry": {
        const tableKey = getDataEntryTableKey(routePath);
        return tableKey
          ? <DataEntryTablePage tableKey={tableKey} onNavigate={(next) => navigate(next)} />
          : <DataEntryCenterPage onNavigate={(next) => navigate(next)} />;
      }
      case "data-upload": return <DataUploadCenterPage scope="all" onNavigate={(next) => navigate(next)} onLogout={handleLogout} user={user} />;

      case "company": return <CompanyProfilePage />;
      case "reports": return <ReportsPage />;
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

      default: return <DashboardPage />;
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

        {navSections.map((section) => (
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
              <button onClick={handleLogout}>Logout</button>
            </div>
          </header>
        )}
        {renderPage()}
      </main>
    </div>
  );
}
