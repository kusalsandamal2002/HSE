-- CreateTable
CREATE TABLE "TfTsMetric" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "tfTotal" INTEGER NOT NULL DEFAULT 0,
    "tfRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tsTotal" INTEGER NOT NULL DEFAULT 0,
    "tsRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT,
    "periodLabel" TEXT,
    "tracked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TfTsMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TfTsMetric_year_key" ON "TfTsMetric"("year");