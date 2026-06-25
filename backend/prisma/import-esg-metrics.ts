import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const repoDir = path.resolve(backendDir, "..");

dotenv.config({ path: path.join(backendDir, ".env") });

const prisma = new PrismaClient();
const YEAR = 2026;
const PERIOD_LABEL = `${YEAR} up to now`;
const SOURCE_FALLBACKS = ["ESG Matrics.xlsx", "ESG Metrics.xlsx"];

type TfTsRecord = {
  tfTotal: number;
  tfRate: number;
  tsTotal: number;
  tsRate: number;
  source: string;
  periodLabel: string;
  sheetName: string;
};

type ParsedSheet = {
  name: string;
  rows: string[][];
};

type EsgTrendPoint = {
  label: string;
  year: number;
  value: number;
};

type EsgNoisePoint = {
  label: string;
  year: number;
  day: number;
  dayStandard: number;
  night: number;
  nightStandard: number;
};

type EsgConcernPoint = {
  name: string;
  count: number;
};

type EsgDashboardPayload = {
  year: number;
  sourceFile: string;
  sourcePath: string;
  sourceSheet: string;
  periodLabel: string;
  tracked: boolean;
  importedAt: string;
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

type MetricKey = keyof Pick<TfTsRecord, "tfTotal" | "tfRate" | "tsTotal" | "tsRate">;

const METRIC_KEYS: MetricKey[] = ["tfTotal", "tfRate", "tsTotal", "tsRate"];
const METRIC_LABELS: Record<MetricKey, RegExp[]> = {
  tfTotal: [/^tf\s*total$/i, /^tf$/i, /frequency\s*total/i, /fatalit/i],
  tfRate: [/^tf\s*rate$/i, /frequency\s*rate/i],
  tsTotal: [/^ts\s*total$/i, /^ts$/i, /severity\s*total/i, /recordable\s*cases?/i],
  tsRate: [/^ts\s*rate$/i, /severity\s*rate/i],
};

function quotePs(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function fail(message: string): never {
  throw new Error(message);
}

function resolveWorkbookPath() {
  const explicit = process.env.IMPORT_WORKBOOK_PATH?.trim() || process.env.ESG_METRICS_WORKBOOK?.trim();
  const candidates = [
    explicit,
    ...SOURCE_FALLBACKS.flatMap((fileName) => [
      path.resolve(repoDir, fileName),
      path.resolve(repoDir, "data", fileName),
      path.resolve(repoDir, "deta", fileName),
      path.resolve(backendDir, fileName),
      path.resolve(backendDir, "data", fileName),
      path.resolve(backendDir, "deta", fileName),
    ]),
  ].filter((item): item is string => Boolean(item));

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    fail(`Workbook not found. Checked:\n${candidates.map((candidate) => `- ${candidate}`).join("\n")}`);
  }
  return found;
}

function extractWorkbookZip(workbookPath: string) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "esg-metrics-"));
  const tempZipPath = path.join(tempDir, "workbook.zip");
  const extractDir = path.join(tempDir, "extracted");

  fs.mkdirSync(extractDir, { recursive: true });
  fs.copyFileSync(workbookPath, tempZipPath);

  const command = `Expand-Archive -LiteralPath ${quotePs(tempZipPath)} -DestinationPath ${quotePs(extractDir)} -Force`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.status !== 0) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fail(`Failed to extract workbook ${workbookPath}`);
  }

  return extractDir;
}

