-- CreateEnum
CREATE TYPE "ImportWorkbookType" AS ENUM ('HSE_ACCIDENT_SUMMARY', 'ESG_METRICS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADED', 'SCANNED', 'VALIDATION_FAILED', 'READY_FOR_APPROVAL', 'APPROVED', 'IMPORTED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportIssueSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "ImportPreviewRowStatus" AS ENUM ('VALID', 'WARNING', 'REJECTED');

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "workbookType" "ImportWorkbookType" NOT NULL DEFAULT 'UNKNOWN',
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3),
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "validRowCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "summaryJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportFile" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportDetectedSection" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "sectionLabel" TEXT NOT NULL,
    "sheetName" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportDetectedSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportPreviewRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "rawJson" JSONB NOT NULL,
    "mappedJson" JSONB NOT NULL,
    "status" "ImportPreviewRowStatus" NOT NULL DEFAULT 'VALID',
    "validationJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportPreviewRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportValidationIssue" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sectionKey" TEXT,
    "severity" "ImportIssueSeverity" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportValidationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_fileHash_idx" ON "ImportBatch"("fileHash");

-- CreateIndex
CREATE INDEX "ImportBatch_workbookType_status_idx" ON "ImportBatch"("workbookType", "status");

-- CreateIndex
CREATE INDEX "ImportBatch_uploadedAt_idx" ON "ImportBatch"("uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportFile_batchId_key" ON "ImportFile"("batchId");

-- CreateIndex
CREATE INDEX "ImportFile_sha256_idx" ON "ImportFile"("sha256");

-- CreateIndex
CREATE INDEX "ImportDetectedSection_batchId_sectionKey_idx" ON "ImportDetectedSection"("batchId", "sectionKey");

-- CreateIndex
CREATE INDEX "ImportPreviewRow_batchId_sectionKey_rowIndex_idx" ON "ImportPreviewRow"("batchId", "sectionKey", "rowIndex");

-- CreateIndex
CREATE INDEX "ImportValidationIssue_batchId_severity_idx" ON "ImportValidationIssue"("batchId", "severity");

-- AddForeignKey
ALTER TABLE "ImportFile" ADD CONSTRAINT "ImportFile_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportDetectedSection" ADD CONSTRAINT "ImportDetectedSection_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportPreviewRow" ADD CONSTRAINT "ImportPreviewRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportValidationIssue" ADD CONSTRAINT "ImportValidationIssue_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
