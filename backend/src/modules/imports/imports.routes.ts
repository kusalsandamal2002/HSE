import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { ADMIN_ONLY_ROLES, IMPORT_APPROVE_ROLES, IMPORT_UPLOAD_ROLES, requireAuth, requireRole } from "../../middleware/auth.js";
import { HttpError, toNumber, toStringValue } from "../../utils/http.js";
import { writeAuditLog } from "../../utils/audit.js";
import {
  approveImportBatch,
  cancelImportBatch,
  getImportBatchPreview,
  listImportHistory,
  uploadImportBatch,
} from "./imports.service.js";

export const importsRouter = Router();

const uploadDir = path.resolve(process.cwd(), env.uploadDir, "imports");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isXlsx = file.originalname.toLowerCase().endsWith(".xlsx");
    const mimeOk =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/octet-stream";
    if (!isXlsx || !mimeOk) {
      (cb as unknown as (error: Error | null, acceptFile: boolean) => void)(new HttpError(400, "Only .xlsx files are supported"), false);
      return;
    }
    cb(null, true);
  },
});

importsRouter.use(requireAuth);

importsRouter.post("/upload", requireRole(IMPORT_UPLOAD_ROLES), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, "Excel file is required");
    }

    const result = await uploadImportBatch(req.file, req.user?.name ?? req.user?.email ?? null);

    await writeAuditLog({
      user: req.user,
      action: "UPLOAD_IMPORT_BATCH",
      entity: "ImportBatch",
      entityId: result.batch.id,
      after: {
        batch: result.batch,
        workbookType: result.workbookType,
        confidence: result.confidence,
        counts: result.counts,
        file: {
          originalName: req.file.originalname,
          filename: req.file.filename,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
      },
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

importsRouter.get("/history", async (req, res, next) => {
  try {
    const workbookType = toStringValue(req.query.workbookType) as "HSE_ACCIDENT_SUMMARY" | "ESG_METRICS" | "UNKNOWN" | undefined;
    const limit = toNumber(req.query.limit, 25) ?? 25;
    res.json(await listImportHistory({ workbookType, limit }));
  } catch (error) {
    next(error);
  }
});

importsRouter.get("/:batchId/preview", async (req, res, next) => {
  try {
    res.json(await getImportBatchPreview(req.params.batchId));
  } catch (error) {
    next(error);
  }
});

importsRouter.post("/:batchId/approve", requireRole(IMPORT_APPROVE_ROLES), async (req, res, next) => {
  try {
    const before = await getImportBatchPreview(req.params.batchId);
    const result = await approveImportBatch(req.params.batchId, req.user?.name ?? req.user?.email ?? null);

    await writeAuditLog({
      user: req.user,
      action: "APPROVE_IMPORT_BATCH",
      entity: "ImportBatch",
      entityId: result.batch.id,
      before: before.batch,
      after: {
        batch: result.batch,
        workbookType: result.workbookType,
        counts: result.counts,
        importResult: "importResult" in result ? result.importResult : null,
      },
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

importsRouter.delete("/:batchId", requireRole(ADMIN_ONLY_ROLES), async (req, res, next) => {
  try {
    const before = await getImportBatchPreview(req.params.batchId);
    const result = await cancelImportBatch(req.params.batchId);

    await writeAuditLog({
      user: req.user,
      action: "DELETE_IMPORT_BATCH",
      entity: "ImportBatch",
      entityId: req.params.batchId,
      before: before.batch,
      after: result,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

