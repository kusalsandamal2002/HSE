let slides = [];
let settings = { intervalSeconds: 12, showClock: true, showCounter: true, autoAdvance: true };
let current = 0;
let chartPages = [];
let currentChartPage = 0;

const queryMode = new URLSearchParams(window.location.search).get('mode');
const fullscreenMode = queryMode === 'fullscreen';
const fullscreenButton = document.getElementById('fullscreenButton');
const fullscreenHint = document.getElementById('fullscreenHint');

if (fullscreenMode) document.body.classList.add('tv-query-fullscreen');

function fmt(value, unit = '') {
  if (typeof value !== 'number') return value ?? '--';
  const isAfr = unit === 'AFR';
  const formatted = value.toLocaleString('en-US', {
    maximumFractionDigits: isAfr ? 2 : Number.isInteger(value) ? 0 : 2,
    minimumFractionDigits: isAfr ? 2 : 0,
  });
  if (unit === 'LKR') return `LKR ${formatted}`;
  if (unit === 'h' || unit === 'hours') return `${formatted} h`;
  return formatted;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setFullscreenHint(message, tone = '') {
  if (!fullscreenHint) return;
  fullscreenHint.textContent = message;
  fullscreenHint.classList.toggle('warning', tone === 'warning');
  fullscreenHint.classList.toggle('error', tone === 'error');
}

function fullscreenSupported() {
  return Boolean(document.documentElement.requestFullscreen && document.exitFullscreen);
}

function updateFullscreenUi(message, tone = '') {
  const active = Boolean(document.fullscreenElement);
  document.body.classList.toggle('is-fullscreen', active);
  if (fullscreenButton) fullscreenButton.textContent = active ? 'Exit Full Screen' : 'Enter Full Screen';
  if (message) {
    setFullscreenHint(message, tone);
  } else if (!fullscreenSupported()) {
    setFullscreenHint('Fullscreen is not supported in this browser. Use the TV or browser fullscreen option.', 'warning');
  } else if (active) {
    setFullscreenHint('TV fullscreen active. Press Escape to exit.');
  } else {
    setFullscreenHint('Press F or click Enter Full Screen for TV display.');
  }
}

async function enterFullscreen() {
  if (!fullscreenSupported()) {
    updateFullscreenUi('Fullscreen is not supported in this browser. Use the TV or browser fullscreen option.', 'warning');
    return;
  }
  try {
    await document.documentElement.requestFullscreen();
  } catch (error) {
    console.warn(error);
    updateFullscreenUi('Fullscreen was blocked. Click Enter Full Screen again or use the browser fullscreen option.', 'error');
  }
}

async function exitFullscreen() {
  if (!document.fullscreenElement || !document.exitFullscreen) return;
  try {
    await document.exitFullscreen();
  } catch (error) {
    console.warn(error);
    updateFullscreenUi('Unable to exit fullscreen from this control. Press Escape.', 'warning');
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    exitFullscreen();
  } else {
    enterFullscreen();
  }
}

function hasAny(items, keys) {
  return Array.isArray(items) && items.some((item) => keys.some((key) => Number(item?.[key] || 0) > 0));
}

function chunk(items, size) {
  const pages = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages;
}

function updateClock() {
  const now = new Date();
  setText('clock', now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  setText('dateText', now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }));
}

function renderSlide() {
  if (!slides.length) return;
  const slide = slides[current % slides.length];
  setText('slideTitle', slide.title);
  setText('slideSubtitle', slide.subtitle || 'Live dashboard');
  setText('slideValue', fmt(slide.value, slide.unit));
  setText('slideUnit', ['LKR', 'h', 'hours'].includes(slide.unit) ? '' : (slide.unit || ''));
  setText('counter', settings.showCounter === false ? '' : `KPI ${(current % slides.length) + 1} / ${slides.length}`);
}

function renderKpis(kpis) {
  const grid = document.getElementById('kpiGrid');
  if (!grid) return;
  const items = [
    ['Total Accidents', kpis.totalIncidents, ''],
    ['First Aid', kpis.firstAid, ''],
    ['Medical', kpis.medicalTreatment, ''],
    ['Reportable', kpis.reportable, ''],
    ['Lost Hours', kpis.totalLostHours, 'h'],
    ['Medical Expense', kpis.medicalExpenseTotal, 'LKR'],
    ['Near Miss / Unsafe', kpis.observations, ''],
    ['Working Hours', kpis.totalWorkingHours, ''],
    ['AFR', kpis.afr, 'AFR'],
    ['Pending Actions', kpis.pendingActions, ''],
  ];
  grid.innerHTML = items.map(([label, value, unit]) => `<div class="kpi-card"><strong>${fmt(value, unit)}</strong><span>${escapeHtml(label)}</span></div>`).join('');
}

