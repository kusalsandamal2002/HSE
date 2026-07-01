import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { AttachmentOwnerType } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { DATA_WRITE_ROLES, requireAuth, requireRole } from "../../middleware/auth.js";
import { HttpError } from "../../utils/http.js";
import {
  ATTACHMENT_FILE_POLICY,
  MAX_ATTACHMENT_FILE_SIZE_BYTES,
  createMulterFileFilter,
  createSafeStoredName,
  ensureUploadDir,
  safeOriginalName,
} from "../../utils/upload-security.js";

export const attachmentsRouter = Router();
attachmentsRouter.use(requireAuth);

const uploadDir = ensureUploadDir(env.uploadDir, "attachments");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    try {
      cb(null, createSafeStoredName(file, ATTACHMENT_FILE_POLICY));
    } catch (error) {
      cb(error instanceof Error ? error : new HttpError(400, "Invalid upload file."), "");
    }
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_ATTACHMENT_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: createMulterFileFilter(ATTACHMENT_FILE_POLICY),
});

attachmentsRouter.post("/", requireRole(DATA_WRITE_ROLES), upload.single("file"), async (req, res, next) => {
  try {
    const body = z.object({
      ownerType: z.nativeEnum(AttachmentOwnerType),
      ownerId: z.string().min(1),
    }).parse(req.body);

    if (!req.file) {
      throw new HttpError(400, "File is required");
    }

    const data = await prisma.attachment.create({
      data: {
        ownerType: body.ownerType,
        ownerId: body.ownerId,
        originalName: safeOriginalName(req.file.originalname),
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        path: req.file.path,
      },
    });

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

attachmentsRouter.get("/:ownerType/:ownerId", async (req, res, next) => {
  try {
    const data = await prisma.attachment.findMany({
      where: {
        ownerType: req.params.ownerType as AttachmentOwnerType,
        ownerId: req.params.ownerId,
      },
      orderBy: { uploadedAt: "desc" },
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});