function decodeXml(text: string) {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function readXml(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

function getAttributes(tagText: string) {
  const attributes: Record<string, string> = {};
  for (const match of tagText.matchAll(/([A-Za-z0-9_:.-]+)="([^"]*)"/g)) {
    attributes[match[1]] = decodeXml(match[2]);
  }
  return attributes;
}

function extractXmlText(fragment: string) {
  const textParts = Array.from(fragment.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((match) => match[1]);
  if (textParts.length) return decodeXml(textParts.join(""));
  const value = fragment.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  return decodeXml(value);
}

function columnIndexFromRef(ref: string) {
  const letters = ref.match(/[A-Z]+/)?.[0] || "";
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeComparableText(value: unknown) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function matchesTargetYearCell(value: unknown) {
  const text = normalizeComparableText(value);
  return text.includes(String(YEAR)) && text.includes("up to now");
}

function parseSharedStrings(xml: string) {
  return Array.from(xml.matchAll(/<si\b[\s\S]*?<\/si>/g)).map((match) => extractXmlText(match[0]));
}

function parseWorkbookSheets(xml: string) {
  const sheets: { name: string; relId: string }[] = [];
  for (const match of xml.matchAll(/<sheet\b([^>]*)\/?>(?:\s*)/g)) {
    const attrs = getAttributes(match[1]);
    const name = attrs.name;
    const relId = attrs["r:id"];
    if (name && relId) sheets.push({ name, relId });
  }
  return sheets;
}

function parseWorkbookRelationships(xml: string) {
  const relationships = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/?>(?:\s*)/g)) {
    const attrs = getAttributes(match[1]);
    const id = attrs.Id;
    const target = attrs.Target;
    if (id && target) relationships.set(id, target.replace(/^\//, ""));
  }
  return relationships;
}

function parseSheetRows(sheetXml: string, sharedStrings: string[]) {
  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowIndex = Number(rowMatch[1]) - 1;
    const rowBody = rowMatch[2];
    const row: string[] = [];

    for (const cellMatch of rowBody.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = getAttributes(cellMatch[1]);
      const ref = attrs.r || "";
      const type = attrs.t || "";
      const columnIndex = columnIndexFromRef(ref);
      let value = "";

      if (type === "s") {
        const sharedIndex = Number(extractXmlText(cellMatch[2]));
        value = sharedStrings[sharedIndex] ?? "";
      } else if (type === "inlineStr") {
        value = extractXmlText(cellMatch[2]);
      } else {
        value = extractXmlText(cellMatch[2]);
      }

      row[columnIndex] = value.trim();
    }

    rows[rowIndex] = row;
  }

  return Array.from({ length: rows.length }, (_, index) => rows[index] ?? []);
}

function parseSheet(workbookRoot: string, sheetPath: string, sheetName: string, sharedStrings: string[]): ParsedSheet {
  const absolutePath = path.join(workbookRoot, sheetPath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Sheet file missing for ${sheetName}: ${absolutePath}`);
  }
  return { name: sheetName, rows: parseSheetRows(readXml(absolutePath), sharedStrings) };
}

function parseNumeric(value: unknown) {
  const numeric = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function findFirstNumericOnRow(row: string[], startIndex = 0) {
  for (let index = startIndex; index < row.length; index += 1) {
    const numeric = parseNumeric(row[index]);
    if (numeric !== null) return numeric;
  }
  return null;
}

function cellMatchesMetric(text: string, metric: MetricKey) {
  const normalized = normalizeText(text);
  return METRIC_LABELS[metric].some((pattern) => pattern.test(normalized));
}

function tryDirectRowExtraction(rows: string[][]) {
  const result: Partial<Record<MetricKey, number>> = {};

  for (const row of rows) {
    for (let cellIndex = 0; cellIndex < row.length; cellIndex += 1) {
      const cellText = row[cellIndex] ?? "";
      for (const metric of METRIC_KEYS) {
        if (result[metric] !== undefined || !cellMatchesMetric(cellText, metric)) continue;
        const inlineNumeric = cellText.match(/(-?\d+(?:\.\d+)?)/)?.[1];
        const numeric = inlineNumeric ? Number(inlineNumeric) : findFirstNumericOnRow(row, cellIndex + 1);
        if (Number.isFinite(numeric ?? NaN)) {
          result[metric] = Number(numeric);
        }
      }
    }
  }

  return METRIC_KEYS.every((metric) => result[metric] !== undefined) ? result : null;
}

function tryYearColumnExtraction(rows: string[][]) {
  const yearText = String(YEAR);
  const headerRowIndex = rows.findIndex((row) => row.some((cell) => normalizeText(cell) === yearText));
  if (headerRowIndex < 0) return null;

  const headerRow = rows[headerRowIndex];
  const yearColumnIndex = headerRow.findIndex((cell) => normalizeText(cell) === yearText);
  if (yearColumnIndex < 0) return null;

  const result: Partial<Record<MetricKey, number>> = {};
  for (const row of rows) {
    const firstNonEmpty = row.find((cell) => normalizeText(cell));
    const metric = METRIC_KEYS.find((key) => firstNonEmpty ? cellMatchesMetric(firstNonEmpty, key) : false);
    if (!metric || result[metric] !== undefined) continue;

    const numeric = parseNumeric(row[yearColumnIndex]);
    if (numeric !== null) {
      result[metric] = numeric;
    }
  }

  return METRIC_KEYS.every((metric) => result[metric] !== undefined) ? result : null;
}

function tryMetricHeaderExtraction(rows: string[][]) {
  const headerRowIndex = rows.findIndex((row) => METRIC_KEYS.every((metric) => row.some((cell) => cellMatchesMetric(cell, metric))));
  if (headerRowIndex < 0) return null;

  const headerRow = rows[headerRowIndex];
  const metricColumnIndex = new Map<MetricKey, number>();
  for (const metric of METRIC_KEYS) {
    const columnIndex = headerRow.findIndex((cell) => cellMatchesMetric(cell, metric));
    if (columnIndex >= 0) metricColumnIndex.set(metric, columnIndex);
  }

  if (metricColumnIndex.size !== METRIC_KEYS.length) return null;

  const dataRowIndex = rows.findIndex((row, index) => index !== headerRowIndex && row.some((cell) => normalizeText(cell) === String(YEAR)));
  if (dataRowIndex < 0) return null;

  const dataRow = rows[dataRowIndex];
  const result: Partial<Record<MetricKey, number>> = {};
  for (const metric of METRIC_KEYS) {
    const columnIndex = metricColumnIndex.get(metric)!;
    const numeric = parseNumeric(dataRow[columnIndex]);
    if (numeric !== null) result[metric] = numeric;
  }

  return METRIC_KEYS.every((metric) => result[metric] !== undefined) ? result : null;
}

function tryYearTableExtraction(rows: string[][]) {
  const result: Partial<Record<MetricKey, number>> = {};

  for (let headerRowIndex = 0; headerRowIndex < rows.length; headerRowIndex += 1) {
    const headerRow = rows[headerRowIndex] || [];
    if (!headerRow.some((cell) => normalizeText(cell) === "year")) continue;

    for (const metric of METRIC_KEYS) {
      if (result[metric] !== undefined) continue;
      if (!headerRow.some((cell) => cellMatchesMetric(cell, metric))) continue;

      for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex] || [];
        if (!row.some((cell) => matchesTargetYearCell(cell))) continue;

        const numeric = findFirstNumericOnRow(row);
        if (numeric !== null) {
          result[metric] = numeric;
        }
        break;
      }
    }
  }

  return Object.keys(result).length ? result : null;
}

function extractTfTsMetrics(sheets: ParsedSheet[], workbookPath: string): TfTsRecord {
  const result: Partial<Record<MetricKey, number>> = {};
  let sheetName = sheets[0]?.name || "Unknown";

  for (const sheet of sheets) {
    const sources = [
      tryDirectRowExtraction(sheet.rows),
      tryYearColumnExtraction(sheet.rows),
      tryMetricHeaderExtraction(sheet.rows),
      tryYearTableExtraction(sheet.rows),
    ];

    for (const source of sources) {
      if (!source) continue;
      sheetName = sheet.name;
      for (const metric of METRIC_KEYS) {
        if (result[metric] === undefined && source[metric] !== undefined) {
          result[metric] = source[metric];
        }
      }
    }

    if (result.tfTotal !== undefined && result.tsTotal !== undefined) break;
  }

  if (result.tfTotal === undefined && result.tsTotal === undefined) {
    fail("TF/TS metrics were not found in the workbook. Verify the sheet structure and labels.");
  }

  return {
    tfTotal: Number(result.tfTotal || 0),
    tfRate: Number(result.tfRate || 0),
    tsTotal: Number(result.tsTotal || 0),
    tsRate: Number(result.tsRate || 0),
    source: path.basename(workbookPath),
    periodLabel: PERIOD_LABEL,
    sheetName,
  };
}

function rowText(row: string[]) {
  return normalizeComparableText(row.join(" "));
}

function findRowIndex(rows: string[][], matcher: (row: string[]) => boolean, start = 0) {
  for (let index = start; index < rows.length; index += 1) {
    if (matcher(rows[index] || [])) return index;
  }
  return -1;
}

function parseYearLabel(value: unknown) {
  const match = normalizeComparableText(value).match(/20\d{2}/);
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

function extractSimpleTrend(rows: string[][], headerMatcher: (row: string[]) => boolean, stopMatcher: ((row: string[]) => boolean) | null) {
  const headerIndex = findRowIndex(rows, headerMatcher);
  if (headerIndex < 0) return null;

  const stopIndex = stopMatcher ? findRowIndex(rows, stopMatcher, headerIndex + 1) : -1;
  const endIndex = stopIndex >= 0 ? stopIndex : rows.length;
  const series: EsgTrendPoint[] = [];

  for (let index = headerIndex + 1; index < endIndex; index += 1) {
    const row = rows[index] || [];
    const label = String(row[0] ?? "").trim();
    const numeric = parseNumeric(row[1]);
    if (!label || numeric === null) continue;
    if (normalizeText(label).startsWith("target")) continue;
    series.push({ label, year: parseYearLabel(label) ?? YEAR, value: numeric });
  }

  if (!series.length) return null;

  return {
    series,
    target: stopIndex >= 0 && normalizeText(rows[stopIndex]?.[0] ?? "").startsWith("target") ? parseNumeric(rows[stopIndex]?.[1]) : null,
  };
}

function extractNoiseTrend(rows: string[][]) {
  const startIndex = findRowIndex(rows, (row) => {
    const text = rowText(row);
    return text.includes("loc a") && text.includes("day time") && text.includes("night time");
  });

  if (startIndex < 0) return null;

  const stopIndex = findRowIndex(rows, (row) => rowText(row).startsWith("target day time"), startIndex + 1);
  const endIndex = stopIndex >= 0 ? stopIndex : rows.length;
  const series: EsgNoisePoint[] = [];

  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const row = rows[index] || [];
    const label = String(row[0] ?? "").trim();
    if (!label || normalizeText(label).startsWith("target")) continue;

    const day = parseNumeric(row[1]);
    const dayStandard = parseNumeric(row[2]);
    const night = parseNumeric(row[3]);
    const nightStandard = parseNumeric(row[4]);
    if (day === null || dayStandard === null || night === null || nightStandard === null) continue;

    series.push({
      label,
      year: parseYearLabel(label) ?? YEAR,
      day,
      dayStandard,
      night,
      nightStandard,
    });
  }

  if (!series.length) return null;

  return { series };
}

function extractConcerns(rows: string[][]) {
  const startIndex = findRowIndex(rows, (row) => {
    const text = rowText(row);
    return text.includes("category") && text.includes("no of concerns");
  });

  if (startIndex < 0) return null;

  const series: EsgConcernPoint[] = [];
  for (let index = startIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const name = String(row[0] ?? "").trim();
    const count = parseNumeric(row[1]);
    if (!name) break;
    if (count === null) continue;
    series.push({ name, count });
  }

  if (!series.length) return null;

  const topConcern = [...series].sort((a, b) => b.count - a.count)[0] || null;
  const total = series.reduce((sum, item) => sum + item.count, 0);
  return { series, topConcern, total };
}

function extractEsgDashboard(sheets: ParsedSheet[], workbookPath: string): EsgDashboardPayload {
  const sheet = sheets.find((candidate) => candidate.rows.some((row) => rowText(row).includes("ghg emmission"))) || sheets[0];
  if (!sheet) {
    fail("ESG workbook did not contain any sheets.");
  }

  const rows = sheet.rows;
  const ghg = extractSimpleTrend(
    rows,
    (row) => rowText(row).includes("ghg emmission"),
    (row) => rowText(row).startsWith("target"),
  );
  const scrap = extractSimpleTrend(
    rows,
    (row) => rowText(row).includes("scrapped flash waste"),
    (row) => rowText(row).startsWith("target"),
  );
  const waste = extractSimpleTrend(
    rows,
    (row) => rowText(row).includes("waste recycling"),
    (row) => rowText(row).startsWith("target"),
  );
  const noise = extractNoiseTrend(rows);
  const tf = extractSimpleTrend(
    rows,
    (row) => rowText(row).includes("tf total fatalities"),
    (row) => rowText(row).includes("ts total recordable cases"),
  );
  const ts = extractSimpleTrend(
    rows,
    (row) => rowText(row).includes("ts total recordable cases"),
    (row) => rowText(row).includes("category") && rowText(row).includes("no of concerns"),
  );
  const concerns = extractConcerns(rows);

  if (!ghg || !scrap || !waste || !noise || !tf || !ts || !concerns) {
    fail("ESG workbook layout was not recognized. Verify the workbook contents and section labels.");
  }

  const sourceFile = path.basename(workbookPath);
  const sourceSheet = sheet.name;
  const reportingPeriod = stripPeriodLabel(waste.series[waste.series.length - 1]?.label || noise.series[noise.series.length - 1]?.label || `${YEAR}`);
  const ghgLatest = ghg.series[ghg.series.length - 1];
  const scrapLatest = scrap.series[scrap.series.length - 1];
  const wasteLatest = waste.series[waste.series.length - 1];
  const noiseLatest = noise.series[noise.series.length - 1];
  const tfLatest = tf.series[tf.series.length - 1];
  const tsLatest = ts.series[ts.series.length - 1];

  return {
    year: YEAR,
    sourceFile,
    sourcePath: workbookPath,
    sourceSheet,
    periodLabel: reportingPeriod,
    tracked: true,
    importedAt: new Date().toISOString(),
    kpis: {
      ghgIntensity: {
        value: Number(ghgLatest.value.toFixed(2)),
        target: Number((ghg.target ?? 0).toFixed(2)),
        label: displayLabel(ghgLatest.label),
        status: ghgLatest.value <= Number(ghg.target ?? 0) ? "Better than target" : "Above target",
      },
      scrapFlashWaste: {
        value: Number(scrapLatest.value.toFixed(2)),
        target: Number((scrap.target ?? 0).toFixed(2)),
        label: displayLabel(scrapLatest.label),
        status: scrapLatest.value <= Number(scrap.target ?? 0) ? "Better than target" : "Above target",
      },
      wasteRecycling: {
        value: Number(wasteLatest.value.toFixed(2)),
        target: Number((waste.target ?? 0).toFixed(2)),
        label: displayLabel(wasteLatest.label),
        status: wasteLatest.value >= Number(waste.target ?? 0) ? "On target" : "Below target",
      },
      externalNoiseDay: {
        value: Number(noiseLatest.day.toFixed(2)),
        standard: Number(noiseLatest.dayStandard.toFixed(2)),
        label: displayLabel(noiseLatest.label),
        status: noiseLatest.day <= noiseLatest.dayStandard ? "Within standard" : "Above standard",
      },
      externalNoiseNight: {
        value: Number(noiseLatest.night.toFixed(2)),
        standard: Number(noiseLatest.nightStandard.toFixed(2)),
        label: displayLabel(noiseLatest.label),
        status: noiseLatest.night <= noiseLatest.nightStandard ? "Within standard" : "Above standard",
      },
      tf: {
        total: Number(tfLatest.value || 0),
        rate: 0,
        label: displayLabel(tfLatest.label),
        periodLabel: displayLabel(tfLatest.label),
        source: sourceFile,
        status: Number(tfLatest.value || 0) === 0 ? "Zero fatalities" : "Fatalities recorded",
      },
      ts: {
        total: Number(tsLatest.value || 0),
        rate: 0,
        label: displayLabel(tsLatest.label),
        periodLabel: displayLabel(tsLatest.label),
        source: sourceFile,
        status: Number(tsLatest.value || 0) === 0 ? "Zero in 2026" : "Cases recorded",
      },
      stakeholderConcerns: {
        total: concerns.total,
        label: String(YEAR),
        topConcern: concerns.topConcern,
        status: concerns.topConcern ? `Highest concern: ${concerns.topConcern.name} (${concerns.topConcern.count})` : "No concerns tracked",
      },
    },
    charts: {
      ghgIntensityTrend: ghg.series.map((item) => ({ ...item, value: Number(item.value.toFixed(2)) })),
      scrapFlashWasteTrend: scrap.series.map((item) => ({ ...item, value: Number(item.value.toFixed(2)) })),
      wasteRecyclingTrend: waste.series.map((item) => ({ ...item, value: Number(item.value.toFixed(2)) })),
      noiseTrend: noise.series.map((item) => ({
        ...item,
        day: Number(item.day.toFixed(2)),
        dayStandard: Number(item.dayStandard.toFixed(2)),
        night: Number(item.night.toFixed(2)),
        nightStandard: Number(item.nightStandard.toFixed(2)),
      })),
      tfTrend: tf.series.map((item) => ({ ...item, value: Number(item.value || 0) })),
      tsTrend: ts.series.map((item) => ({ ...item, value: Number(item.value || 0) })),
      stakeholderConcerns: concerns.series.map((item) => ({ name: item.name, count: Number(item.count || 0) })),
    },
  };
}
async function main() {
  const workbookPath = resolveWorkbookPath();
  const extractedRoot = extractWorkbookZip(workbookPath);

  try {
    const workbookXml = readXml(path.join(extractedRoot, "xl", "workbook.xml"));
    const relsXml = readXml(path.join(extractedRoot, "xl", "_rels", "workbook.xml.rels"));
    const sharedStringsPath = path.join(extractedRoot, "xl", "sharedStrings.xml");
    const sharedStrings = fs.existsSync(sharedStringsPath) ? parseSharedStrings(readXml(sharedStringsPath)) : [];
    const workbookSheets = parseWorkbookSheets(workbookXml);
    const relationships = parseWorkbookRelationships(relsXml);

    const sheets = workbookSheets.map((sheet) => {
      const target = relationships.get(sheet.relId);
      if (!target) fail(`Workbook relationship missing for sheet ${sheet.name} (${sheet.relId})`);
      const normalizedTarget = target.startsWith("xl/") ? target : path.posix.join("xl", target.replace(/^\/+/, ""));
      return parseSheet(extractedRoot, normalizedTarget, sheet.name, sharedStrings);
    });

    const metric = extractTfTsMetrics(sheets, workbookPath);
    const dashboard = extractEsgDashboard(sheets, workbookPath);
    const upserted = await prisma.tfTsMetric.upsert({
      where: { year: YEAR },
      update: {
        tfTotal: metric.tfTotal,
        tfRate: metric.tfRate,
        tsTotal: metric.tsTotal,
        tsRate: metric.tsRate,
        source: metric.source,
        periodLabel: metric.periodLabel,
        tracked: true,
      },
      create: {
        year: YEAR,
        tfTotal: metric.tfTotal,
        tfRate: metric.tfRate,
        tsTotal: metric.tsTotal,
        tsRate: metric.tsRate,
        source: metric.source,
        periodLabel: metric.periodLabel,
        tracked: true,
      },
    });
    const snapshot = await prisma.esgDashboardSnapshot.upsert({
      where: { year: YEAR },
      update: {
        sourceFile: dashboard.sourceFile,
        sourcePath: dashboard.sourcePath,
        sourceSheet: dashboard.sourceSheet,
        periodLabel: dashboard.periodLabel,
        tracked: dashboard.tracked,
        payload: dashboard as Prisma.InputJsonValue,
      },
      create: {
        year: dashboard.year,
        sourceFile: dashboard.sourceFile,
        sourcePath: dashboard.sourcePath,
        sourceSheet: dashboard.sourceSheet,
        periodLabel: dashboard.periodLabel,
        tracked: dashboard.tracked,
        payload: dashboard as Prisma.InputJsonValue,
      },
    });

    console.log("ESG dashboard snapshot imported");
    console.log(`Dashboard year: ${snapshot.year}`);
    console.log(`Dashboard period: ${snapshot.periodLabel}`);
    console.log(`Dashboard source: ${snapshot.sourceFile}`);
    console.log(`Dashboard sheet: ${snapshot.sourceSheet}`);
    console.log(`GHG latest: ${dashboard.kpis.ghgIntensity.value}`);
    console.log(`Waste recycling latest: ${dashboard.kpis.wasteRecycling.value}`);
    console.log(`TF Total: ${dashboard.kpis.tf.total}`);
    console.log(`TS Total: ${dashboard.kpis.ts.total}`);

    console.log("TF/TS import complete");
    console.log(`Workbook: ${workbookPath}`);
    console.log(`Source: ${upserted.source}`);
    console.log(`Period: ${upserted.periodLabel}`);
    console.log(`Sheet: ${metric.sheetName}`);
    console.log(`TF Total: ${upserted.tfTotal}`);
    console.log(`TF Rate: ${upserted.tfRate.toFixed(2)}`);
    console.log(`TS Total: ${upserted.tsTotal}`);
    console.log(`TS Rate: ${upserted.tsRate.toFixed(2)}`);
  } finally {
    fs.rmSync(path.dirname(extractedRoot), { recursive: true, force: true });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});



