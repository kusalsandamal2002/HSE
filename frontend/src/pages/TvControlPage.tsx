import { useEffect, useMemo, useState } from "react";
import { api, openTvUrl, TV_DASHBOARD_URL } from "../lib/api";
import { months } from "../lib/enums";
import { useLookups } from "../hooks/useLookups";
import { ErrorState, Field, LoadingState, SelectLookup } from "../components/FormTools";
import { officialCompanyName } from "../lib/brand";

const LANGUAGE_MODES = ["EN", "SINHALA", "TAMIL", "TRILINGUAL"] as const;
type LanguageMode = typeof LANGUAGE_MODES[number];

type TvSettingsForm = {
  companyName: string;
  dashboardTitle: string;
  intervalSeconds: number | string;
  languageMode: LanguageMode;
  displayMode: string;
  showClock: boolean;
  showCounter: boolean;
  autoAdvance: boolean;
  selectedYear: number | string | null;
  selectedMonth: number | string | null;
  selectedDepartmentId: string | null;
};

function isLanguageMode(value: unknown): value is LanguageMode {
  return typeof value === "string" && LANGUAGE_MODES.includes(value as LanguageMode);
}

function normalizeCompanyName(value: unknown) {
  return !value || ["HSE", "HSE Company", "LAUGFS Rubber"].includes(String(value)) ? officialCompanyName : String(value);
}

function toFormSettings(raw: any): TvSettingsForm {
  return {
    companyName: normalizeCompanyName(raw?.companyName),
    dashboardTitle: raw?.dashboardTitle === "HSE Dashboard" ? "Live HSE Dashboard" : raw?.dashboardTitle || "Live HSE Dashboard",
    intervalSeconds: Number(raw?.intervalSeconds || 12),
    languageMode: isLanguageMode(raw?.languageMode) ? raw.languageMode : "EN",
    displayMode: raw?.displayMode || "AUTO",
    showClock: raw?.showClock ?? true,
    showCounter: raw?.showCounter ?? true,
    autoAdvance: raw?.autoAdvance ?? true,
    selectedYear: raw?.selectedYear || new Date().getFullYear(),
    selectedMonth: raw?.selectedMonth ?? null,
    selectedDepartmentId: raw?.selectedDepartmentId || null,
  };
}

function buildPayload(settings: TvSettingsForm) {
  const intervalSeconds = Number(settings.intervalSeconds || 12);
  const selectedYear = settings.selectedYear === "" || settings.selectedYear === null ? null : Number(settings.selectedYear);
  const selectedMonth = settings.selectedMonth === "" || settings.selectedMonth === null ? null : Number(settings.selectedMonth);

  return {
    companyName: settings.companyName.trim() || officialCompanyName,
    dashboardTitle: settings.dashboardTitle.trim() || "Live HSE Dashboard",
    intervalSeconds,
    languageMode: isLanguageMode(settings.languageMode) ? settings.languageMode : "EN",
    displayMode: settings.displayMode || "AUTO",
    showClock: Boolean(settings.showClock),
    showCounter: Boolean(settings.showCounter),
    autoAdvance: Boolean(settings.autoAdvance),
    selectedYear,
    selectedMonth,
    selectedDepartmentId: settings.selectedDepartmentId || null,
  };
}

