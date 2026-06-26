type DashboardMode = "executive" | "master" | "esg";

declare global {
  interface Window {
    __hseDashboardFullscreenInstalled?: boolean;
  }
}

const dashboardRoutes: Record<string, DashboardMode> = {
  "/dashboard": "executive",
  "/master-dashboard": "master",
  "/esg-dashboard": "esg",
};

function getDashboardMode(): DashboardMode | null {
  const pathname = window.location.pathname.replace(/\/$/, "") || "/dashboard";
  return dashboardRoutes[pathname] ?? null;
}

function setPresentationMode(active: boolean, button: HTMLButtonElement) {
  document.documentElement.classList.toggle("dashboard-presentation-mode", active);
  document.body.classList.toggle("dashboard-presentation-mode", active);

  button.classList.toggle("is-active", active);
  button.textContent = active ? "EXIT" : "⛶";
  button.title = active ? "Exit presentation view" : "Open presentation view";
  button.setAttribute("aria-label", active ? "Exit presentation view" : "Open presentation view");

  if (active) {
    document.documentElement.requestFullscreen?.().catch(() => {
      // CSS presentation mode still works if browser fullscreen is blocked.
    });
  } else if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {
      // Ignore browser fullscreen exit restrictions.
    });
  }
}

function syncDashboardFullscreenButton(button: HTMLButtonElement) {
  const mode = getDashboardMode();

  if (!mode) {
    button.style.display = "none";
    delete document.body.dataset.dashboardScreen;
    document.documentElement.classList.remove("dashboard-presentation-mode");
    document.body.classList.remove("dashboard-presentation-mode");
    button.classList.remove("is-active");
    button.textContent = "⛶";
    return;
  }

  document.body.dataset.dashboardScreen = mode;
  button.style.display = "grid";
}

function installDashboardFullscreenButton() {
  if (window.__hseDashboardFullscreenInstalled) return;
  window.__hseDashboardFullscreenInstalled = true;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "dashboard-fullscreen-trigger";
  button.textContent = "⛶";
  button.title = "Open presentation view";
  button.setAttribute("aria-label", "Open presentation view");

  button.addEventListener("click", () => {
    const active = !document.body.classList.contains("dashboard-presentation-mode");
    setPresentationMode(active, button);
  });

  document.body.appendChild(button);
  syncDashboardFullscreenButton(button);

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    setTimeout(() => syncDashboardFullscreenButton(button), 0);
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    setTimeout(() => syncDashboardFullscreenButton(button), 0);
  };

  window.addEventListener("popstate", () => syncDashboardFullscreenButton(button));
  window.addEventListener("click", () => setTimeout(() => syncDashboardFullscreenButton(button), 50));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("dashboard-presentation-mode")) {
      setPresentationMode(false, button);
    }
  });

  setInterval(() => syncDashboardFullscreenButton(button), 800);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installDashboardFullscreenButton);
} else {
  installDashboardFullscreenButton();
}

export {};
