-- CreateTable
CREATE TABLE "EsgDashboardSnapshot" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "sourcePath" TEXT,
    "sourceSheet" TEXT,
    "periodLabel" TEXT NOT NULL,
    "tracked" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EsgDashboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EsgDashboardSnapshot_year_key" ON "EsgDashboardSnapshot"("year");