export function TvControlPage() {
  const { lookups } = useLookups();
  const [settings, setSettings] = useState<TvSettingsForm | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const backendUrl = useMemo(() => TV_DASHBOARD_URL.replace(/\/tv$/, ""), []);

  useEffect(() => {
    Promise.all([
      api<any>("/api/tv/settings"),
      fetch(`${backendUrl}/api/health`, { cache: "no-store" }).then((res) => res.ok),
    ])
      .then(([settingsData, ok]) => { setSettings(toFormSettings(settingsData)); setStatus(ok ? "online" : "offline"); })
      .catch((err) => { setError(err instanceof Error ? err.message : "Unable to load TV settings"); setStatus("offline"); });
  }, [backendUrl]);

  if (error && !settings) return <ErrorState message={error} />;
  if (!settings) return <LoadingState text="Loading TV settings..." />;

  async function save() {
    if (!settings) return;
    setError("");
    setSavedMessage("");
    try {
      const saved = await api<any>("/api/tv/settings", { method: "PUT", body: JSON.stringify(buildPayload(settings)) });
      setSettings(toFormSettings(saved));
      setSavedMessage("TV settings saved.");
      setPreviewKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save TV settings");
    }
  }

  return (
    <section className="page-stack">
      <div className="panel tv-control-hero">
        <div>
          <h2>Smart TV Dashboard Control</h2>
          <p>Configure the public HSE dashboard used by wall-mounted displays and smart TV browsers.</p>
        </div>
        <span className={`status-dot ${status === "online" ? "" : "offline"}`}>{status === "online" ? "Backend online" : status === "checking" ? "Checking" : "Backend offline"}</span>
      </div>

      <div className="panel form-grid tv-settings-grid">
        <Field label="Company Name"><input value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} /></Field>
        <Field label="Dashboard Title"><input value={settings.dashboardTitle} onChange={(e) => setSettings({ ...settings, dashboardTitle: e.target.value })} /></Field>
        <Field label="Slide Interval Seconds" hint="Allowed range: 5 to 120 seconds."><input type="number" min="5" max="120" value={settings.intervalSeconds} onChange={(e) => setSettings({ ...settings, intervalSeconds: Number(e.target.value) })} /></Field>
        <Field label="Language Mode"><select value={settings.languageMode} onChange={(e) => setSettings({ ...settings, languageMode: e.target.value as LanguageMode })}>{LANGUAGE_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></Field>
        <Field label="Selected Year"><input type="number" value={settings.selectedYear || ""} onChange={(e) => setSettings({ ...settings, selectedYear: e.target.value ? Number(e.target.value) : null })} /></Field>
        <Field label="Selected Month"><select value={settings.selectedMonth || ""} onChange={(e) => setSettings({ ...settings, selectedMonth: e.target.value ? Number(e.target.value) : null })}><option value="">Full Year</option>{months.map(([month, label]) => <option key={month} value={month}>{label}</option>)}</select></Field>
        <Field label="Department"><SelectLookup value={settings.selectedDepartmentId || ""} onChange={(value) => setSettings({ ...settings, selectedDepartmentId: value || null })} items={lookups.departments} placeholder="All Departments" /></Field>
        <Field label="Auto Advance"><select value={String(settings.autoAdvance)} onChange={(e) => setSettings({ ...settings, autoAdvance: e.target.value === "true" })}><option value="true">Enabled</option><option value="false">Disabled</option></select></Field>
        {error && <p className="error wide">{error}</p>}
        {savedMessage && <p className="hint wide">{savedMessage}</p>}
        <div className="form-actions wide"><button type="button" className="primary" onClick={save}>Save TV Settings</button></div>
      </div>

      <div className="panel tv-link-panel">
        <div className="section-heading">
          <div>
            <h2>TV Dashboard Preview</h2>
            <p>The TV page reads live PostgreSQL data through the backend and refreshes automatically.</p>
          </div>
        </div>
        <div className="tv-url-display"><span>TV dashboard URL</span><code>{TV_DASHBOARD_URL}</code></div>
        <p>For a physical smart TV, replace `localhost` with this PC's network IP address while keeping port `5000` and `/tv`.</p>
        <code>http://YOUR-PC-IP:5000/tv</code>
        <div className="form-actions tv-preview-actions">
          <button type="button" onClick={() => setPreviewKey((key) => key + 1)}>Preview TV Dashboard</button>
          <button type="button" className="primary" onClick={openTvUrl}>Open TV Dashboard in Browser</button>
        </div>
        <iframe key={previewKey} className="tv-preview-frame" title="TV Dashboard Preview" src={TV_DASHBOARD_URL} />
      </div>
    </section>
  );
}