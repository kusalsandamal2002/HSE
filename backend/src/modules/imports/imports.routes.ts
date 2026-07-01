import { Router } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { ADMIN_ONLY_ROLES, IMPORT_APPROVE_ROLES, IMPORT_UPLOAD_ROLES, requireAuth, requireRole } from "../../middleware/auth.js";
import { HttpError, toNumber, toStringValue } from "../../utils/http.js";
import { writeAuditLog } from "../../utils/audit.js";
import {
  EXCEL_IMPORT_POLICY,
  MAX_IMPORT_FILE_SIZE_BYTES,
  createMulterFileFilter,
  createSafeStoredName,
  ensureUploadDir,
  safeOriginalName,
} from "../../utils/upload-security.js";
import {
  approveImportBatch,
  cancelImportBatch,
  getImportBatchPreview,
  listImportHistory,
  uploadImportBatch,
} from "./imports.service.js";

export const importsRouter = Router();

const uploadDir = ensureUploadDir(env.uploadDir, "imports");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    try {
      cb(null, createSafeStoredName(file, EXCEL_IMPORT_POLICY));
    } catch (error) {
      cb(error instanceof Error ? error : new HttpError(400, "Invalid Excel import file."), "");
    }
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_IMPORT_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: createMulterFileFilter(EXCEL_IMPORT_POLICY),
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
          originalName: safeOriginalName(req.file.originalname),
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
