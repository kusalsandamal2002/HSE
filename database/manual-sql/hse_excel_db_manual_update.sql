-- HSE/ESG Manual Database Update for Excel Coverage
-- Non-destructive update. Existing data delete කරන්නේ නැහැ.

BEGIN;

ALTER TABLE "Incident"
ADD COLUMN IF NOT EXISTS "sourceFile" TEXT,
ADD COLUMN IF NOT EXISTS "sourceSheet" TEXT,
ADD COLUMN IF NOT EXISTS "sourceRow" INTEGER,
ADD COLUMN IF NOT EXISTS "sourceHash" TEXT,
ADD COLUMN IF NOT EXISTS "rawExcelJson" JSONB,
ADD COLUMN IF NOT EXISTS "monthlyLostMinutes" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "quarterlyLostMinutes" INTEGER DEFAULT 0;

ALTER TABLE "CorrectiveAction"
ADD COLUMN IF NOT EXISTS "sourceFile" TEXT,
ADD COLUMN IF NOT EXISTS "sourceSheet" TEXT,
ADD COLUMN IF NOT EXISTS "sourceRow" INTEGER,
ADD COLUMN IF NOT EXISTS "sourceHash" TEXT,
ADD COLUMN IF NOT EXISTS "rawExcelJson" JSONB;

ALTER TABLE "MedicalExpense"
ADD COLUMN IF NOT EXISTS "sourceFile" TEXT,
ADD COLUMN IF NOT EXISTS "sourceSheet" TEXT,
ADD COLUMN IF NOT EXISTS "sourceRow" INTEGER,
ADD COLUMN IF NOT EXISTS "sourceHash" TEXT,
ADD COLUMN IF NOT EXISTS "rawExcelJson" JSONB;

ALTER TABLE "Observation"
ADD COLUMN IF NOT EXISTS "sourceFile" TEXT,
ADD COLUMN IF NOT EXISTS "sourceSheet" TEXT,
ADD COLUMN IF NOT EXISTS "sourceRow" INTEGER,
ADD COLUMN IF NOT EXISTS "sourceHash" TEXT,
ADD COLUMN IF NOT EXISTS "rawExcelJson" JSONB;

CREATE TABLE IF NOT EXISTS "HseAccidentDepartmentSummary" (
  "id" TEXT PRIMARY KEY,
  "year" INTEGER NOT NULL,
  "departmentName" TEXT NOT NULL,
  "firstAidCount" INTEGER NOT NULL DEFAULT 0,
  "medicalCount" INTEGER NOT NULL DEFAULT 0,
  "reportableCount" INTEGER NOT NULL DEFAULT 0,
  "lostHoursExcel" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "lostHoursCalculated" NUMERIC(12,2),
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "sourceHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "HseAccidentDepartmentSummary_year_departmentName_key"
ON "HseAccidentDepartmentSummary"("year", "departmentName");

CREATE TABLE IF NOT EXISTS "HseAccidentMonthlySummary" (
  "id" TEXT PRIMARY KEY,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "departmentName" TEXT NOT NULL,
  "firstAidCount" INTEGER NOT NULL DEFAULT 0,
  "medicalCount" INTEGER NOT NULL DEFAULT 0,
  "reportableCount" INTEGER NOT NULL DEFAULT 0,
  "lostHoursExcel" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "lostHoursCalculated" NUMERIC(12,2),
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "sourceHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "HseAccidentMonthlySummary_year_month_departmentName_key"
ON "HseAccidentMonthlySummary"("year", "month", "departmentName");

CREATE TABLE IF NOT EXISTS "HseWorkingLostHoursSummary" (
  "id" TEXT PRIMARY KEY,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "workingHours" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "lostHoursExcel" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "lostHoursCalculated" NUMERIC(12,2),
  "lostHoursPercent" NUMERIC(12,6) NOT NULL DEFAULT 0,
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "sourceHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "HseWorkingLostHoursSummary_year_month_key"
ON "HseWorkingLostHoursSummary"("year", "month");

CREATE TABLE IF NOT EXISTS "HseMedicalMonthlySummary" (
  "id" TEXT PRIMARY KEY,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "amount" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "sourceHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "HseMedicalMonthlySummary_year_month_key"
ON "HseMedicalMonthlySummary"("year", "month");

CREATE TABLE IF NOT EXISTS "HseMedicalDepartmentSummary" (
  "id" TEXT PRIMARY KEY,
  "year" INTEGER NOT NULL,
  "departmentName" TEXT NOT NULL,
  "amount" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "sourceHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "HseMedicalDepartmentSummary_year_departmentName_key"
ON "HseMedicalDepartmentSummary"("year", "departmentName");

CREATE TABLE IF NOT EXISTS "HseNearMissMonthlySummary" (
  "id" TEXT PRIMARY KEY,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "hseTeamCount" INTEGER NOT NULL DEFAULT 0,
  "shopFloorCount" INTEGER NOT NULL DEFAULT 0,
  "completedCount" INTEGER NOT NULL DEFAULT 0,
  "pendingCount" INTEGER NOT NULL DEFAULT 0,
  "totalReported" INTEGER NOT NULL DEFAULT 0,
  "sourceFile" TEXT,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "sourceHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "HseNearMissMonthlySummary_year_month_key"
ON "HseNearMissMonthlySummary"("year", "month");

CREATE TABLE IF NOT EXISTS "ExcelDataValidationResult" (
  "id" TEXT PRIMARY KEY,
  "sourceFile" TEXT NOT NULL,
  "workbookType" TEXT NOT NULL,
  "checkKey" TEXT NOT NULL,
  "checkLabel" TEXT NOT NULL,
  "excelValue" TEXT,
  "databaseValue" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "severity" TEXT NOT NULL DEFAULT 'INFO',
  "message" TEXT,
  "detailsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ExcelDataValidationResult_sourceFile_idx"
ON "ExcelDataValidationResult"("sourceFile");

CREATE INDEX IF NOT EXISTS "ExcelDataValidationResult_status_severity_idx"
ON "ExcelDataValidationResult"("status", "severity");

CREATE UNIQUE INDEX IF NOT EXISTS "ExcelDataValidationResult_source_check_key"
ON "ExcelDataValidationResult"("sourceFile", "checkKey");

COMMIT;
