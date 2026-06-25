import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export type EsgTrendPoint = {
  label: string;
  year: number;
  value: number;
};

export type EsgNoisePoint = {
  label: string;
  year: number;
  day: number;
  dayStandard: number;
  night: number;
  nightStandard: number;
};

export type EsgConcernPoint = {
  name: string;
  count: number;
};

export type EsgDashboardSummary = {
  year: number;
  sourceFile: string | null;
  sourcePath: string | null;
  sourceSheet: string | null;
  periodLabel: string;
  tracked: boolean;
  importedAt: string | null;
  kpis: {
    ghgIntensity: { value: number; target: number; label: string; status: string };
    scrapFlashWaste: { value: number; target: number; label: string; status: string };
    wasteRecycling: { value: number; target: number; label: string; status: string };
    externalNoiseDay: { value: number; standard: number; label: string; status: string };
    externalNoiseNight: { value: number; standard: number; label: string; status: string };
    tf: { total: number; rate: number; label: string; periodLabel: string; source: string; status: string };
    ts: { total: number; rate: number; label: string; periodLabel: string; source: string; status: string };
    stakeholderConcerns: { total: number; label: string; topConcern: EsgConcernPoint | null; status: string };
  };
  charts: {
    ghgIntensityTrend: EsgTrendPoint[];
    scrapFlashWasteTrend: EsgTrendPoint[];
    wasteRecyclingTrend: EsgTrendPoint[];
    noiseTrend: EsgNoisePoint[];
    tfTrend: EsgTrendPoint[];
    tsTrend: EsgTrendPoint[];
    stakeholderConcerns: EsgConcernPoint[];
  };
};

export type EsgSnapshotMeta = {
  year: number;
  sourceFile: string;
  sourcePath: string | null;
  sourceSheet: string | null;
  periodLabel: string;
  tracked: boolean;
  updatedAt: string;
};

type EsgDashboardResponse = EsgDashboardSummary & {
  availableYears: number[];
  snapshots: EsgSnapshotMeta[];
};

function emptySummary(year: number, availableYears: number[] = []): EsgDashboardResponse {
  return {
    year,
    sourceFile: null,
    sourcePath: null,
    sourceSheet: null,
    periodLabel: "Not tracked",
    tracked: false,
    importedAt: null,
    kpis: {
      ghgIntensity: { value: 0, target: 0, label: "Not tracked", status: "Not tracked" },
      scrapFlashWaste: { value: 0, target: 0, label: "Not tracked", status: "Not tracked" },
      wasteRecycling: { value: 0, target: 0, label: "Not tracked", status: "Not tracked" },
      externalNoiseDay: { value: 0, standard: 0, label: "Not tracked", status: "Not tracked" },
      externalNoiseNight: { value: 0, standard: 0, label: "Not tracked", status: "Not tracked" },
      tf: { total: 0, rate: 0, label: "Not tracked", periodLabel: "Not tracked", source: "Not tracked", status: "Not tracked" },
      ts: { total: 0, rate: 0, label: "Not tracked", periodLabel: "Not tracked", source: "Not tracked", status: "Not tracked" },
      stakeholderConcerns: { total: 0, label: "Not tracked", topConcern: null, status: "Not tracked" },
    },
    charts: {
      ghgIntensityTrend: [],
      scrapFlashWasteTrend: [],
      wasteRecyclingTrend: [],
      noiseTrend: [],
      tfTrend: [],
      tsTrend: [],
      stakeholderConcerns: [],
    },
    availableYears,
    snapshots: [],
  };
}

function mapSnapshotMeta(snapshot: {
  year: number;
  sourceFile: string;
  sourcePath: string | null;
  sourceSheet: string | null;
  periodLabel: string;
  tracked: boolean;
  updatedAt: Date;
}): EsgSnapshotMeta {
  return {
    year: snapshot.year,
    sourceFile: snapshot.sourceFile,
    sourcePath: snapshot.sourcePath,
    sourceSheet: snapshot.sourceSheet,
    periodLabel: snapshot.periodLabel,
    tracked: snapshot.tracked,
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

function normalizeSummaryPayload(payload: Prisma.JsonValue | null | undefined, year: number): EsgDashboardSummary {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return emptySummary(year);
  }

  const candidate = payload as Partial<EsgDashboardSummary>;
  return {
    year: candidate.year || year,
    sourceFile: candidate.sourceFile ?? null,
    sourcePath: candidate.sourcePath ?? null,
    sourceSheet: candidate.sourceSheet ?? null,
    periodLabel: candidate.periodLabel || "Not tracked",
    tracked: Boolean(candidate.tracked),
    importedAt: candidate.importedAt ?? null,
    kpis: {
      ghgIntensity: candidate.kpis?.ghgIntensity || { value: 0, target: 0, label: "Not tracked", status: "Not tracked" },
      scrapFlashWaste: candidate.kpis?.scrapFlashWaste || { value: 0, target: 0, label: "Not tracked", status: "Not tracked" },
      wasteRecycling: candidate.kpis?.wasteRecycling || { value: 0, target: 0, label: "Not tracked", status: "Not tracked" },
      externalNoiseDay: candidate.kpis?.externalNoiseDay || { value: 0, standard: 0, label: "Not tracked", status: "Not tracked" },
      externalNoiseNight: candidate.kpis?.externalNoiseNight || { value: 0, standard: 0, label: "Not tracked", status: "Not tracked" },
      tf: candidate.kpis?.tf || { total: 0, rate: 0, label: "Not tracked", periodLabel: "Not tracked", source: "Not tracked", status: "Not tracked" },
      ts: candidate.kpis?.ts || { total: 0, rate: 0, label: "Not tracked", periodLabel: "Not tracked", source: "Not tracked", status: "Not tracked" },
      stakeholderConcerns: candidate.kpis?.stakeholderConcerns || { total: 0, label: "Not tracked", topConcern: null, status: "Not tracked" },
    },
    charts: {
      ghgIntensityTrend: candidate.charts?.ghgIntensityTrend || [],
      scrapFlashWasteTrend: candidate.charts?.scrapFlashWasteTrend || [],
      wasteRecyclingTrend: candidate.charts?.wasteRecyclingTrend || [],
      noiseTrend: candidate.charts?.noiseTrend || [],
      tfTrend: candidate.charts?.tfTrend || [],
      tsTrend: candidate.charts?.tsTrend || [],
      stakeholderConcerns: candidate.charts?.stakeholderConcerns || [],
    },
  };
}

export async function getEsgDashboard(year?: number): Promise<EsgDashboardResponse> {
  const snapshots = await prisma.esgDashboardSnapshot.findMany({ orderBy: { year: "desc" } });
  const availableYears = snapshots.map((snapshot) => snapshot.year);
  const selectedYear = year || availableYears[0] || new Date().getFullYear();
  const snapshot = snapshots.find((item) => item.year === selectedYear) || snapshots[0] || null;

  if (!snapshot) {
    return emptySummary(selectedYear, availableYears);
  }

  const summary = normalizeSummaryPayload(snapshot.payload, snapshot.year);
  return {
    ...summary,
    availableYears,
    snapshots: snapshots.map(mapSnapshotMeta),
  };
}

export async function listEsgSnapshots(): Promise<EsgSnapshotMeta[]> {
  const snapshots = await prisma.esgDashboardSnapshot.findMany({ orderBy: { year: "desc" } });
  return snapshots.map(mapSnapshotMeta);
}
