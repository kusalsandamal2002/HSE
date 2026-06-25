import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import { companyName, companyProfile } from "../lib/brand";
import { formatCurrency, formatFixed, formatNumber } from "../lib/format";
import { EmptyState, ErrorState, LoadingState } from "../components/FormTools";
import type { User } from "../types";

export type EsgPageKey = "esg-dashboard" | "esg-upload" | "esg-reports";

type EsgTrendPoint = { label: string; year: number; value: number };
type EsgNoisePoint = { label: string; year: number; day: number; dayStandard: number; night: number; nightStandard: number };
type EsgConcernPoint = { name: string; count: number };
type EsgSnapshotMeta = { year: number; sourceFile: string; sourcePath: string | null; sourceSheet: string | null; periodLabel: string; tracked: boolean; updatedAt: string };

type EsgSummaryResponse = {
  year: number;
  sourceFile: string | null;
  sourcePath: string | null;
  sourceSheet: string | null;
  periodLabel: string;
  tracked: boolean;
  importedAt: string | null;
  availableYears: number[];
  snapshots: EsgSnapshotMeta[];
  kpis: {
    ghgIntensity: { value: number; target: number; label: string; status: string };
    scrapFlashWaste: { value: number; target: number; label: string; status: string };
    wasteRecycling: { value: number; target: number; label: string; status: string };
    externalNoiseDay: { value: number; standard: number; label: string; status: string };
    externalNoiseNight: { value: number; standard: number; label: string; status: string };
    tf: { total: number; rate: number; label: string; periodLabel: string; source: string; status: string };
    ts: { total: number; rate: number; label: string; periodLabel: string; source: string; status: string };
    stakeholderConcerns: { total: number; label: string; topConcern: EsgConcernPoint | null; status: string };
  };
  charts: {
    ghgIntensityTrend: EsgTrendPoint[];
    scrapFlashWasteTrend: EsgTrendPoint[];
    wasteRecyclingTrend: EsgTrendPoint[];
    noiseTrend: EsgNoisePoint[];
    tfTrend: EsgTrendPoint[];
    tsTrend: EsgTrendPoint[];
    stakeholderConcerns: EsgConcernPoint[];
  };
};

type EsgShellProps = {
  activePage: EsgPageKey;
  onNavigate: (page: EsgPageKey) => void;
  onLogout: () => void;
  children: ReactNode;
};

const palette = {
  teal: "#25e0db",
  gold: "#f7bd28",
  green: "#9eea5b",
  cyan: "#45c8ff",
  blue: "#5b8cff",
  purple: "#a879ff",
  orange: "#ff8f2f",
  red: "#ff4b55",
  slate: "#8aa0b6",
};

