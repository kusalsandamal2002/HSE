import { prisma } from "../../lib/prisma.js";

export type DataQualityMetric = {
  key: string;
  label: string;
  expectedValue: number;
  databaseValue: number;
  status: "Matched" | "Mismatch";
};

export type DataQualityIssue = {
  metric: string;
  message: string;
};

export type DataQualitySummary = {
  year: number;
  month: number;
  overallStatus: "MATCHED" | "MISMATCH";
  sourceTotals: {
    totalAccidents: number;
    firstAidCount: number;
    medicalTreatmentCount: number;
    reportableCount: number;
    totalMedicalExpenses: number;
    nearMissUnsafeCount: number;
    workingHoursTotal: number;
  };
  databaseTotals: {
    totalAccidents: number;
    firstAidCount: number;
    medicalTreatmentCount: number;
    reportableCount: number;
    totalMedicalExpenses: number;
    nearMissUnsafeCount: number;
    workingHoursTotal: number;
  };
  departmentIncidentCounts: Array<{ department: string; count: number }>;
  kpis: DataQualityMetric[];
  issues: DataQualityIssue[];
};

type DataQualityQueryInput = {
  year: number;
  month: number;
};

export function buildDataQualityComparison(input: {
  year: number;
  month: number;
  sourceTotals: DataQualitySummary["sourceTotals"];
  databaseTotals: DataQualitySummary["databaseTotals"];
  departmentIncidentCounts: DataQualitySummary["departmentIncidentCounts"];
}): DataQualitySummary {
  const kpis: DataQualityMetric[] = [
    {
      key: "totalAccidents",
      label: "Total Accidents",
      expectedValue: input.sourceTotals.totalAccidents,
      databaseValue: input.databaseTotals.totalAccidents,
      status: input.sourceTotals.totalAccidents === input.databaseTotals.totalAccidents ? "Matched" : "Mismatch",
    },
    {
      key: "firstAidCount",
      label: "First Aid Count",
      expectedValue: input.sourceTotals.firstAidCount,
      databaseValue: input.databaseTotals.firstAidCount,
      status: input.sourceTotals.firstAidCount === input.databaseTotals.firstAidCount ? "Matched" : "Mismatch",
    },
    {
      key: "medicalTreatmentCount",
      label: "Medical Treatment Count",
      expectedValue: input.sourceTotals.medicalTreatmentCount,
      databaseValue: input.databaseTotals.medicalTreatmentCount,
      status: input.sourceTotals.medicalTreatmentCount === input.databaseTotals.medicalTreatmentCount ? "Matched" : "Mismatch",
    },
    {
      key: "reportableCount",
      label: "Reportable Count",
      expectedValue: input.sourceTotals.reportableCount,
      databaseValue: input.databaseTotals.reportableCount,
      status: input.sourceTotals.reportableCount === input.databaseTotals.reportableCount ? "Matched" : "Mismatch",
    },
    {
      key: "totalMedicalExpenses",
      label: "Medical Expenses",
      expectedValue: input.sourceTotals.totalMedicalExpenses,
      databaseValue: input.databaseTotals.totalMedicalExpenses,
      status: input.sourceTotals.totalMedicalExpenses === input.databaseTotals.totalMedicalExpenses ? "Matched" : "Mismatch",
    },
    {
      key: "nearMissUnsafeCount",
      label: "Near Miss / Unsafe",
      expectedValue: input.sourceTotals.nearMissUnsafeCount,
      databaseValue: input.databaseTotals.nearMissUnsafeCount,
      status: input.sourceTotals.nearMissUnsafeCount === input.databaseTotals.nearMissUnsafeCount ? "Matched" : "Mismatch",
    },
    {
      key: "workingHoursTotal",
      label: "Working Hours",
      expectedValue: input.sourceTotals.workingHoursTotal,
      databaseValue: input.databaseTotals.workingHoursTotal,
      status: input.sourceTotals.workingHoursTotal === input.databaseTotals.workingHoursTotal ? "Matched" : "Mismatch",
    },
  ];

  const issues: DataQualityIssue[] = kpis
    .filter((metric) => metric.status === "Mismatch")
    .map((metric) => ({
      metric: metric.key,
      message: `${metric.label} expected ${metric.expectedValue} but found ${metric.databaseValue}`,
    }));

  return {
    year: input.year,
    month: input.month,
    overallStatus: issues.length === 0 ? "MATCHED" : "MISMATCH",
    sourceTotals: input.sourceTotals,
    databaseTotals: input.databaseTotals,
    departmentIncidentCounts: input.departmentIncidentCounts,
    kpis,
    issues,
  };
}

