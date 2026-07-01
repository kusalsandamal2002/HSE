declare global {
  interface Window {
    __hseDashboardFullscreenInstalled?: boolean;
  }
}

const STORAGE_KEY = "hse-dashboard-presentation-mode";
const BUTTON_CLASS = "dashboard-fullscreen-trigger";
const ACTIVE_CLASS = "hse-dashboard-fullscreen-active";

function pageText() {
  return document.body?.innerText?.toLowerCase() ?? "";
}

function currentPath() {
  return window.location.pathname.toLowerCase();
}

function isDashboardPage() {
  const path = currentPath();
  const text = pageText();

  return (
    path.includes("dashboard") ||
    text.includes("executive dashboard") ||
    text.includes("hse master dashboard") ||
    text.includes("esg master dashboard")
  );
}

function isExecutiveDashboard() {
  const text = pageText();
  const path = currentPath();

  return path.includes("executive") || text.includes("executive dashboard");
}

function isHseMasterDashboard() {
  const text = pageText();
  const path = currentPath();

  return path.includes("master") || text.includes("hse master dashboard");
}

function isEsgDashboard() {
  const text = pageText();
  const path = currentPath();

  return path.includes("esg") || text.includes("esg master dashboard");
}

function presentationActive() {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

function applyPresentationMode(active: boolean) {
  document.documentElement.classList.toggle(ACTIVE_CLASS, active);
  document.body.classList.toggle(ACTIVE_CLASS, active);
  localStorage.setItem(STORAGE_KEY, active ? "1" : "0");
}

async function toggleFullscreen() {
  const next = !presentationActive();
  applyPresentationMode(next);

  try {
    if (next && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else if (!next && document.fullscreenElement) {
      await document.exitFullscreen?.();
    }
  } catch {
    // CSS presentation mode still works when browser fullscreen is blocked.
  }

  syncButton();
}

function ensureButton() {
  let button = document.querySelector<HTMLButtonElement>(`.${BUTTON_CLASS}`);

  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.title = "Toggle dashboard fullscreen";
    button.setAttribute("aria-label", "Toggle dashboard fullscreen");
    button.addEventListener("click", toggleFullscreen);
    document.body.appendChild(button);
  }

  return button;
}

function findHeadingByText(words: string[]) {
  const headings = Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3, strong, .master-title, .page-title"));

  return headings.find((item) => {
    const text = item.innerText?.toLowerCase() ?? "";
    return words.every((word) => text.includes(word));
  });
}

function useInlineHost(button: HTMLButtonElement, host: HTMLElement) {
  host.classList.add("dashboard-fullscreen-inline-host");
  host.classList.remove("dashboard-fullscreen-corner-host");

  if (button.parentElement !== host) {
    host.appendChild(button);
  }
}

function useCornerHost(button: HTMLButtonElement, host: HTMLElement) {
  host.classList.add("dashboard-fullscreen-corner-host");
  host.classList.remove("dashboard-fullscreen-inline-host");

  if (button.parentElement !== host) {
    host.appendChild(button);
  }
}

function closestHeaderHost(element: HTMLElement | undefined | null) {
  return element?.closest<HTMLElement>(
    [
      ".master-dashboard-header",
      ".master-header",
      ".master-topbar",
      ".esg-dashboard-header",
      ".esg-header",
      ".dashboard-header",
      ".dashboard-hero",
      ".page-hero",
      "header",
      "section",
      ".panel",
      "div",
    ].join(", "),
  );
}

function findMountHost() {
  const button = ensureButton();

  document
    .querySelectorAll(".dashboard-fullscreen-inline-host, .dashboard-fullscreen-corner-host")
    .forEach((item) => {
      if (!item.contains(button)) {
        item.classList.remove("dashboard-fullscreen-inline-host", "dashboard-fullscreen-corner-host");
      }
    });

  if (isExecutiveDashboard()) {
    const userBox = document.querySelector<HTMLElement>(".topbar .userbox, .userbox, .topbar-actions, .user-actions");
    if (userBox) {
      useInlineHost(button, userBox);
      return;
    }

    const heading = findHeadingByText(["executive", "dashboard"]);
    const host = closestHeaderHost(heading);
    if (host) {
      useCornerHost(button, host);
      return;
    }
  }

  if (isHseMasterDashboard()) {
    const heading = findHeadingByText(["hse", "master", "dashboard"]);
    const host = closestHeaderHost(heading);
    if (host) {
      useCornerHost(button, host);
      return;
    }
  }

  if (isEsgDashboard()) {
    const heading = findHeadingByText(["esg", "master", "dashboard"]);
    const host = closestHeaderHost(heading);
    if (host) {
      useCornerHost(button, host);
      return;
    }
  }

  document.body.appendChild(button);
}

function syncButton() {
  const button = ensureButton();

  if (!isDashboardPage()) {
    button.hidden = true;
    return;
  }

  button.hidden = false;
  button.textContent = presentationActive() ? "×" : "?";
  button.setAttribute("aria-pressed", presentationActive() ? "true" : "false");

  findMountHost();
}

function installDashboardFullscreenButton() {
  if (window.__hseDashboardFullscreenInstalled) return;
  window.__hseDashboardFullscreenInstalled = true;

  applyPresentationMode(presentationActive());
  syncButton();

  window.addEventListener("popstate", () => setTimeout(syncButton, 80));
  window.addEventListener("hashchange", () => setTimeout(syncButton, 80));
  window.addEventListener("click", () => setTimeout(syncButton, 120));
  window.addEventListener("resize", () => setTimeout(syncButton, 120));

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && presentationActive()) {
      applyPresentationMode(false);
    }

    syncButton();
  });

  setInterval(syncButton, 1200);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installDashboardFullscreenButton);
} else {
  installDashboardFullscreenButton();
}

export {};