const donutPalette = [palette.teal, palette.gold, palette.green, palette.cyan, palette.blue, palette.purple, palette.orange];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function useEsgSummary(year: number) {
  const [data, setData] = useState<EsgSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (year) params.set("year", String(year));
    setLoading(true);
    setError("");
    api<EsgSummaryResponse>(`/api/esg/summary${params.toString() ? `?${params}` : ""}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "ESG dashboard load failed"))
      .finally(() => setLoading(false));
  }, [year]);

  return { data, loading, error };
}

function shorten(value: unknown, max = 16) {
  const text = String(value || "-");
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function hasTrend(items: any[] | undefined) {
  return Boolean(items?.length);
}

function tooltipValue(value: unknown, name: string) {
  if (name.includes("Expense")) return formatCurrency(value);
  if (name.includes("Standard") || name.includes("Rate")) return formatFixed(value, 2);
  return formatNumber(value);
}

function EsgTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="esg-tooltip">
      <strong>{String(label ?? payload[0]?.payload?.label ?? "")}</strong>
      {payload.map((entry: any) => (
        <span key={`${entry.dataKey}-${entry.name}`}>{entry.name || entry.dataKey}: {tooltipValue(entry.value, String(entry.name || entry.dataKey || "Value"))}</span>
      ))}
    </div>
  );
}

type EsgIconKind = "leaf" | "trash" | "recycle" | "sun" | "moon" | "calendar" | "clock" | "insights" | "shield" | "clipboard" | "people";

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function EsgIcon({ kind }: { kind: EsgIconKind }) {
  switch (kind) {
    case "leaf":
      return (
        <svg {...iconProps} aria-hidden="true">
          <path d="M20 4c-7 0-13 5-14 12 0 2 1 4 4 4 7 0 12-7 12-16Z" />
          <path d="M7 17c4-5 8-8 13-10" />
        </svg>
      );
    case "trash":
      return (
        <svg {...iconProps} aria-hidden="true">
          <path d="M4 7h16" />
          <path d="M9 7V5h6v2" />
          <path d="M6 7l1 12h10l1-12" />
          <path d="M10 11v5M14 11v5" />
        </svg>
      );
    case "recycle":
      return (
        <svg {...iconProps} aria-hidden="true">
          <path d="M7 6h4l-2-3" />
          <path d="M17 10l2 3h-4" />
          <path d="M10 18H6l2-3" />
          <path d="M5.5 9a7 7 0 0 1 7-5" />
          <path d="M18.5 14a7 7 0 0 1-7 5" />
          <path d="M11 4l1 2M13 20l-1-2" />
        </svg>
      );
    case "sun":
      return (
        <svg {...iconProps} aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4 12h2M18 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </svg>
      );
    case "moon":
      return (
        <svg {...iconProps} aria-hidden="true">
          <path d="M15 4a8 8 0 1 0 5 14 9 9 0 1 1-5-14Z" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...iconProps} aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 9h16" />
        </svg>
      );
    case "clock":
      return (
        <svg {...iconProps} aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v5l3 2" />
        </svg>
      );
    case "insights":
      return (
        <svg {...iconProps} aria-hidden="true">
          <path d="M4 17h16" />
          <path d="M6 16v-4M10 16v-7M14 16v-3M18 16v-9" />
          <path d="M6 10l4-2 3 1 5-5" />
        </svg>
      );
    case "shield":
      return (
        <svg {...iconProps} aria-hidden="true">
          <path d="M12 3 5 6v5c0 5 3 9 7 10 4-1 7-5 7-10V6l-7-3Z" />
          <path d="M12 8v6M9 11h6" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...iconProps} aria-hidden="true">
          <rect x="6" y="4" width="12" height="16" rx="2" />
          <path d="M9 4h6v3H9z" />
          <path d="M9 10h6M9 14h6" />
        </svg>
      );
    case "people":
      return (
        <svg {...iconProps} aria-hidden="true">
          <circle cx="9" cy="9" r="2.5" />
          <circle cx="16" cy="10.5" r="2" />
          <path d="M4.5 18c.8-2.7 3-4.5 4.5-4.5s3.7 1.8 4.5 4.5" />
          <path d="M12.5 18c.5-1.8 2-3 3.5-3s2.7 1.2 3.5 3" />
        </svg>
      );
    default:
      return null;
  }
}
function EsgShell({ children }: EsgShellProps) {
  return <>{children}</>;
}

function Panel({ index, title, badge, className, children }: { index: number; title: string; badge?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={"esg-panel" + (className ? " " + className : "")}>
      <header className="esg-panel-title">
        <h2><span>{index}.</span> {title}</h2>
        {badge && <strong>{badge}</strong>}
      </header>
      {children}
    </section>
  );
}

function MetricCard({ label, value, note, detail, status, tone, icon }: { label: string; value: string; note: string; detail?: string; status: string; tone: string; icon: ReactNode }) {
  return (
    <div className={`esg-metric ${tone}`}>
      <span className="esg-metric-mark" aria-hidden="true">{icon}</span>
      <div className="esg-metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
        {detail && <small className="esg-metric-detail">{detail}</small>}
        <em>{status}</em>
      </div>
    </div>
  );
}
function ChartEmpty({ text = "No data available" }: { text?: string }) {
  return <div className="esg-empty">{text}</div>;
}

function VerticalBars({ data, valueKey = "value", color, labelMax = 16, labelWidth = 96, marginLeft = 16, barSize = 18 }: { data: any[]; valueKey?: string; color: string; labelMax?: number; labelWidth?: number; marginLeft?: number; barSize?: number }) {
  if (!hasTrend(data)) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 18, left: marginLeft, bottom: 6 }}>
        <CartesianGrid stroke="rgba(148,163,184,.12)" horizontal={false} />
        <XAxis type="number" tick={{ fill: "#b8c7d9", fontSize: 11 }} axisLine={{ stroke: "rgba(148,163,184,.38)" }} tickLine={false} />
        <YAxis type="category" dataKey="label" width={labelWidth} interval={0} tick={{ fill: "#f3f7fb", fontSize: 10 }} tickFormatter={(v) => shorten(v, labelMax)} axisLine={false} tickLine={false} />
        <Tooltip content={<EsgTooltip />} cursor={{ fill: "rgba(255,255,255,.04)" }} />
        <Bar dataKey={valueKey} fill={color} radius={[0, 4, 4, 0]} barSize={barSize} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function useSeriesLabel(series: { label: string }[] | undefined) {
  return useMemo(() => series?.[series.length - 1]?.label || "", [series]);
}

export function EsgDashboardPage({ onNavigate, onLogout }: { onNavigate: (page: EsgPageKey) => void; onLogout: () => void; user?: User | null }) {
  const [year, setYear] = useState(2026);
  const now = useClock();
  const { data, loading, error } = useEsgSummary(year);

  useEffect(() => {
    if (data?.availableYears?.length && !data.availableYears.includes(year)) {
      setYear(data.availableYears[0]);
    }
  }, [data, year]);

  const k = data?.kpis;
  const charts = data?.charts;

  if (loading) {
    return <EsgShell activePage="esg-dashboard" onNavigate={onNavigate} onLogout={onLogout}><LoadingState text="Loading ESG dashboard..." /></EsgShell>;
  }

  if (error) {
    return <EsgShell activePage="esg-dashboard" onNavigate={onNavigate} onLogout={onLogout}><ErrorState message={error} /></EsgShell>;
  }

  if (!data || !k || !charts) {
    return <EsgShell activePage="esg-dashboard" onNavigate={onNavigate} onLogout={onLogout}><EmptyState text="No ESG data" detail="Run the workbook import to populate the dashboard." /></EsgShell>;
  }

  const ghgLatest = charts.ghgIntensityTrend.at(-1);
  const scrapLatest = charts.scrapFlashWasteTrend.at(-1);
  const wasteLatest = charts.wasteRecyclingTrend.at(-1);
  const wasteChartData = charts.wasteRecyclingTrend.map((item) => ({ ...item, target: Number(k.wasteRecycling.target || 0) }));
  const noiseLatest = charts.noiseTrend.at(-1);
  const tfLatest = charts.tfTrend.at(-1);
  const tsLatest = charts.tsTrend.at(-1);

  const yearOptions = data.availableYears.length ? data.availableYears : [year];
  const dashboardPeriod = data.periodLabel || "Up to May";
  const topCards = [
    { label: "1. GHG EMISSION INTENSITY", value: formatFixed(k.ghgIntensity.value, 2), note: `MT CO2e / tyre (${k.ghgIntensity.label})`, detail: `Target ${formatFixed(k.ghgIntensity.target, 2)}`, status: k.ghgIntensity.status, tone: "tone-teal", icon: <EsgIcon kind="leaf" /> },
    { label: "2. SCRAP FLASH WASTE", value: `${formatFixed(k.scrapFlashWaste.value, 1)}%`, note: `${k.scrapFlashWaste.label}`, detail: `Target ${formatFixed(k.scrapFlashWaste.target, 1)}%`, status: k.scrapFlashWaste.status, tone: "tone-gold", icon: <EsgIcon kind="trash" /> },
    { label: "3. WASTE RECYCLING", value: `${formatFixed(k.wasteRecycling.value, 0)}%`, note: `${k.wasteRecycling.label}`, detail: `Target ${formatFixed(k.wasteRecycling.target, 0)}%`, status: k.wasteRecycling.status, tone: "tone-green", icon: <EsgIcon kind="recycle" /> },
    { label: "4. EXTERNAL NOISE DAY", value: `${formatFixed(k.externalNoiseDay.value, 0)} dB`, note: `${k.externalNoiseDay.label}`, detail: `Standard ${formatFixed(k.externalNoiseDay.standard, 0)} dB`, status: k.externalNoiseDay.status, tone: "tone-cyan", icon: <EsgIcon kind="sun" /> },
    { label: "5. EXTERNAL NOISE NIGHT", value: `${formatFixed(k.externalNoiseNight.value, 0)} dB`, note: `${k.externalNoiseNight.label}`, detail: `Standard ${formatFixed(k.externalNoiseNight.standard, 0)} dB`, status: k.externalNoiseNight.status, tone: "tone-blue", icon: <EsgIcon kind="moon" /> },
    { label: "6. TF (TOTAL FATALITIES)", value: formatNumber(k.tf.total), note: k.tf.periodLabel, detail: `Source: ${k.tf.source}`, status: k.tf.status, tone: "tone-purple", icon: <EsgIcon kind="shield" /> },
    { label: "7. TS (TOTAL RECORDABLE CASES)", value: formatNumber(k.ts.total), note: k.ts.periodLabel, detail: `Source: ${k.ts.source}`, status: k.ts.status, tone: "tone-purple", icon: <EsgIcon kind="clipboard" /> },
    { label: "8. STAKEHOLDER CONCERNS", value: formatNumber(k.stakeholderConcerns.total), note: "Total", detail: k.stakeholderConcerns.topConcern ? `Top concern: ${k.stakeholderConcerns.topConcern.name} (${k.stakeholderConcerns.topConcern.count})` : k.stakeholderConcerns.status, status: k.stakeholderConcerns.topConcern ? "View details" : "Not tracked", tone: "tone-gold", icon: <EsgIcon kind="people" /> },
  ];
  const summaryStrip = [
    { label: "GHG Emission Intensity", value: `${formatFixed(k.ghgIntensity.value, 2)} < ${formatFixed(k.ghgIntensity.target, 2)}`, note: k.ghgIntensity.status, tone: "tone-teal" },
    { label: "Scrap Flash Waste", value: `${formatFixed(k.scrapFlashWaste.value, 1)}%`, note: k.scrapFlashWaste.status, tone: "tone-gold" },
    { label: "Waste Recycling", value: `${formatFixed(k.wasteRecycling.value, 0)}%`, note: k.wasteRecycling.status, tone: "tone-green" },
    { label: "Noise Levels", value: `${formatFixed(k.externalNoiseDay.value, 0)} / ${formatFixed(k.externalNoiseNight.value, 0)} dB`, note: `${k.externalNoiseDay.status} / ${k.externalNoiseNight.status}`, tone: "tone-cyan" },
    { label: "TF", value: `${formatNumber(k.tf.total)} total fatalities`, note: k.tf.status, tone: "tone-purple" },
    { label: "TS", value: `${formatNumber(k.ts.total)} cases`, note: k.ts.status, tone: "tone-purple" },
    { label: "Stakeholder Concerns", value: `${formatNumber(k.stakeholderConcerns.total)} total`, note: k.stakeholderConcerns.topConcern ? `Top: ${k.stakeholderConcerns.topConcern.name}` : "Not tracked", tone: "tone-gold" },
  ];

  const noiseSeries = charts.noiseTrend.map((item) => ({
    ...item,
    day: Number(item.day || 0),
    dayStandard: Number(item.dayStandard || 0),
    night: Number(item.night || 0),
    nightStandard: Number(item.nightStandard || 0),
  }));

  return (
    <EsgShell activePage="esg-dashboard" onNavigate={onNavigate} onLogout={onLogout}>
      <section className="esg-dashboard">
        <header className="esg-hero">
          <div className="esg-brand-block">
            <span className="esg-mark" aria-hidden="true">
              <EsgIcon kind="leaf" />
            </span>
            <div>
              <h1>ESG MASTER DASHBOARD</h1>
              <p>{companyName}</p>
              <small>Factory: {companyProfile.factory}</small>
            </div>
          </div>

          <div className="esg-clock-card">
            <span className="esg-card-label">
              <EsgIcon kind="clock" />
              <span>Date &amp; Time</span>
            </span>
            <strong>{now.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}</strong>
            <span>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          </div>

          <div className="esg-filter-card">
            <label>
              <span className="esg-filter-label">
                <EsgIcon kind="calendar" />
                <span>Year</span>
              </span>
              <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {yearOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span className="esg-filter-label">
                <EsgIcon kind="calendar" />
                <span>Period</span>
              </span>
              <select value={dashboardPeriod} disabled>
                <option value={dashboardPeriod}>{dashboardPeriod}</option>
              </select>
            </label>
          </div>
        </header>
        <div className="esg-kpi-strip">
          {topCards.map((item) => <MetricCard key={item.label} {...item} />)}
        </div>

        <div className="esg-chart-grid">
          <Panel index={1} title="GHG EMISSION INTENSITY" badge={ghgLatest ? ghgLatest.label : k.ghgIntensity.label}>
            <VerticalBars data={charts.ghgIntensityTrend.map((item) => ({ label: item.label, value: item.value }))} color={palette.teal} />
          </Panel>

          <Panel index={2} title="SCRAP FLASH WASTE REDUCTION" badge={scrapLatest ? scrapLatest.label : k.scrapFlashWaste.label}>
            <VerticalBars data={charts.scrapFlashWasteTrend.map((item) => ({ label: item.label, value: item.value }))} color={palette.gold} />
          </Panel>

          <Panel index={3} title="WASTE RECYCLING" badge={wasteLatest ? wasteLatest.label : k.wasteRecycling.label}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={wasteChartData} margin={{ top: 6, right: 12, left: 0, bottom: 6 }}>
                <CartesianGrid stroke="rgba(148,163,184,.12)" />
                <XAxis dataKey="label" tick={{ fill: "#c7d2df", fontSize: 10 }} axisLine={{ stroke: "rgba(148,163,184,.38)" }} tickLine={false} />
                <YAxis tick={{ fill: "#c7d2df", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatNumber(value)} />
                <Tooltip content={<EsgTooltip />} />
                <Line type="monotone" dataKey="value" name="Waste Recycling" stroke={palette.green} strokeWidth={3} dot={{ r: 4, fill: palette.green }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="target" name="Target" stroke={palette.gold} strokeDasharray="5 4" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel index={4} title="NOISE LEVELS ANALYSIS" badge={`Point A Ã¢â‚¬Â¢ ${dashboardPeriod}`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={noiseSeries} margin={{ top: 6, right: 12, left: 0, bottom: 6 }}>
                <CartesianGrid stroke="rgba(148,163,184,.12)" />
                <XAxis dataKey="label" tick={{ fill: "#c7d2df", fontSize: 10 }} axisLine={{ stroke: "rgba(148,163,184,.38)" }} tickLine={false} />
                <YAxis tick={{ fill: "#c7d2df", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<EsgTooltip />} />
                <Line type="monotone" dataKey="day" name="Day Time (dB)" stroke={palette.cyan} strokeWidth={3} dot={{ r: 3, fill: palette.cyan }} />
                <Line type="monotone" dataKey="night" name="Night Time (dB)" stroke={palette.purple} strokeWidth={3} dot={{ r: 3, fill: palette.purple }} />
                <Line type="monotone" dataKey="dayStandard" name="Day Time Standard (55 dB)" stroke={palette.green} strokeDasharray="5 4" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="nightStandard" name="Night Time Standard (45 dB)" stroke={palette.gold} strokeDasharray="5 4" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </Panel>

          <Panel index={5} title="TF (TOTAL FATALITIES)" badge={tfLatest ? tfLatest.label : k.tf.periodLabel}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.tfTrend} margin={{ top: 6, right: 12, left: 0, bottom: 6 }}>
                <CartesianGrid stroke="rgba(148,163,184,.12)" />
                <XAxis dataKey="label" tick={{ fill: "#c7d2df", fontSize: 10 }} axisLine={{ stroke: "rgba(148,163,184,.38)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#c7d2df", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<EsgTooltip />} />
                <Line type="monotone" dataKey="value" name="Fatalities" stroke={palette.teal} strokeWidth={3} dot={{ r: 4, fill: palette.teal }} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel index={6} title="TS (TOTAL RECORDABLE CASES)" badge={tsLatest ? tsLatest.label : k.ts.periodLabel}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.tsTrend} margin={{ top: 6, right: 12, left: 0, bottom: 6 }}>
                <CartesianGrid stroke="rgba(148,163,184,.12)" />
                <XAxis dataKey="label" tick={{ fill: "#c7d2df", fontSize: 10 }} axisLine={{ stroke: "rgba(148,163,184,.38)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#c7d2df", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<EsgTooltip />} />
                <Line type="monotone" dataKey="value" name="Recordable Cases" stroke={palette.purple} strokeWidth={3} dot={{ r: 4, fill: palette.purple }} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel index={7} title="STAKEHOLDER CONCERNS" badge={`${formatNumber(k.stakeholderConcerns.total)} total`} className="esg-panel--wide">
            <div className="esg-donut-wrap">
              <ResponsiveContainer width="46%" height="100%">
                <PieChart>
                  <Pie data={charts.stakeholderConcerns} dataKey="count" nameKey="name" innerRadius="52%" outerRadius="82%" paddingAngle={2}>
                    {charts.stakeholderConcerns.map((_, index) => <Cell key={index} fill={donutPalette[index % donutPalette.length]} />)}
                  </Pie>
                  <Tooltip content={<EsgTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="esg-donut-center">
                <strong>{formatNumber(k.stakeholderConcerns.total)}</strong>
                <span>Total</span>
                <small>Concerns</small>
              </div>
              <div className="esg-legend">
                {charts.stakeholderConcerns.map((item, index) => {
                  const total = charts.stakeholderConcerns.reduce((sum, concern) => sum + concern.count, 0);
                  const percent = total > 0 ? formatFixed((item.count / total) * 100, 1) : "0.0";
                  return (
                    <span key={item.name} title={item.name}>
                      <i style={{ background: donutPalette[index % donutPalette.length] }} />
                      <strong>{item.name}</strong>
                      <em>{formatNumber(item.count)} ({percent}%)</em>
                    </span>
                  );
                })}
              </div>
            </div>
          </Panel>
        </div>

        <footer className="esg-strip">
          <div className="esg-strip-lead">
            <span className="esg-strip-kicker">
              <EsgIcon kind="insights" />
              <span>ESG INSIGHTS</span>
            </span>
            <strong>Workbook-backed status summary</strong>
            <small>Clean executive view from ESG Matrics.xlsx</small>
          </div>
          {summaryStrip.map((item) => (
            <div className={`esg-strip-card ${item.tone}`} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </div>
          ))}
        </footer>
      </section>
    </EsgShell>
  );
}

export function EsgUploadPage({ onNavigate, onLogout }: { onNavigate: (page: EsgPageKey) => void; onLogout: () => void; user?: User | null }) {
  const [year, setYear] = useState(2026);
  const { data, loading, error } = useEsgSummary(year);
  const importedAt = data?.importedAt ? new Date(data.importedAt).toLocaleString() : "-";

  if (loading) {
    return <EsgShell activePage="esg-upload" onNavigate={onNavigate} onLogout={onLogout}><LoadingState text="Loading ESG import status..." /></EsgShell>;
  }

  if (error) {
    return <EsgShell activePage="esg-upload" onNavigate={onNavigate} onLogout={onLogout}><ErrorState message={error} /></EsgShell>;
  }

  return (
    <EsgShell activePage="esg-upload" onNavigate={onNavigate} onLogout={onLogout}>
      <section className="esg-page">
        <div className="esg-page-header">
          <div>
            <p>ESG</p>
            <h1>Data Upload</h1>
            <small>Workbook import status and command reference.</small>
          </div>
          <div className="esg-page-meta">
            <strong>{data?.sourceFile || "ESG Matrics.xlsx"}</strong>
            <span>{data?.periodLabel || "Not tracked"}</span>
          </div>
        </div>

        <div className="esg-page-grid">
          <div className="esg-panel esg-upload-panel">
            <div className="chart-title">
              <h2>Import Command</h2>
              <span>Run from the repository root</span>
            </div>
            <code>cd &quot;C:\HSE\HSE_FULL&quot;{`\n`}$env:ESG_METRICS_WORKBOOK=&quot;C:\HSE\HSE_FULL\deta\ESG Matrics.xlsx&quot;{`\n`}npm.cmd --prefix backend run import:esg-metrics</code>
            <p className="esg-hint">This page is intentionally read-only. The workbook import is run by the backend script, not a browser upload flow.</p>
          </div>

          <div className="esg-panel">
            <div className="chart-title">
              <h2>Latest Snapshot</h2>
              <span>{importedAt}</span>
            </div>
            {data?.snapshots?.length ? (
              <table className="esg-table">
                <thead>
                  <tr><th>Year</th><th>Source</th><th>Period</th><th>Tracked</th><th>Updated</th></tr>
                </thead>
                <tbody>
                  {data.snapshots.map((snapshot) => (
                    <tr key={snapshot.year}>
                      <td>{snapshot.year}</td>
                      <td>{snapshot.sourceFile}</td>
                      <td>{snapshot.periodLabel}</td>
                      <td>{snapshot.tracked ? "Yes" : "No"}</td>
                      <td>{new Date(snapshot.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState text="No imported snapshot" detail="Run the import script to load the ESG workbook." />
            )}
          </div>
        </div>
      </section>
    </EsgShell>
  );
}

export function EsgReportsPage({ onNavigate, onLogout }: { onNavigate: (page: EsgPageKey) => void; onLogout: () => void; user?: User | null }) {
  const [year, setYear] = useState(2026);
  const { data, loading, error } = useEsgSummary(year);

  if (loading) {
    return <EsgShell activePage="esg-reports" onNavigate={onNavigate} onLogout={onLogout}><LoadingState text="Loading ESG reports..." /></EsgShell>;
  }

  if (error) {
    return <EsgShell activePage="esg-reports" onNavigate={onNavigate} onLogout={onLogout}><ErrorState message={error} /></EsgShell>;
  }

  if (!data) {
    return <EsgShell activePage="esg-reports" onNavigate={onNavigate} onLogout={onLogout}><EmptyState text="No ESG reports" detail="Import the workbook to generate report tables." /></EsgShell>;
  }

  const k = data.kpis;
  const charts = data.charts;

  return (
    <EsgShell activePage="esg-reports" onNavigate={onNavigate} onLogout={onLogout}>
      <section className="esg-page">
        <div className="esg-page-header">
          <div>
            <p>ESG</p>
            <h1>Reports</h1>
            <small>Workbook-derived summaries and trend tables.</small>
          </div>
          <div className="esg-page-meta">
            <strong>{year}</strong>
            <span>{data.periodLabel}</span>
          </div>
        </div>

        <div className="esg-page-grid">
          <div className="esg-panel">
            <div className="chart-title">
              <h2>Report Snapshot</h2>
              <span>{data.sourceFile}</span>
            </div>
            <table className="esg-table">
              <thead>
                <tr><th>Metric</th><th>Value</th><th>Target / Standard</th><th>Status</th></tr>
              </thead>
              <tbody>
                <tr><td>GHG emission intensity</td><td>{formatFixed(k.ghgIntensity.value, 2)}</td><td>{formatFixed(k.ghgIntensity.target, 2)}</td><td>{k.ghgIntensity.status}</td></tr>
                <tr><td>Scrap flash waste</td><td>{formatFixed(k.scrapFlashWaste.value, 1)}%</td><td>{formatFixed(k.scrapFlashWaste.target, 1)}%</td><td>{k.scrapFlashWaste.status}</td></tr>
                <tr><td>Waste recycling</td><td>{formatFixed(k.wasteRecycling.value, 0)}%</td><td>{formatFixed(k.wasteRecycling.target, 0)}%</td><td>{k.wasteRecycling.status}</td></tr>
                <tr><td>External noise day</td><td>{formatFixed(k.externalNoiseDay.value, 0)} dB</td><td>{formatFixed(k.externalNoiseDay.standard, 0)} dB</td><td>{k.externalNoiseDay.status}</td></tr>
                <tr><td>External noise night</td><td>{formatFixed(k.externalNoiseNight.value, 0)} dB</td><td>{formatFixed(k.externalNoiseNight.standard, 0)} dB</td><td>{k.externalNoiseNight.status}</td></tr>
                <tr><td>TF</td><td>{formatNumber(k.tf.total)}</td><td>{formatFixed(k.tf.rate, 2)}</td><td>{k.tf.status}</td></tr>
                <tr><td>TS</td><td>{formatNumber(k.ts.total)}</td><td>{formatFixed(k.ts.rate, 2)}</td><td>{k.ts.status}</td></tr>
                <tr><td>Stakeholder concerns</td><td>{formatNumber(k.stakeholderConcerns.total)}</td><td>{k.stakeholderConcerns.topConcern ? k.stakeholderConcerns.topConcern.name : "-"}</td><td>{k.stakeholderConcerns.status}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="esg-panel">
            <div className="chart-title">
              <h2>Workbook Trends</h2>
              <span>Imported from ESG Matrics.xlsx</span>
            </div>
            <table className="esg-table">
              <thead>
                <tr><th>Series</th><th>Latest</th><th>Points</th></tr>
              </thead>
              <tbody>
                <tr><td>GHG intensity</td><td>{ghgLatestLabel(charts.ghgIntensityTrend)}</td><td>{charts.ghgIntensityTrend.length}</td></tr>
                <tr><td>Scrap flash waste</td><td>{ghgLatestLabel(charts.scrapFlashWasteTrend)}</td><td>{charts.scrapFlashWasteTrend.length}</td></tr>
                <tr><td>Waste recycling</td><td>{ghgLatestLabel(charts.wasteRecyclingTrend)}</td><td>{charts.wasteRecyclingTrend.length}</td></tr>
                <tr><td>Noise levels</td><td>{ghgLatestLabel(charts.noiseTrend)}</td><td>{charts.noiseTrend.length}</td></tr>
                <tr><td>TF</td><td>{ghgLatestLabel(charts.tfTrend)}</td><td>{charts.tfTrend.length}</td></tr>
                <tr><td>TS</td><td>{ghgLatestLabel(charts.tsTrend)}</td><td>{charts.tsTrend.length}</td></tr>
                <tr><td>Stakeholder concerns</td><td>{k.stakeholderConcerns.topConcern ? k.stakeholderConcerns.topConcern.name : "-"}</td><td>{charts.stakeholderConcerns.length}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </EsgShell>
  );
}

function ghgLatestLabel(series: { label: string }[]) {
  return series.at(-1)?.label || "-";
}