async function getSourceTotals(input: DataQualityQueryInput) {
  const expectedDefaults: Record<string, { totalAccidents: number; firstAidCount: number; medicalTreatmentCount: number; reportableCount: number; totalMedicalExpenses: number; nearMissUnsafeCount: number; workingHoursTotal: number }> = {
    "2026-5": {
      totalAccidents: 13,
      firstAidCount: 2,
      medicalTreatmentCount: 11,
      reportableCount: 0,
      totalMedicalExpenses: 255620,
      nearMissUnsafeCount: 148,
      workingHoursTotal: 4000,
    },
  };

  return expectedDefaults[`${input.year}-${input.month}`] ?? {
    totalAccidents: 0,
    firstAidCount: 0,
    medicalTreatmentCount: 0,
    reportableCount: 0,
    totalMedicalExpenses: 0,
    nearMissUnsafeCount: 0,
    workingHoursTotal: 0,
  };
}

async function getDatabaseTotals(input: DataQualityQueryInput) {
  const startDate = new Date(Date.UTC(input.year, input.month - 1, 1));
  const endDate = new Date(Date.UTC(input.year, input.month, 1));

  const [incidentCount, firstAidCount, medicalTreatmentCount, reportableCount, expenseAgg, nearMissUnsafeCount, workingHoursAgg] = await Promise.all([
    prisma.incident.count({
      where: {
        incidentDate: { gte: startDate, lt: endDate },
        isDeleted: false,
      },
    }),
    prisma.incident.count({
      where: {
        incidentDate: { gte: startDate, lt: endDate },
        isDeleted: false,
        incidentType: { is: { name: "First Aid" } },
      },
    }),
    prisma.incident.count({
      where: {
        incidentDate: { gte: startDate, lt: endDate },
        isDeleted: false,
        incidentType: { is: { name: "Medical Treatment" } },
      },
    }),
    prisma.incident.count({
      where: {
        incidentDate: { gte: startDate, lt: endDate },
        isDeleted: false,
        incidentType: { is: { name: "Reportable" } },
      },
    }),
    prisma.incident.aggregate({
      where: {
        incidentDate: { gte: startDate, lt: endDate },
        isDeleted: false,
      },
      _sum: { medicalExpenseTotal: true },
    }),
    prisma.observation.count({
      where: {
        observationDate: { gte: startDate, lt: endDate },
        isDeleted: false,
        type: { in: ["NEAR_MISS", "UNSAFE_CONDITION", "UNSAFE_ACT"] },
      },
    }),
    prisma.workingHours.aggregate({
      where: { year: input.year, month: input.month },
      _sum: { regularHours: true, overtimeHours: true },
    }),
  ]);

  const regularHours = Number(workingHoursAgg._sum.regularHours || 0);
  const overtimeHours = Number(workingHoursAgg._sum.overtimeHours || 0);

  return {
    totalAccidents: incidentCount,
    firstAidCount,
    medicalTreatmentCount,
    reportableCount,
    totalMedicalExpenses: Number(expenseAgg._sum.medicalExpenseTotal || 0),
    nearMissUnsafeCount: nearMissUnsafeCount,
    workingHoursTotal: regularHours + overtimeHours,
  };
}

export async function getDataQualitySummary(input: DataQualityQueryInput): Promise<DataQualitySummary> {
  const [sourceTotals, databaseTotals, departmentIncidentCounts] = await Promise.all([
    getSourceTotals(input),
    getDatabaseTotals(input),
    prisma.$queryRaw<Array<{ department: string; count: number }>>`
      SELECT d.name AS department, COUNT(i.id)::int AS count
      FROM "Incident" i
      LEFT JOIN "Department" d ON d.id = i."departmentId"
      WHERE i."incidentDate" >= ${new Date(Date.UTC(input.year, input.month - 1, 1))}
        AND i."incidentDate" < ${new Date(Date.UTC(input.year, input.month, 1))}
        AND i."isDeleted" = false
      GROUP BY d.name
      ORDER BY count DESC
    `,
  ]);

  return buildDataQualityComparison({
    year: input.year,
    month: input.month,
    sourceTotals,
    databaseTotals,
    departmentIncidentCounts,
  });
}