function emptyChart(title) {
  return `<article class="tv-chart-card"><header><h3>${escapeHtml(title)}</h3></header><div class="tv-chart-empty">No data</div></article>`;
}

function verticalBars(title, items, valueKey, unit = '') {
  if (!hasAny(items, [valueKey])) return emptyChart(title);
  const max = Math.max(...items.map((item) => Number(item?.[valueKey] || 0)), 1);
  const bars = items.map((item) => {
    const value = Number(item?.[valueKey] || 0);
    const height = Math.max((value / max) * 100, value > 0 ? 4 : 0);
    return `<div class="tv-bar-column">
      <strong>${fmt(value, unit)}</strong>
      <div class="tv-bar-track"><span style="height:${height}%"></span></div>
      <small>${escapeHtml(item.label || item.name || '')}</small>
    </div>`;
  }).join('');
  return `<article class="tv-chart-card"><header><h3>${escapeHtml(title)}</h3></header><div class="tv-bars">${bars}</div></article>`;
}

function horizontalBars(title, items, valueKey, unit = '', limit = 7) {
  if (!hasAny(items, [valueKey])) return emptyChart(title);
  const rows = [...items]
    .filter((item) => Number(item?.[valueKey] || 0) > 0)
    .sort((a, b) => Number(b?.[valueKey] || 0) - Number(a?.[valueKey] || 0))
    .slice(0, limit);
  const max = Math.max(...rows.map((item) => Number(item?.[valueKey] || 0)), 1);
  const body = rows.map((item) => {
    const value = Number(item?.[valueKey] || 0);
    return `<div class="tv-row-bar">
      <div class="tv-row-label"><span>${escapeHtml(item.name || item.label || 'Unassigned')}</span><strong>${fmt(value, unit)}</strong></div>
      <div class="tv-row-track"><span style="width:${Math.max((value / max) * 100, 3)}%"></span></div>
    </div>`;
  }).join('');
  return `<article class="tv-chart-card"><header><h3>${escapeHtml(title)}</h3></header><div class="tv-row-bars">${body}</div></article>`;
}

function observationTrend(items) {
  if (!hasAny(items, ['nearMiss', 'unsafeCondition', 'total'])) return emptyChart('Near Miss / Unsafe Trend');
  const max = Math.max(...items.map((item) => Number(item?.total || 0)), 1);
  const bars = items.map((item) => {
    const unsafe = Number(item?.unsafeCondition || 0);
    const nearMiss = Number(item?.nearMiss || 0);
    const total = Number(item?.total || 0);
    const unsafeHeight = total > 0 ? (unsafe / max) * 100 : 0;
    const nearMissHeight = total > 0 ? (nearMiss / max) * 100 : 0;
    return `<div class="tv-bar-column">
      <strong>${fmt(total)}</strong>
      <div class="tv-bar-track stacked"><span class="unsafe" style="height:${unsafeHeight}%"></span><span class="near" style="height:${nearMissHeight}%"></span></div>
      <small>${escapeHtml(item.label || '')}</small>
    </div>`;
  }).join('');
  return `<article class="tv-chart-card"><header><h3>Near Miss / Unsafe Trend</h3><p>Unsafe and near miss observations</p></header><div class="tv-bars">${bars}</div></article>`;
}

function workingHoursAfr(items) {
  if (!hasAny(items, ['workingHours', 'afr'])) return emptyChart('Working Hours / AFR');
  const maxHours = Math.max(...items.map((item) => Number(item?.workingHours || 0)), 1);
  const maxAfr = Math.max(...items.map((item) => Number(item?.afr || 0)), 1);
  const bars = items.map((item) => {
    const hours = Number(item?.workingHours || 0);
    const afr = Number(item?.afr || 0);
    return `<div class="tv-bar-column combo">
      <strong>${fmt(hours)}</strong>
      <div class="tv-bar-track"><span style="height:${Math.max((hours / maxHours) * 100, hours > 0 ? 4 : 0)}%"></span></div>
      <em style="bottom:${33 + Math.max((afr / maxAfr) * 62, afr > 0 ? 8 : 0)}%"></em>
      <small>${escapeHtml(item.label || '')}</small>
    </div>`;
  }).join('');
  return `<article class="tv-chart-card"><header><h3>Working Hours / AFR</h3><p>Bars show hours, markers show AFR</p></header><div class="tv-bars combo-bars">${bars}</div></article>`;
}

