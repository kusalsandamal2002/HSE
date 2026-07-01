import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http.js";
import { env } from "../../config/env.js";
import { parseWorkbookFile } from "./workbook-parser.service.js";
import { inspectWorkbook } from "./workbook-detector.service.js";
import { executeWorkbookImport } from "./import-approval.service.js";
import type {
  ImportBatchHistoryItem,
  ImportBatchPreviewResponse,
  ImportIssue,
  ImportSection,
  ImportWorkbookType,
  WorkbookInspection,
} from "./imports.types.js";

const uploadRoot = path.resolve(process.cwd(), env.uploadDir, "imports");
fs.mkdirSync(uploadRoot, { recursive: true });

type UploadedFile = Express.Multer.File;

type BatchRecord = Awaited<ReturnType<typeof fetchBatchRecord>>;

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function sha256(filePath: string) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sanitizeJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === undefined) return null;
  if (value === null) return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item)) as Prisma.InputJsonArray;
  }

  if (typeof value === "object") {
    const output: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = sanitizeJsonValue(item);
    }
    return output as Prisma.InputJsonObject;
  }

  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  return String(value);
}

function toIssueRecord(issue: ImportIssue) {
  return {
    sectionKey: issue.sectionKey,
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
    detailsJson: issue.details ? sanitizeJsonValue(issue.details) : undefined,
  };
}

function buildSummary(inspection: WorkbookInspection, fileHash: string, duplicateBatchId?: string | null) {
  return {
    ...inspection.summary,
    fileHash,
    duplicateBatchId: duplicateBatchId ?? null,
    confidence: inspection.confidence,
    counts: {
      rowCount: inspection.rowCount,
      validRowCount: inspection.validRowCount,
      warningCount: inspection.warningCount,
      errorCount: inspection.errorCount,
    },
    issues: inspection.issues,
    sections: inspection.sections.map((section) => ({
      sectionKey: section.sectionKey,
      sectionLabel: section.sectionLabel,
      sheetName: section.sheetName,
      confidence: section.confidence,
      rowCount: section.rowCount,
      summary: section.summary ?? "",
      metadata: section.metadata ?? null,
    })),
  };
}

function buildPreviewResponse(batch: any): ImportBatchPreviewResponse {
  const sections = (batch.detectedSections as any[]).map((section: any) => ({
    sectionKey: section.sectionKey,
    sectionLabel: section.sectionLabel,
    sheetName: section.sheetName,
    confidence: section.confidence,
    rowCount: section.rowCount,
    summary: section.summary,
    metadata: (section.metadataJson as Record<string, unknown> | null) ?? null,
    rows: (batch.previewRows as any[])
      .filter((row: any) => row.sectionKey === section.sectionKey)
      .sort((a: any, b: any) => a.rowIndex - b.rowIndex)
      .map((row: any) => ({
        sectionKey: row.sectionKey,
        rowIndex: row.rowIndex,
        rawJson: (row.rawJson as Record<string, unknown>) ?? {},
        mappedJson: (row.mappedJson as Record<string, unknown>) ?? {},
        status: row.status,
        validation: Array.isArray(row.validationJson) ? (row.validationJson as ImportIssue[]) : [],
      })),
  }));

  const issues = (batch.validationIssues as any[]).map((issue: any) => ({
    sectionKey: issue.sectionKey,
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
    details: (issue.detailsJson as Record<string, unknown> | null) ?? null,
  }));

  return {
    batch: buildHistoryItem(batch),
    sheetNames: Array.isArray(batch.summaryJson) ? [] : (batch.summaryJson as any)?.sheetNames ?? [],
    workbookType: batch.workbookType,
    confidence: Number((batch.summaryJson as any)?.confidence ?? 0),
    sections,
    issues,
    summary: (batch.summaryJson as Record<string, unknown>) ?? {},
    counts: {
      rowCount: batch.rowCount,
      validRowCount: batch.validRowCount,
      warningCount: batch.warningCount,
      errorCount: batch.errorCount,
    },
    canApprove: batch.status === "READY_FOR_APPROVAL" && batch.errorCount === 0,
  };
}

