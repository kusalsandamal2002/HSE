-- CreateTable
CREATE TABLE "CompanyProfileField" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL DEFAULT 'text',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfileField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfileField_key_key" ON "CompanyProfileField"("key");

-- CreateIndex
CREATE INDEX "CompanyProfileField_section_sortOrder_idx" ON "CompanyProfileField"("section", "sortOrder");