function renderChartPage() {
  const grid = document.getElementById('tvCharts');
  if (!grid) return;
  if (!chartPages.length) {
    grid.innerHTML = emptyChart('HSE Analytics');
    setText('chartCounter', 'Charts 0 / 0');
    return;
  }
  currentChartPage = currentChartPage % chartPages.length;
  grid.innerHTML = chartPages[currentChartPage].join('');
  setText('chartCounter', `Charts ${currentChartPage + 1} / ${chartPages.length}`);
}

function renderCharts(charts) {
  const monthlyTrend = charts?.monthlyTrend || [];
  const departmentSummary = charts?.departmentAccidentSummary || charts?.departmentSummary || charts?.byDepartment || [];
  const rootCauseSummary = charts?.rootCauseSummary || charts?.byRootCause || [];
  const medicalExpenseTrend = charts?.medicalExpenseTrend || monthlyTrend;
  const correctiveActionStatus = charts?.correctiveActionStatus || charts?.byActionStatus || [];
  const nearMissUnsafeTrend = charts?.nearMissUnsafeTrend || [];
  const nearMissUnsafeBreakdown = charts?.nearMissUnsafeBreakdown || [];
  const workingHoursTrend = charts?.workingHoursTrend || [];
  const departmentLostHours = charts?.departmentLostHours || departmentSummary;

  const cards = [
    verticalBars('Monthly Accident Trend', monthlyTrend, 'incidents'),
    horizontalBars('Department Accident Summary', departmentSummary, 'count'),
    horizontalBars('Root Cause Summary', rootCauseSummary, 'count'),
    verticalBars('Medical Expense Trend', medicalExpenseTrend, 'medicalExpense', 'LKR'),
    horizontalBars('Corrective Action Status', correctiveActionStatus, 'count'),
    observationTrend(nearMissUnsafeTrend),
    horizontalBars('Near Miss / Unsafe Count', nearMissUnsafeBreakdown, 'count'),
    horizontalBars('Department Lost Hours', departmentLostHours, 'lostHours', 'h'),
    workingHoursAfr(workingHoursTrend),
  ];
  chartPages = chunk(cards, 4);
  renderChartPage();
}

async function loadDashboard() {
  try {
    const res = await fetch('/api/tv/public', { cache: 'no-store' });
    const data = await res.json();
    settings = data.settings || settings;
    slides = data.slides || [];
    const officialCompanyName = 'LAUGFS Corporation (Rubber) Limited';
    const businessUnitName = 'LAUGFS Rubber / LAUGFS Industrial Tyres';
    const companyName = !settings.companyName || ['HSE', 'HSE Company', 'LAUGFS Rubber'].includes(settings.companyName) ? officialCompanyName : settings.companyName;
    const dashboardTitle = !settings.dashboardTitle || settings.dashboardTitle === 'HSE Dashboard' ? 'Live HSE Dashboard' : settings.dashboardTitle;
    setText('businessUnitName', businessUnitName);
    setText('companyName', companyName);
    setText('dashboardTitle', dashboardTitle);
    setText('generatedAt', `Updated ${new Date(data.generatedAt).toLocaleString()}`);
    renderKpis(data.dashboard?.kpis || {});
    renderCharts(data.dashboard?.charts || {});
    renderSlide();
  } catch (error) {
    console.error(error);
    setText('slideSubtitle', 'Connection issue');
    setText('slideTitle', 'Waiting for HSE server');
  }
}

if (fullscreenButton) fullscreenButton.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => updateFullscreenUi());
document.addEventListener('keydown', (event) => {
  const target = event.target;
  const tagName = target && target.tagName ? target.tagName.toLowerCase() : '';
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable) return;
  if (event.key && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    toggleFullscreen();
  }
});

setInterval(updateClock, 1000);
setInterval(loadDashboard, 30000);

let lastAdvance = Date.now();
setInterval(() => {
  const intervalMs = Math.max(Number(settings.intervalSeconds || 12), 5) * 1000;
  if (!settings.autoAdvance || Date.now() - lastAdvance < intervalMs) return;
  if (slides.length) current = (current + 1) % slides.length;
  if (chartPages.length) currentChartPage = (currentChartPage + 1) % chartPages.length;
  lastAdvance = Date.now();
  renderSlide();
  renderChartPage();
}, 1000);

updateFullscreenUi();
updateClock();
loadDashboard();
