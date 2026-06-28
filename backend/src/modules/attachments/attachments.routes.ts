import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { AttachmentOwnerType } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

export const attachmentsRouter = Router();
attachmentsRouter.use(requireAuth);

const uploadDir = path.resolve(process.cwd(), env.uploadDir);
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`),
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

attachmentsRouter.post("/", upload.single("file"), async (req, res, next) => {
  try {
    const body = z.object({ ownerType: z.nativeEnum(AttachmentOwnerType), ownerId: z.string().min(1) }).parse(req.body);
    if (!req.file) return res.status(400).json({ message: "File is required" });
    const data = await prisma.attachment.create({
      data: {
        ownerType: body.ownerType,
        ownerId: body.ownerId,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        path: req.file.path,
      },
    });
    res.status(201).json(data);
  } catch (error) { next(error); }
});

attachmentsRouter.get("/:ownerType/:ownerId", async (req, res, next) => {
  try {
    const data = await prisma.attachment.findMany({
      where: { ownerType: req.params.ownerType as AttachmentOwnerType, ownerId: req.params.ownerId },
      orderBy: { uploadedAt: "desc" },
    });
    res.json(data);
  } catch (error) { next(error); }
});
