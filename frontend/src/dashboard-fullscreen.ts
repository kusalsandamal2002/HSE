declare global {
  interface Window {
    __hseDashboardFullscreenInstalled?: boolean;
  }
}

type DashboardKind = "executive" | "hse-master" | "esg-master";

const STORAGE_KEY = "hse-dashboard-presentation-mode";
const ACTIVE_CLASS = "hse-dashboard-fullscreen-active";
const BUTTON_CLASS = "dashboard-fullscreen-trigger";

function getBodyText() {
  return document.body?.innerText?.toLowerCase() ?? "";
}

function getPath() {
  return window.location.pathname.toLowerCase();
}

function getDashboardKind(): DashboardKind | null {
  const path = getPath();
  const text = getBodyText();

  if (path.includes("esg") || text.includes("esg master dashboard")) {
    return "esg-master";
  }

  if (path.includes("master") || text.includes("hse master dashboard")) {
    return "hse-master";
  }

  if (path.includes("dashboard") || text.includes("executive dashboard")) {
    return "executive";
  }

  return null;
}

function isPresentationActive() {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

function setPresentationActive(active: boolean) {
  document.documentElement.classList.toggle(ACTIVE_CLASS, active);
  document.body.classList.toggle(ACTIVE_CLASS, active);
  localStorage.setItem(STORAGE_KEY, active ? "1" : "0");
}

function iconSvg(active: boolean) {
  if (active) {
    return `
      <svg class="dashboard-fullscreen-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7l10 10M17 7L7 17" />
      </svg>
      <span class="dashboard-fullscreen-label">Exit presentation</span>
    `;
  }

  return `
    <svg class="dashboard-fullscreen-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
      <path d="M3 3l6 6M21 3l-6 6M21 21l-6-6M3 21l6-6" />
    </svg>
    <span class="dashboard-fullscreen-label">Presentation</span>
  `;
}

function ensureButton() {
  let button = document.querySelector<HTMLButtonElement>(`.${BUTTON_CLASS}`);

  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.title = "Toggle presentation fullscreen";
    button.setAttribute("aria-label", "Toggle presentation fullscreen");
    button.addEventListener("click", () => {
      void togglePresentation();
    });
  }

  return button;
}

function ensureSidebarHost() {
  const sidebar = document.querySelector<HTMLElement>(".sidebar");
  if (!sidebar) return null;

  let host = sidebar.querySelector<HTMLElement>(".dashboard-presentation-sidebar-host");

  if (!host) {
    host = document.createElement("div");
    host.className = "dashboard-presentation-sidebar-host";
    host.innerHTML = `
      <div class="dashboard-presentation-sidebar-title">PRESENTATION</div>
    `;
    sidebar.appendChild(host);
  }

  return host;
}

function getExecutiveActionHost() {
  return document.querySelector<HTMLElement>(".topbar .userbox, .userbox, .topbar-actions, .user-actions");
}

async function togglePresentation() {
  const next = !isPresentationActive();
  setPresentationActive(next);

  try {
    if (next && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else if (!next && document.fullscreenElement) {
      await document.exitFullscreen?.();
    }
  } catch {
    // CSS presentation mode still works if browser fullscreen is blocked.
  }

  syncButton();
}

function resetButtonClasses(button: HTMLButtonElement) {
  button.classList.remove(
    "dashboard-fullscreen-compact",
    "dashboard-fullscreen-sidebar",
    "dashboard-fullscreen-floating",
  );
}

function mountButton() {
  const kind = getDashboardKind();
  const button = ensureButton();

  if (!kind) {
    button.hidden = true;
    return;
  }

  const active = isPresentationActive();
  button.hidden = false;
  button.setAttribute("aria-pressed", active ? "true" : "false");
  button.innerHTML = iconSvg(active);

  resetButtonClasses(button);

  if (active) {
    button.classList.add("dashboard-fullscreen-floating");
    if (button.parentElement !== document.body) {
      document.body.appendChild(button);
    }
    return;
  }

  if (kind === "executive") {
    const host = getExecutiveActionHost();
    button.classList.add("dashboard-fullscreen-compact");

    if (host && button.parentElement !== host) {
      host.appendChild(button);
      return;
    }
  }

  if (kind === "hse-master" || kind === "esg-master") {
    const host = ensureSidebarHost();
    button.classList.add("dashboard-fullscreen-sidebar");

    if (host && button.parentElement !== host) {
      host.appendChild(button);
      return;
    }
  }

  button.classList.add("dashboard-fullscreen-floating");
  if (button.parentElement !== document.body) {
    document.body.appendChild(button);
  }
}

function syncButton() {
  setPresentationActive(isPresentationActive());
  mountButton();
}

function installDashboardFullscreen() {
  if (window.__hseDashboardFullscreenInstalled) return;
  window.__hseDashboardFullscreenInstalled = true;

  syncButton();

  window.addEventListener("popstate", () => setTimeout(syncButton, 100));
  window.addEventListener("hashchange", () => setTimeout(syncButton, 100));
  window.addEventListener("click", () => setTimeout(syncButton, 150));
  window.addEventListener("resize", () => setTimeout(syncButton, 150));

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && isPresentationActive()) {
      setPresentationActive(false);
    }
    syncButton();
  });

  setInterval(syncButton, 1500);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installDashboardFullscreen);
} else {
  installDashboardFullscreen();
}

export {};
