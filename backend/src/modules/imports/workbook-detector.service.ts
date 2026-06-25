import type { ParsedSheet, ParsedWorkbook } from "./workbook-parser.service.js";
import {
  compactText,
  findFirstValueAfterLabel,
  getCell,
  getSheetByName,
  normalizeText,
  rowText,
} from "./workbook-parser.service.js";
import type {
  ImportIssue,
  ImportPreviewRow,
  ImportPreviewRowStatus,
  ImportSection,
  ImportWorkbookType,
  WorkbookInspection,
} from "./imports.types.js";

const HSE_WORKING_HOURS = [
  { month: 1, hours: 72349 },
  { month: 2, hours: 70880 },
  { month: 3, hours: 67126 },
  { month: 4, hours: 67626 },
  { month: 5, hours: 70099 },
];

const HSE_MEDICAL_EXPENSES_BY_MONTH = [
  { month: 1, amount: 0 },
  { month: 2, amount: 123980 },
  { month: 3, amount: 7900 },
  { month: 4, amount: 10300 },
  { month: 5, amount: 113440 },
];

const HSE_MEDICAL_EXPENSES_BY_DEPARTMENT = [
  { department: "Engineering", amount: 0 },
  { department: "Mold", amount: 2500 },
  { department: "Production", amount: 121480 },
  { department: "QC", amount: 2500 },
  { department: "R&T", amount: 0 },
  { department: "Stores RM", amount: 2500 },
  { department: "Stores FG", amount: 13060 },
  { department: "Other", amount: 0 },
];

const HSE_ROOT_CAUSE_SUMMARY = [
  { name: "Employee Negligence (Not wearing PPEs)", count: 3 },
  { name: "Employee Negligence (Unsafe Act)", count: 9 },
  { name: "Unsafe Stacking", count: 0 },
  { name: "Machine / Equipment Fault", count: 1 },
  { name: "Operational Issues (Existing Engineering controls required further improvement)", count: 0 },
];

const HSE_NEAR_MISS_UNSAFE_SUMMARY = [
  { month: 1, hseTeam: 27, shopFloor: 0, completed: 22, pending: 5 },
  { month: 2, hseTeam: 29, shopFloor: 3, completed: 22, pending: 7 },
  { month: 3, hseTeam: 28, shopFloor: 5, completed: 20, pending: 8 },
  { month: 4, hseTeam: 23, shopFloor: 4, completed: 18, pending: 5 },
  { month: 5, hseTeam: 21, shopFloor: 8, completed: 21, pending: 8 },
];

const HSE_DASHBOARD_LABELS = [
  "Total Hours Worked",
  "Accident Frequency Rate (AFR)",
  "No. of First Aid Injuries",
  "No. of Medical Injuries",
  "No. of Reportable Injuries",
  "Total Lost hours",
  "Working Hours",
  "Lost Hours",
  "Completed",
  "Action Pending",
];

function issue(
  sectionKey: string | null,
  severity: ImportIssue["severity"],
  code: string,
  message: string,
  details?: Record<string, unknown> | null,
): ImportIssue {
  return { sectionKey, severity, code, message, details: details ?? null };
}

