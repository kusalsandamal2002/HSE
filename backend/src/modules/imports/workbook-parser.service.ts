import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export type ParsedSheet = {
  name: string;
  rows: string[][];
};

export type ParsedWorkbook = {
  filePath: string;
  fileName: string;
  sheets: ParsedSheet[];
};

function quotePs(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function fail(message: string): never {
  throw new Error(message);
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

function parseSharedStrings(xml: string) {
  const strings: string[] = [];
  for (const match of xml.matchAll(/<si\b[\s\S]*?<\/si>/g)) {
    strings.push(extractXmlText(match[0]));
  }
  return strings;
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
    if (attrs.Id && attrs.Target) {
      relationships.set(attrs.Id, attrs.Target);
    }
  }
  return relationships;
}

function parseSheetRows(sheetXml: string, sharedStrings: string[]) {
  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = getAttributes(cellMatch[1]);
      const ref = attrs.r;
      const type = attrs.t;
      const raw = extractXmlText(cellMatch[2]);
      const value = type === "s" ? sharedStrings[Number(raw)] ?? "" : raw;
      if (!ref) continue;
      cells[columnIndexFromRef(ref)] = value;
    }
    rows.push(cells);
  }
  return rows;
}

function extractWorkbookZip(workbookPath: string) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hse-upload-"));
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

  return {
    extractDir,
    cleanup() {
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

export function parseWorkbookFile(workbookPath: string): ParsedWorkbook {
  const { extractDir, cleanup } = extractWorkbookZip(workbookPath);

  try {
    const workbookXml = readXml(path.join(extractDir, "xl", "workbook.xml"));
    const relsXml = readXml(path.join(extractDir, "xl", "_rels", "workbook.xml.rels"));
    const sharedStringsPath = path.join(extractDir, "xl", "sharedStrings.xml");
    const sharedStrings = fs.existsSync(sharedStringsPath) ? parseSharedStrings(readXml(sharedStringsPath)) : [];

    const workbookSheets = parseWorkbookSheets(workbookXml);
    const relationships = parseWorkbookRelationships(relsXml);
    const sheets = workbookSheets.map((sheet) => {
      const target = relationships.get(sheet.relId);
      if (!target) fail(`Workbook relationship missing for sheet ${sheet.name} (${sheet.relId})`);
      const normalizedTarget = target.replace(/^\/?xl\//, "").replace(/^\/+/, "");
      const absolutePath = path.join(extractDir, "xl", normalizedTarget);
      if (!fs.existsSync(absolutePath)) {
        fail(`Sheet file missing for ${sheet.name}: ${absolutePath}`);
      }
      return { name: sheet.name, rows: parseSheetRows(readXml(absolutePath), sharedStrings) };
    });

    return {
      filePath: workbookPath,
      fileName: path.basename(workbookPath),
      sheets,
    };
  } finally {
    cleanup();
  }
}

export function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function rowText(row: string[]) {
  return normalizeText(row.join(" "));
}

export function getSheetByName(sheets: ParsedSheet[], name: string) {
  return sheets.find((sheet) => normalizeText(sheet.name) === normalizeText(name)) ?? null;
}

export function getCell(row: string[] | undefined, index: number) {
  return compactText(row?.[index] ?? "");
}

export function getRowValues(row: string[] | undefined, startColumn: number, endColumn: number) {
  const values: string[] = [];
  if (!row) return values;
  for (let index = startColumn; index <= endColumn; index += 1) {
    values.push(compactText(row[index] ?? ""));
  }
  return values;
}

export function findFirstValueAfterLabel(rows: string[][], label: string) {
  const target = normalizeText(label);
  for (const row of rows) {
    const foundIndex = row.findIndex((cell) => normalizeText(cell) === target);
    if (foundIndex < 0) continue;
    for (let index = foundIndex + 1; index < row.length; index += 1) {
      const value = compactText(row[index] ?? "");
      if (value) return value;
    }
  }
  return null;
}
