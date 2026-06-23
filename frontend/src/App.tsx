import { useEffect, useState } from "react";
import { clearToken, getToken } from "./lib/api";
import { appName, companyLogoSrc } from "./lib/brand";
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

const pages = [
  ["master-dashboard", "Master Dashboard"],
  ["dashboard", "Dashboard"],
  ["company", "Company Profile"],
  ["incidents", "Accident Register"],
  ["actions", "Corrective Actions"],
  ["medical", "Medical Expenses"],
  ["observations", "Near Miss / Unsafe"],
  ["hours", "Working Hours"],
  ["master", "Master Data"],
  ["reports", "Reports"],
  ["tv", "TV Dashboard"],
] as const;

type PageKey = typeof pages[number][0];

export function App() {
  const [page, setPage] = useState<PageKey>("master-dashboard");
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("hse_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [hasToken, setHasToken] = useState(Boolean(getToken()));

  useEffect(() => setHasToken(Boolean(getToken())), [user]);

  if (!hasToken || !user) {
    return <LoginPage onLogin={(u) => { setUser(u); setHasToken(true); }} />;
  }

  function renderPage() {
    switch (page) {
      case "master-dashboard": return <MasterDashboardPage />;
      case "dashboard": return <DashboardPage />;
      case "company": return <CompanyProfilePage />;
      case "incidents": return <IncidentsPage />;
      case "actions": return <ActionsPage />;
      case "medical": return <MedicalPage />;
      case "observations": return <ObservationsPage />;
      case "hours": return <WorkingHoursPage />;
      case "master": return <MasterDataPage />;
      case "reports": return <ReportsPage />;
      case "tv": return <TvControlPage />;
    }
  }

  return (
    <div className={page === "master-dashboard" ? "app-shell master-shell" : "app-shell"}>
      <aside className="sidebar">
        <div className="brand sidebar-brand">
          <span className="logo-mark sidebar-logo">
            <img src={companyLogoSrc} alt="LAUGFS Rubber" />
          </span>
          <div>
            <strong>{appName}</strong>
            <small>Safety Operations</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {pages.map(([key, label]) => (
            <button key={key} className={page === key ? "active" : ""} onClick={() => setPage(key)}>{label}</button>
          ))}
        </nav>
      </aside>
      <main className={page === "master-dashboard" ? "main master-main" : "main"}>
        {page !== "master-dashboard" && <header className="topbar">
          <div className="topbar-title">
            <span className="logo-mark topbar-logo">
              <img src={companyLogoSrc} alt="LAUGFS Rubber" />
            </span>
            <div>
              <p>{appName}</p>
              <h1>{pages.find(([key]) => key === page)?.[1]}</h1>
            </div>
          </div>
          <div className="userbox">
            <div>
              <span>{user.name}</span>
              <small>{user.role.replace(/_/g, " ")}</small>
            </div>
            <button onClick={() => { clearToken(); localStorage.removeItem("hse_user"); setUser(null); }}>Logout</button>
          </div>
        </header>}
        {renderPage()}
      </main>
    </div>
  );
}