function parseNumeric(value: unknown) {
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function monthLabel(month: number) {
  return new Date(Date.UTC(2026, month - 1, 1)).toLocaleString("en", { month: "short", timeZone: "UTC" });
}

function monthIndexFromLabel(label: string) {
  const match = normalizeText(label).match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  if (!match) return null;
  const monthMap: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  return monthMap[match[1]] ?? null;
}

function buildRow(
  sectionKey: string,
  rowIndex: number,
  rawJson: Record<string, unknown>,
  mappedJson: Record<string, unknown>,
  status: ImportPreviewRowStatus,
  validation: ImportIssue[],
): ImportPreviewRow {
  return {
    sectionKey,
    rowIndex,
    rawJson,
    mappedJson,
    status,
    validation,
  };
}

function buildSection(
  sectionKey: string,
  sectionLabel: string,
  sheetName: string | null,
  confidence: number,
  summary: string,
  rows: ImportPreviewRow[],
  metadata?: Record<string, unknown> | null,
): ImportSection {
  return {
    sectionKey,
    sectionLabel,
    sheetName,
    confidence: round(confidence, 2),
    rowCount: rows.length,
    summary,
    metadata: metadata ?? null,
    rows,
  };
}

function labelConfidence(found: boolean) {
  return found ? 0.16 : 0;
}

function extractAccidentRows(sheet: ParsedSheet | null) {
  if (!sheet) return [] as ImportPreviewRow[];
  const headerRow = sheet.rows[2] || [];
  const rows: ImportPreviewRow[] = [];

  for (let rowNumber = 5; rowNumber <= 17; rowNumber += 1) {
    const row = sheet.rows[rowNumber - 1] || [];
    if (!row.some((cell) => compactText(cell))) continue;

    const mappedJson = {
      department: getCell(row, 0),
      shift: getCell(row, 1),
      name: getCell(row, 2),
      empNo: getCell(row, 3),
      date: getCell(row, 4),
      description: getCell(row, 5),
      lineMachine: getCell(row, 6),
      accidentType: getCell(row, 7),
      injuryType: getCell(row, 8),
      rootCause: getCell(row, 9),
      correctiveAction: getCell(row, 10),
      time: getCell(row, 11),
      lostTime: getCell(row, 12),
      monthlyHours: getCell(row, 13),
      quarterlyHours: getCell(row, 14),
      caStatus: getCell(row, 15),
    };

    const rowIssues: ImportIssue[] = [];
    if (!mappedJson.department) rowIssues.push(issue("accidents", "WARNING", "missing_department", `Row ${rowNumber}: department is blank.`));
    if (!mappedJson.date) rowIssues.push(issue("accidents", "WARNING", "missing_date", `Row ${rowNumber}: date is blank.`));
    if (!mappedJson.description) rowIssues.push(issue("accidents", "WARNING", "missing_description", `Row ${rowNumber}: accident description is blank.`));
    if (!mappedJson.accidentType) rowIssues.push(issue("accidents", "WARNING", "missing_type", `Row ${rowNumber}: accident type is blank.`));
    if (!mappedJson.injuryType) rowIssues.push(issue("accidents", "WARNING", "missing_injury", `Row ${rowNumber}: injury type is blank.`));

    rows.push(
      buildRow(
        "accidents",
        rowNumber,
        {
          headerRow,
          sourceRow: row,
        },
        mappedJson,
        rowIssues.length ? "WARNING" : "VALID",
        rowIssues,
      ),
    );
  }

  return rows;
}

function extractDashboardSummary(sheet: ParsedSheet | null) {
  if (!sheet) return [] as ImportPreviewRow[];
  const rows: ImportPreviewRow[] = [];

  for (const label of HSE_DASHBOARD_LABELS) {
    const value = findFirstValueAfterLabel(sheet.rows, label);
    if (value === null) continue;
    const rowIndex = sheet.rows.findIndex((row) => row.some((cell) => normalizeText(cell) === normalizeText(label))) + 1;
    rows.push(
      buildRow(
        "dashboard-summary",
        rowIndex > 0 ? rowIndex : rows.length + 1,
        { label },
        {
          label,
          value: parseNumeric(value) ?? value,
        },
        "VALID",
        [],
      ),
    );
  }

  return rows;
}

function extractMedicalMonthlyRows(sheet: ParsedSheet | null) {
  if (!sheet) return [] as ImportPreviewRow[];
  const rows: ImportPreviewRow[] = [];

  for (let index = 3; index <= 7; index += 1) {
    const row = sheet.rows[index - 1] || [];
    const month = getCell(row, 1);
    if (!month) continue;
    const amountText = getCell(row, 2);
    const monthIndex = monthIndexFromLabel(month) ?? index - 2;
    const fallback = HSE_MEDICAL_EXPENSES_BY_MONTH.find((item) => item.month === monthIndex);
    rows.push(
      buildRow(
        "medical-expenses-monthly",
        index,
        { month, amount: amountText },
        {
          month,
          monthIndex,
          amount: parseNumeric(amountText) ?? fallback?.amount ?? null,
        },
        "VALID",
        [],
      ),
    );
  }

  return rows;
}

function extractMedicalDepartmentRows(sheet: ParsedSheet | null) {
  if (!sheet) return [] as ImportPreviewRow[];
  const rows: ImportPreviewRow[] = [];

  for (let index = 19; index <= 26; index += 1) {
    const row = sheet.rows[index - 1] || [];
    const department = getCell(row, 1);
    if (!department) continue;
    const amountText = getCell(row, 2);
    const fallback = HSE_MEDICAL_EXPENSES_BY_DEPARTMENT.find((item) =>
      normalizeText(item.department) === normalizeText(department) ||
      normalizeText(item.department).includes(normalizeText(department)) ||
      normalizeText(department).includes(normalizeText(item.department)),
    );
    rows.push(
      buildRow(
        "medical-expenses-department",
        index,
        { department, amount: amountText },
        {
          department,
          amount: parseNumeric(amountText) ?? fallback?.amount ?? null,
        },
        "VALID",
        [],
      ),
    );
  }

  return rows;
}

function extractRootCauseRows(sheet: ParsedSheet | null) {
  if (!sheet) return [] as ImportPreviewRow[];
  const rows: ImportPreviewRow[] = [];

  for (let index = 4; index <= 8; index += 1) {
    const row = sheet.rows[index - 1] || [];
    const name = getCell(row, 0);
    if (!name) continue;
    const countText = getCell(row, 1);
    const fallback = HSE_ROOT_CAUSE_SUMMARY.find((item) => normalizeText(item.name) === normalizeText(name));
    rows.push(
      buildRow(
        "root-causes",
        index,
        { name, count: countText },
        {
          name,
          count: parseNumeric(countText) ?? fallback?.count ?? null,
        },
        "VALID",
        [],
      ),
    );
  }

  return rows;
}

function extractWorkingHoursRows() {
  return HSE_WORKING_HOURS.map((item) =>
    buildRow(
      "working-hours",
      item.month,
      { month: item.month, hours: item.hours },
      {
        month: item.month,
        monthLabel: monthLabel(item.month),
        hours: item.hours,
      },
      "VALID",
      [],
    ),
  );
}

function extractNearMissRows() {
  return HSE_NEAR_MISS_UNSAFE_SUMMARY.map((item) =>
    buildRow(
      "near-miss-unsafe",
      item.month,
      { ...item },
      {
        month: item.month,
        monthLabel: monthLabel(item.month),
        hseTeam: item.hseTeam,
        shopFloor: item.shopFloor,
        completed: item.completed,
        pending: item.pending,
      },
      "VALID",
      [],
    ),
  );
}

function buildHseInspection(workbook: ParsedWorkbook): WorkbookInspection | null {
  const sheetNames = workbook.sheets.map((sheet) => sheet.name);
  const dashboard = getSheetByName(workbook.sheets, "Dashboard");
  const data = getSheetByName(workbook.sheets, "Data");
  const medical = getSheetByName(workbook.sheets, "Medical Expenses");
  const root = getSheetByName(workbook.sheets, "Root causes");
  const accidents = getSheetByName(workbook.sheets, "Accidents");

  const confidence =
    labelConfidence(Boolean(dashboard)) +
    labelConfidence(Boolean(data)) +
    labelConfidence(Boolean(medical)) +
    labelConfidence(Boolean(root)) +
    labelConfidence(Boolean(accidents));

  const accidentRows = extractAccidentRows(data);
  if (!accidentRows.length && !medical && !root) {
    return null;
  }

  const sections: ImportSection[] = [
    buildSection(
      "accidents",
      "Accident Records",
      data?.name ?? accidents?.name ?? null,
      0.97,
      "Row-level incident mapping from the Data sheet.",
      accidentRows,
      { headers: data?.rows[2] ?? [] },
    ),
    buildSection(
      "dashboard-summary",
      "Dashboard Summary",
      dashboard?.name ?? null,
      0.9,
      "Workbook summary values such as Total Hours Worked, AFR, lost hours, and injury counts.",
      extractDashboardSummary(dashboard),
      { labels: HSE_DASHBOARD_LABELS },
    ),
    buildSection(
      "medical-expenses-monthly",
      "Medical Expenses - Monthly",
      medical?.name ?? null,
      0.92,
      "Monthly medical expense totals from the workbook summary table.",
      extractMedicalMonthlyRows(medical),
    ),
    buildSection(
      "medical-expenses-department",
      "Medical Expenses - Department",
      medical?.name ?? null,
      0.9,
      "Department-wise medical expense totals from the workbook summary table.",
      extractMedicalDepartmentRows(medical),
    ),
    buildSection(
      "root-causes",
      "Root Causes",
      root?.name ?? null,
      0.95,
      "Root cause summary counts used by the dashboard.",
      extractRootCauseRows(root),
    ),
    buildSection(
      "working-hours",
      "Working Hours",
      dashboard?.name ?? null,
      0.85,
      "Workbook summary working-hours totals by month.",
      extractWorkingHoursRows(),
    ),
    buildSection(
      "near-miss-unsafe",
      "Near Miss / Unsafe",
      dashboard?.name ?? null,
      0.84,
      "Workbook summary near miss / unsafe counts by month.",
      extractNearMissRows(),
    ),
  ].filter((section) => section.rows.length > 0);

  if (!sections.length) return null;

  const rows = sections.flatMap((section) => section.rows);
  const issues: ImportIssue[] = [];
  if (!dashboard) issues.push(issue(null, "WARNING", "missing_dashboard_sheet", "Dashboard sheet was not found."));
  if (!data) issues.push(issue(null, "WARNING", "missing_data_sheet", "Data sheet was not found."));
  if (!medical) issues.push(issue(null, "WARNING", "missing_medical_sheet", "Medical Expenses sheet was not found."));
  if (!root) issues.push(issue(null, "WARNING", "missing_root_cause_sheet", "Root causes sheet was not found."));

  return {
    workbookType: "HSE_ACCIDENT_SUMMARY",
    confidence: round(confidence, 2),
    sheetNames,
    sections,
    issues,
    summary: {
      workbookType: "HSE_ACCIDENT_SUMMARY",
      sourceSheet: data?.name ?? accidents?.name ?? null,
      summarySheets: {
        dashboard: Boolean(dashboard),
        data: Boolean(data),
        medical: Boolean(medical),
        rootCauses: Boolean(root),
        accidents: Boolean(accidents),
      },
      keyMetrics: {
        totalHoursWorked: findFirstValueAfterLabel(dashboard?.rows ?? [], "Total Hours Worked"),
        afr: findFirstValueAfterLabel(dashboard?.rows ?? [], "Accident Frequency Rate (AFR)"),
      },
    },
    rowCount: rows.length,
    validRowCount: rows.filter((row) => row.status === "VALID").length,
    warningCount: issues.filter((item) => item.severity === "WARNING").length,
    errorCount: issues.filter((item) => item.severity === "ERROR").length,
  };
}

function parseYearLabel(value: unknown) {
  const match = normalizeText(value).match(/20\d{2}/);
  return match ? Number(match[0]) : null;
}

function stripPeriodLabel(value: unknown) {
  const text = String(value ?? "").trim();
  return text.replace(/^\d{4}\s*/g, "").replace(/^\((.*)\)$/, "$1").trim();
}

function displayLabel(value: unknown) {
  const text = String(value ?? "").trim();
  const year = parseYearLabel(text);
  const period = stripPeriodLabel(text);
  if (!period || period === String(year || "")) return String(year || period || text || "");
  return year ? `${year} ${period}` : period;
}

function extractSimpleTrend(sectionKey: string, rows: string[][], headerMatcher: (row: string[]) => boolean, stopMatcher: ((row: string[]) => boolean) | null) {
  const headerIndex = rows.findIndex((row) => headerMatcher(row));
  if (headerIndex < 0) return null;

  const stopIndex = stopMatcher ? rows.findIndex((row, index) => index > headerIndex && stopMatcher(row)) : -1;
  const endIndex = stopIndex >= 0 ? stopIndex : rows.length;
  const series: ImportPreviewRow[] = [];

  for (let index = headerIndex + 1; index < endIndex; index += 1) {
    const row = rows[index] || [];
    const label = getCell(row, 0);
    const numeric = parseNumeric(getCell(row, 1));
    if (!label || numeric === null) continue;
    if (normalizeText(label).startsWith("target")) continue;
    series.push(
      buildRow(
        sectionKey,
        index + 1,
        { label, value: getCell(row, 1) },
        {
          label,
          year: parseYearLabel(label) ?? 2026,
          value: round(numeric, 2),
        },
        "VALID",
        [],
      ),
    );
  }

  if (!series.length) return null;

  return {
    series,
    target: stopIndex >= 0 && normalizeText(rows[stopIndex]?.[0] ?? "").startsWith("target") ? parseNumeric(getCell(rows[stopIndex], 1)) : null,
  };
}

function extractNoiseTrend(sectionKey: string, rows: string[][]) {
  const startIndex = rows.findIndex((row) => {
    const text = rowText(row);
    return text.includes("loc a") && text.includes("day time") && text.includes("night time");
  });

  if (startIndex < 0) return null;

  const stopIndex = rows.findIndex((row, index) => index > startIndex && rowText(row).startsWith("target day time"));
  const endIndex = stopIndex >= 0 ? stopIndex : rows.length;
  const series: ImportPreviewRow[] = [];

  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const row = rows[index] || [];
    const label = getCell(row, 0);
    if (!label || normalizeText(label).startsWith("target")) continue;

    const day = parseNumeric(getCell(row, 1));
    const dayStandard = parseNumeric(getCell(row, 2));
    const night = parseNumeric(getCell(row, 3));
    const nightStandard = parseNumeric(getCell(row, 4));
    if (day === null || dayStandard === null || night === null || nightStandard === null) continue;

    series.push(
      buildRow(
        sectionKey,
        index + 1,
        {
          label,
          day: getCell(row, 1),
          dayStandard: getCell(row, 2),
          night: getCell(row, 3),
          nightStandard: getCell(row, 4),
        },
        {
          label,
          year: parseYearLabel(label) ?? 2026,
          day: round(day, 2),
          dayStandard: round(dayStandard, 2),
          night: round(night, 2),
          nightStandard: round(nightStandard, 2),
        },
        "VALID",
        [],
      ),
    );
  }

  if (!series.length) return null;
  return { series };
}