function buildHistoryItem(batch: any): ImportBatchHistoryItem {
  return {
    id: batch.id,
    fileName: batch.fileName,
    originalName: batch.originalName,
    workbookType: batch.workbookType,
    status: batch.status,
    uploadedBy: batch.uploadedBy,
    uploadedAt: batch.uploadedAt.toISOString(),
    approvedBy: batch.approvedBy,
    approvedAt: batch.approvedAt ? batch.approvedAt.toISOString() : null,
    importedAt: batch.importedAt ? batch.importedAt.toISOString() : null,
    rowCount: batch.rowCount,
    validRowCount: batch.validRowCount,
    warningCount: batch.warningCount,
    errorCount: batch.errorCount,
    fileHash: batch.fileHash,
    summaryJson: batch.summaryJson,
  };
}

async function fetchBatchRecord(batchId: string) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      file: true,
      detectedSections: true,
      previewRows: true,
      validationIssues: true,
    },
  });

  if (!batch) {
    throw new HttpError(404, "Import batch not found");
  }

  return batch;
}

async function createStoredBatch(
  params: {
    file: UploadedFile;
    inspection: WorkbookInspection;
    fileHash: string;
    uploadedBy: string | null;
    duplicateBatchId?: string | null;
  },
) {
  const hasDuplicate = Boolean(params.duplicateBatchId);
  const status = params.inspection.errorCount > 0 || params.inspection.workbookType === "UNKNOWN" || hasDuplicate
    ? "VALIDATION_FAILED"
    : "READY_FOR_APPROVAL";
  const duplicateIssue: ImportIssue | null = params.duplicateBatchId
    ? {
        sectionKey: null,
        severity: "ERROR",
        code: "duplicate_file_hash",
        message: `This exact file has already been uploaded before (${params.duplicateBatchId}). Duplicate uploads are blocked to prevent repeated imports.`,
        details: { duplicateBatchId: params.duplicateBatchId },
      }
    : null;
  const issues = duplicateIssue ? [...params.inspection.issues, duplicateIssue] : [...params.inspection.issues];

  const batch = await prisma.importBatch.create({
    data: {
      fileName: params.file.filename,
      originalName: params.file.originalname,
      fileHash: params.fileHash,
      workbookType: params.inspection.workbookType,
      status,
      uploadedBy: params.uploadedBy,
      rowCount: params.inspection.rowCount,
      validRowCount: params.inspection.validRowCount,
      warningCount: params.inspection.warningCount,
      errorCount: params.inspection.errorCount + (duplicateIssue ? 1 : 0),
      summaryJson: buildSummary(params.inspection, params.fileHash, params.duplicateBatchId) as Prisma.InputJsonValue,
      file: {
        create: {
          originalName: params.file.originalname,
          storedName: params.file.filename,
          mimeType: params.file.mimetype,
          sizeBytes: params.file.size,
          path: params.file.path,
          sha256: params.fileHash,
        },
      },
      detectedSections: {
        create: params.inspection.sections.map((section) => ({
          sectionKey: section.sectionKey,
          sectionLabel: section.sectionLabel,
          sheetName: section.sheetName,
          confidence: section.confidence,
          rowCount: section.rowCount,
          summary: section.summary,
          metadataJson: section.metadata ? sanitizeJsonValue(section.metadata) : undefined,
        })),
      },
      previewRows: {
        create: params.inspection.sections.flatMap((section) =>
          section.rows.map((row) => ({
            sectionKey: row.sectionKey,
            rowIndex: row.rowIndex,
            rawJson: sanitizeJsonValue(row.rawJson),
            mappedJson: sanitizeJsonValue(row.mappedJson),
            status: row.status,
            validationJson: row.validation.length ? sanitizeJsonValue(row.validation) : undefined,
          })),
        ),
      },
      validationIssues: {
        create: issues.map((item) => toIssueRecord(item)),
      },
    },
    include: {
      file: true,
      detectedSections: true,
      previewRows: true,
      validationIssues: true,
    },
  });

  return batch;
}

async function updateBatchAfterApproval(batchId: string, approvedBy: string | null, approved: boolean, imported: boolean) {
  return prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status: imported ? "IMPORTED" : approved ? "APPROVED" : "FAILED",
      approvedBy,
      approvedAt: approved ? new Date() : undefined,
      importedAt: imported ? new Date() : undefined,
    },
    include: {
      file: true,
      detectedSections: true,
      previewRows: true,
      validationIssues: true,
    },
  });
}

