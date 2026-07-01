import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Request } from "express";
import { HttpError } from "./http.js";

type UploadedFileCandidate = {
  originalname: string;
  mimetype: string;
};

type UploadPolicy = {
  label: string;
  allowedExtensions: readonly string[];
  allowedMimeTypes: readonly string[];
  allowOctetStream?: boolean;
};

type MulterFileFilterCallback = (error: Error | null, acceptFile?: boolean) => void;

export const MAX_ATTACHMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export const ATTACHMENT_FILE_POLICY: UploadPolicy = {
  label: "Attachment",
  allowedExtensions: [
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".txt",
    ".csv",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
  ],
  allowedMimeTypes: [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "text/plain",
    "text/csv",
    "application/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  allowOctetStream: true,
};

export const EXCEL_IMPORT_POLICY: UploadPolicy = {
  label: "Excel import",
  allowedExtensions: [".xlsx"],
  allowedMimeTypes: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  allowOctetStream: true,
};

function normalizeExtension(extension: string) {
  return extension.trim().toLowerCase();
}

export function safeOriginalName(originalName: string) {
  const base = path.basename(originalName || "file");
  const rawExt = path.extname(base);
  const rawStem = path.basename(base, rawExt);

  const safeExt = normalizeExtension(rawExt).replace(/[^a-z0-9.]/g, "").slice(0, 20);
  const safeStem = rawStem
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/[^a-zA-Z0-9 ._\-()]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

  return `${safeStem || "file"}${safeExt}`;
}

function getSafeExtension(originalName: string) {
  return normalizeExtension(path.extname(safeOriginalName(originalName)));
}

export function ensureUploadDir(uploadDir: string, ...segments: string[]) {
  const resolved = path.resolve(process.cwd(), uploadDir, ...segments);
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

function validateFileCandidate(file: UploadedFileCandidate, policy: UploadPolicy) {
  const extension = getSafeExtension(file.originalname);
  const allowedExtensions = policy.allowedExtensions.map(normalizeExtension);

  if (!allowedExtensions.includes(extension)) {
    throw new HttpError(400, `${policy.label} file type is not allowed.`);
  }

  const mimeType = (file.mimetype || "").toLowerCase();
  const allowedMimeTypes = policy.allowedMimeTypes.map((item) => item.toLowerCase());

  if (!allowedMimeTypes.includes(mimeType)) {
    const isAllowedOctetStream = policy.allowOctetStream && mimeType === "application/octet-stream";

    if (!isAllowedOctetStream) {
      throw new HttpError(400, `${policy.label} MIME type is not allowed.`);
    }
  }
}

export function createSafeStoredName(file: UploadedFileCandidate, policy: UploadPolicy) {
  validateFileCandidate(file, policy);
  const extension = getSafeExtension(file.originalname);
  return `${Date.now()}-${crypto.randomUUID()}${extension}`;
}

export function createMulterFileFilter(policy: UploadPolicy) {
  return (_req: Request, file: UploadedFileCandidate, cb: MulterFileFilterCallback) => {
    try {
      validateFileCandidate(file, policy);
      cb(null, true);
    } catch (error) {
      cb(error instanceof Error ? error : new HttpError(400, "Invalid upload file."), false);
    }
  };
}