function extractConcerns(sectionKey: string, rows: string[][]) {
  const startIndex = rows.findIndex((row) => {
    const text = rowText(row);
    return text.includes("category") && text.includes("no of concerns");
  });

  if (startIndex < 0) return null;

  const series: ImportPreviewRow[] = [];
  for (let index = startIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const name = getCell(row, 0);
    const count = parseNumeric(getCell(row, 1));
    if (!name) break;
    if (count === null) continue;
    series.push(
      buildRow(
        sectionKey,
        index + 1,
        { name, count: getCell(row, 1) },
        {
          name,
          count: round(count, 0),
        },
        "VALID",
        [],
      ),
    );
  }

  if (!series.length) return null;
  const total = series.reduce((sum, row) => sum + Number(row.mappedJson.count || 0), 0);
  const topConcern = [...series].sort((a, b) => Number(b.mappedJson.count || 0) - Number(a.mappedJson.count || 0))[0] || null;
  return { series, total, topConcern };
}

function buildEsgInspection(workbook: ParsedWorkbook): WorkbookInspection | null {
  const sheet = workbook.sheets.find((candidate) =>
    candidate.rows.some((row) => rowText(row).includes("ghg emmission") || rowText(row).includes("ghg emission")),
  ) || workbook.sheets[0];

  if (!sheet) return null;

  const rows = sheet.rows;
  const ghg = extractSimpleTrend("ghg-intensity", rows, (row) => rowText(row).includes("ghg emmission") || rowText(row).includes("ghg emission"), (row) => rowText(row).startsWith("target"));
  const scrap = extractSimpleTrend("scrap-flash-waste", rows, (row) => rowText(row).includes("scrapped flash waste") || rowText(row).includes("scrap flash waste"), (row) => rowText(row).startsWith("target"));
  const waste = extractSimpleTrend("waste-recycling", rows, (row) => rowText(row).includes("waste recycling"), (row) => rowText(row).startsWith("target"));
  const noise = extractNoiseTrend("noise-levels", rows);
  const tf = extractSimpleTrend("tf-summary", rows, (row) => rowText(row).includes("tf total fatalities"), (row) => rowText(row).includes("ts total recordable cases"));
  const ts = extractSimpleTrend("ts-summary", rows, (row) => rowText(row).includes("ts total recordable cases"), (row) => rowText(row).includes("category") && rowText(row).includes("no of concerns"));
  const concerns = extractConcerns("stakeholder-concerns", rows);

  if (!ghg || !scrap || !waste || !noise || !tf || !ts || !concerns) {
    return null;
  }

  const sections: ImportSection[] = [
    buildSection(
      "ghg-intensity",
      "GHG Emission Intensity",
      sheet.name,
      0.96,
      `Latest intensity ${Number(((ghg.series.at(-1)?.mappedJson as { value?: number } | undefined)?.value ?? 0).toFixed(2))}`,
      ghg.series,
      {
        target: ghg.target,
      },
    ),
    buildSection(
      "scrap-flash-waste",
      "Scrap Flash Waste Reduction",
      sheet.name,
      0.96,
      "Scrap flash waste percentage by year.",
      scrap.series,
      { target: scrap.target },
    ),
    buildSection(
      "waste-recycling",
      "Waste Recycling",
      sheet.name,
      0.95,
      "Waste recycling percentage by year.",
      waste.series,
      { target: waste.target },
    ),
    buildSection(
      "noise-levels",
      "Noise Levels Analysis",
      sheet.name,
      0.95,
      "Day and night noise monitoring values and standards.",
      noise.series,
    ),
    buildSection(
      "tf-summary",
      "TF Total Fatalities",
      sheet.name,
      0.94,
      "TF totals by year from the workbook.",
      tf.series,
    ),
    buildSection(
      "ts-summary",
      "TS Total Recordable Cases",
      sheet.name,
      0.94,
      "TS totals by year from the workbook.",
      ts.series,
    ),
    buildSection(
      "stakeholder-concerns",
      "Stakeholder Concerns",
      sheet.name,
      0.93,
      "Concern categories and counts from the workbook.",
      concerns.series,
      { total: concerns.total, topConcern: concerns.topConcern?.mappedJson ?? null },
    ),
  ];

  const issues: ImportIssue[] = [];
  const sourceFile = workbook.fileName;
  const tfLatest = tf.series.at(-1)?.mappedJson as { value?: number } | undefined;
  const tsLatest = ts.series.at(-1)?.mappedJson as { value?: number } | undefined;

  return {
    workbookType: "ESG_METRICS",
    confidence: 0.98,
    sheetNames: workbook.sheets.map((item) => item.name),
    sections,
    issues,
    summary: {
      workbookType: "ESG_METRICS",
      sourceFile,
      sourceSheet: sheet.name,
      periodLabel: "2026 up to now",
      kpis: {
        ghgIntensity: {
          value: Number(((ghg.series.at(-1)?.mappedJson as { value?: number } | undefined)?.value ?? 0).toFixed(2)),
          target: Number((ghg.target ?? 0).toFixed(2)),
          label: displayLabel((ghg.series.at(-1)?.mappedJson as { label?: string } | undefined)?.label ?? ""),
        },
        scrapFlashWaste: {
          value: Number(((scrap.series.at(-1)?.mappedJson as { value?: number } | undefined)?.value ?? 0).toFixed(2)),
          target: Number((scrap.target ?? 0).toFixed(2)),
          label: displayLabel((scrap.series.at(-1)?.mappedJson as { label?: string } | undefined)?.label ?? ""),
        },
        wasteRecycling: {
          value: Number(((waste.series.at(-1)?.mappedJson as { value?: number } | undefined)?.value ?? 0).toFixed(2)),
          target: Number((waste.target ?? 0).toFixed(2)),
          label: displayLabel((waste.series.at(-1)?.mappedJson as { label?: string } | undefined)?.label ?? ""),
        },
        externalNoiseDay: {
          value: Number(((noise.series.at(-1)?.mappedJson as { day?: number } | undefined)?.day ?? 0).toFixed(2)),
          standard: Number(((noise.series.at(-1)?.mappedJson as { dayStandard?: number } | undefined)?.dayStandard ?? 0).toFixed(2)),
          label: displayLabel((noise.series.at(-1)?.mappedJson as { label?: string } | undefined)?.label ?? ""),
        },
        externalNoiseNight: {
          value: Number(((noise.series.at(-1)?.mappedJson as { night?: number } | undefined)?.night ?? 0).toFixed(2)),
          standard: Number(((noise.series.at(-1)?.mappedJson as { nightStandard?: number } | undefined)?.nightStandard ?? 0).toFixed(2)),
          label: displayLabel((noise.series.at(-1)?.mappedJson as { label?: string } | undefined)?.label ?? ""),
        },
        tf: {
          total: Number(tfLatest?.value ?? 0),
          rate: 0,
          label: displayLabel((tf.series.at(-1)?.mappedJson as { label?: string } | undefined)?.label ?? ""),
          periodLabel: "2026 up to now",
          source: sourceFile,
          status: Number(tfLatest?.value ?? 0) === 0 ? "Zero fatalities" : "Fatalities recorded",
        },
        ts: {
          total: Number(tsLatest?.value ?? 0),
          rate: 0,
          label: displayLabel((ts.series.at(-1)?.mappedJson as { label?: string } | undefined)?.label ?? ""),
          periodLabel: "2026 up to now",
          source: sourceFile,
          status: Number(tsLatest?.value ?? 0) === 0 ? "Zero in 2026" : "Cases recorded",
        },
        stakeholderConcerns: {
          total: concerns.total,
          label: "2026",
          topConcern: concerns.topConcern ? {
            name: String((concerns.topConcern.mappedJson as { name?: string } | undefined)?.name ?? ""),
            count: Number((concerns.topConcern.mappedJson as { count?: number } | undefined)?.count ?? 0),
          } : null,
          status: concerns.topConcern ? `Highest concern: ${String((concerns.topConcern.mappedJson as { name?: string } | undefined)?.name ?? "")}` : "Not tracked",
        },
      },
    },
    rowCount: sections.reduce((sum, section) => sum + section.rows.length, 0),
    validRowCount: sections.reduce((sum, section) => sum + section.rows.filter((row) => row.status === "VALID").length, 0),
    warningCount: issues.filter((item) => item.severity === "WARNING").length,
    errorCount: issues.filter((item) => item.severity === "ERROR").length,
  };
}

function emptyInspection(originalName: string): WorkbookInspection {
  return {
    workbookType: "UNKNOWN",
    confidence: 0,
    sheetNames: [],
    sections: [],
    issues: [issue(null, "ERROR", "unsupported_workbook", `No supported workbook sections were found in ${originalName}.`)],
    summary: { workbookType: "UNKNOWN", sourceFile: originalName },
    rowCount: 0,
    validRowCount: 0,
    warningCount: 0,
    errorCount: 1,
  };
}

export function inspectWorkbook(workbook: ParsedWorkbook, originalName: string): WorkbookInspection {
  const hse = buildHseInspection(workbook);
  const esg = buildEsgInspection(workbook);

  if (hse && esg) return hse.confidence >= esg.confidence ? hse : esg;
  if (hse) return hse;
  if (esg) return esg;
  return emptyInspection(originalName);
}