export async function uploadImportBatch(file: UploadedFile, uploadedBy: string | null) {
  if (!file.originalname.toLowerCase().endsWith(".xlsx")) {
    throw new HttpError(400, "Only .xlsx files are supported");
  }

  const fileHash = sha256(file.path);
  const duplicate = await prisma.importBatch.findFirst({
    where: { fileHash },
    orderBy: { uploadedAt: "desc" },
    select: { id: true },
  });

  try {
    const workbook = parseWorkbookFile(file.path);
    const inspection = inspectWorkbook(workbook, file.originalname);
    const batch = await createStoredBatch({
      file,
      inspection,
      fileHash,
      uploadedBy,
      duplicateBatchId: duplicate?.id ?? null,
    });
    return buildPreviewResponse(batch);
  } catch (error) {
    const failedBatch = await prisma.importBatch.create({
      data: {
        fileName: file.filename,
        originalName: file.originalname,
        fileHash,
        workbookType: "UNKNOWN",
        status: "FAILED",
        uploadedBy,
        rowCount: 0,
        validRowCount: 0,
        warningCount: 0,
        errorCount: 1,
        summaryJson: {
          workbookType: "UNKNOWN",
          sourceFile: file.originalname,
          error: error instanceof Error ? error.message : String(error),
          fileHash,
        } as Prisma.InputJsonValue,
        file: {
          create: {
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            path: file.path,
            sha256: fileHash,
          },
        },
        validationIssues: {
          create: [
            {
              sectionKey: null,
              severity: "ERROR",
              code: "parse_failed",
              message: error instanceof Error ? error.message : String(error),
              detailsJson: {
                originalName: file.originalname,
              },
            },
          ],
        },
      },
      include: {
        file: true,
        detectedSections: true,
        previewRows: true,
        validationIssues: true,
      },
    });

    return buildPreviewResponse(failedBatch);
  }
}

export async function getImportBatchPreview(batchId: string) {
  return buildPreviewResponse(await fetchBatchRecord(batchId));
}

export async function listImportHistory(options: { workbookType?: ImportWorkbookType; limit?: number } = {}) {
  const batches = await prisma.importBatch.findMany({
    where: options.workbookType ? { workbookType: options.workbookType } : undefined,
    orderBy: { uploadedAt: "desc" },
    take: options.limit ?? 25,
    include: {
      file: true,
      detectedSections: true,
      previewRows: true,
      validationIssues: true,
    },
  });

  return batches.map(buildHistoryItem);
}

export async function cancelImportBatch(batchId: string) {
  const batch = await fetchBatchRecord(batchId);
  if (batch.status === "IMPORTED") {
    throw new HttpError(409, "Imported batches cannot be cancelled");
  }

  if (batch.file?.path && fs.existsSync(batch.file.path)) {
    fs.rmSync(batch.file.path, { force: true });
  }

  const updated = await prisma.importBatch.update({
    where: { id: batchId },
    data: { status: "CANCELLED" },
    include: {
      file: true,
      detectedSections: true,
      previewRows: true,
      validationIssues: true,
    },
  });

  return buildPreviewResponse(updated);
}

export async function approveImportBatch(batchId: string, approvedBy: string | null) {
  const batch = await fetchBatchRecord(batchId);
  if (batch.status !== "READY_FOR_APPROVAL") {
    throw new HttpError(409, `Batch ${batchId} is not ready for approval`);
  }
  if (!batch.file?.path) {
    throw new HttpError(400, "Imported file is missing");
  }
  if (batch.workbookType === "UNKNOWN") {
    throw new HttpError(400, "Unsupported workbook type");
  }

  await updateBatchAfterApproval(batchId, approvedBy, true, false);

  try {
    const runResult = executeWorkbookImport(batch.workbookType, batch.file.path);
    const imported = await updateBatchAfterApproval(batchId, approvedBy, true, true);
    return {
      ...buildPreviewResponse(imported),
      importResult: runResult,
    };
  } catch (error) {
    const failed = await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "FAILED",
        approvedBy,
        approvedAt: new Date(),
        summaryJson: {
          ...(batch.summaryJson as Record<string, unknown>),
          approvalError: error instanceof Error ? error.message : String(error),
        },
      },
      include: {
        file: true,
        detectedSections: true,
        previewRows: true,
        validationIssues: true,
      },
    });

    await prisma.importValidationIssue.create({
      data: {
        batchId,
        sectionKey: null,
        severity: "ERROR",
        code: "approval_failed",
        message: error instanceof Error ? error.message : String(error),
      },
    });

    return buildPreviewResponse(failed);
  }
}



