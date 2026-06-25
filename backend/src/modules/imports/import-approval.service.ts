import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import type { ImportWorkbookType } from "./imports.types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..", "..", "..");
const repoDir = path.resolve(backendDir, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export type ApprovedImportRun = {
  scriptName: string;
  stdout: string;
  stderr: string;
};

export function executeWorkbookImport(workbookType: ImportWorkbookType, workbookPath: string): ApprovedImportRun {
  const scriptName = workbookType === "ESG_METRICS" ? "import:esg-metrics" : "import:may-excel";
  const env = {
    ...process.env,
    IMPORT_WORKBOOK_PATH: workbookPath,
    HSE_IMPORT_WORKBOOK: workbookPath,
    MAY_EXCEL_WORKBOOK: workbookPath,
    ESG_METRICS_WORKBOOK: workbookPath,
  };

  const result = spawnSync(npmCommand, ["--prefix", backendDir, "run", scriptName], {
    cwd: repoDir,
    env,
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr || "";
    const stdout = result.stdout || "";
    throw new Error(stderr || stdout || `Import script failed with exit code ${result.status ?? 1}`);
  }

  return {
    scriptName,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}
