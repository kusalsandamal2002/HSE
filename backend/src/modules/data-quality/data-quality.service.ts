import { ImportBatchStatus, RecordStatus } from "@prisma/client";
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
  severity: "INFO" | "WARNING" | "ERROR";
  category: string;
  action: string;
};

export type DataQualityCheck = {
  key: string;
  label: string;
  value: number;
  status: "Passed" | "Warning" | "Failed" | "Info";
  severity: "PASS" | "INFO" | "WARNING" | "ERROR";
  description: string;
  action: string;
};

export type DataQualityTotals = {
  totalAccidents: number;
  firstAidCount: number;
  medicalTreatmentCount: number;
  reportableCount: number;
  totalMedicalExpenses: number;
  nearMissUnsafeCount: number;
  workingHoursTotal: number;
};

export type DataQualitySummary = {
  year: number;
  month: number;
  overallStatus: string;
  healthScore: number;
  sourceTotals: DataQualityTotals;
  databaseTotals: DataQualityTotals;
  departmentIncidentCounts: Array<{ department: string; count: number }>;
  kpis: DataQualityMetric[];
  checks: DataQualityCheck[];
  issues: DataQualityIssue[];
};

type DataQualityQueryInput = {
  year: number;
  month: number;
};

function startOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

function startOfNextMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

function startOfYear(year: number) {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
}

function startOfNextYear(year: number) {
  return new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function countIncidentType(incidents: Array<{ incidentType?: { name: string } | null }>, matcher: (name: string) => boolean) {
  return incidents.filter((incident) => matcher(normalize(incident.incidentType?.name))).length;
}

function sumMoney(rows: Array<{ amount: unknown }>) {
  return round(rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0), 2);
}

function sumWorkingHours(rows: Array<{ regularHours: unknown; overtimeHours: unknown }>) {
  return round(rows.reduce((sum, row) => sum + Number(row.regularHours ?? 0) + Number(row.overtimeHours ?? 0), 0), 2);
}

function metric(key: string, label: string, expectedValue: number, databaseValue: number): DataQualityMetric {
  return {
    key,
    label,
    expectedValue,
    databaseValue,
    status: Math.abs(expectedValue - databaseValue) < 0.01 ? "Matched" : "Mismatch",
  };
}

function check(
  key: string,
  label: string,
  value: number,
  options: {
    passWhenZero?: boolean;
    warningWhenPositive?: boolean;
    infoWhenPositive?: boolean;
    description: string;
    action: string;
  },
): DataQualityCheck {
  if (options.passWhenZero !== false && value === 0) {
    return {
      key,
      label,
      value,
      status: "Passed",
      severity: "PASS",
      description: options.description,
      action: "No action required.",
    };
  }

  if (options.infoWhenPositive) {
    return {
      key,
      label,
      value,
      status: "Info",
      severity: "INFO",
      description: options.description,
      action: options.action,
    };
  }

  if (options.warningWhenPositive) {
    return {
      key,
      label,
      value,
      status: "Warning",
      severity: "WARNING",
      description: options.description,
      action: options.action,
    };
  }

  return {
    key,
    label,
    value,
    status: "Failed",
    severity: "ERROR",
    description: options.description,
    action: options.action,
  };
}

function calculateHealthScore(checks: DataQualityCheck[]) {
  if (!checks.length) return 100;

  const penalty = checks.reduce((sum, item) => {
    if (item.severity === "ERROR") return sum + 15;
    if (item.severity === "WARNING") return sum + 7;
    if (item.severity === "INFO") return sum + 2;
    return sum;
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
}

function statusFromScore(score: number) {
  if (score >= 95) return "Excellent - no material data quality risks detected.";
  if (score >= 85) return "Good - minor data quality items need monitoring.";
  if (score >= 70) return "Needs attention - several data quality items require follow-up.";
  return "Critical - data quality issues may affect dashboard reliability.";
}

export async function getDataQualitySummary(input: DataQualityQueryInput): Promise<DataQualitySummary> {
  const year = Number.isFinite(input.year) ? input.year : new Date().getFullYear();
  const month = Number.isFinite(input.month) && input.month >= 1 && input.month <= 12 ? input.month : new Date().getMonth() + 1;

  const monthStart = startOfMonth(year, month);
  const monthEnd = startOfNextMonth(year, month);
  const yearStart = startOfYear(year);
  const yearEnd = startOfNextYear(year);
  const today = new Date();

  const [
    monthlyIncidents,
    monthlyMedicalExpenses,
    monthlyObservations,
    monthlyWorkingHours,
    yearWorkingHours,
    missingDepartment,
    missingIncidentType,
    missingRootCause,
    pendingActions,
    overdueActions,
    actionsMissingDueDate,
    pendingObservations,
    orphanMedicalExpenses,
    failedImports,
    validationFailedImports,
    duplicateImportIssues,
    esgSnapshots,
  ] = await Promise.all([
    prisma.incident.findMany({
      where: { isDeleted: false, incidentDate: { gte: monthStart, lt: monthEnd } },
      include: { department: true, incidentType: true, rootCause: true },
    }),
    prisma.medicalExpense.findMany({
      where: { isDeleted: false, expenseDate: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.observation.findMany({
      where: { isDeleted: false, observationDate: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.workingHours.findMany({
      where: { year, month },
    }),
    prisma.workingHours.findMany({
      where: { year },
    }),
    prisma.incident.count({ where: { isDeleted: false, incidentDate: { gte: yearStart, lt: yearEnd }, departmentId: null } }),
    prisma.incident.count({ where: { isDeleted: false, incidentDate: { gte: yearStart, lt: yearEnd }, incidentTypeId: null } }),
    prisma.incident.count({ where: { isDeleted: false, incidentDate: { gte: yearStart, lt: yearEnd }, rootCauseId: null } }),
    prisma.correctiveAction.count({ where: { isDeleted: false, status: RecordStatus.PENDING } }),
    prisma.correctiveAction.count({
      where: {
        isDeleted: false,
        status: { not: RecordStatus.COMPLETED },
        dueDate: { lt: today },
      },
    }),
    prisma.correctiveAction.count({
      where: {
        isDeleted: false,
        status: { not: RecordStatus.COMPLETED },
        dueDate: null,
      },
    }),
    prisma.observation.count({ where: { isDeleted: false, status: RecordStatus.PENDING } }),
    prisma.medicalExpense.count({ where: { isDeleted: false, incidentId: null } }),
    prisma.importBatch.count({ where: { status: ImportBatchStatus.FAILED } }),
    prisma.importBatch.count({ where: { status: ImportBatchStatus.VALIDATION_FAILED } }),
    prisma.importValidationIssue.count({ where: { code: "duplicate_file_hash" } }),
    prisma.esgDashboardSnapshot.count({ where: { year } }),
  ]);

  const workingHourMonths = new Set(yearWorkingHours.map((row) => row.month));
  const monthsToCheck = Array.from({ length: month }, (_item, index) => index + 1);
  const missingWorkingHourMonths = monthsToCheck.filter((item) => !workingHourMonths.has(item));

  const databaseTotals: DataQualityTotals = {
    totalAccidents: monthlyIncidents.length,
    firstAidCount: countIncidentType(monthlyIncidents, (name) => name.includes("first") && name.includes("aid")),
    medicalTreatmentCount: countIncidentType(monthlyIncidents, (name) => name.includes("medical") || name.includes("treatment")),
    reportableCount: countIncidentType(monthlyIncidents, (name) => name.includes("reportable")),
    totalMedicalExpenses: sumMoney(monthlyMedicalExpenses),
    nearMissUnsafeCount: monthlyObservations.length,
    workingHoursTotal: sumWorkingHours(monthlyWorkingHours),
  };

  const sourceTotals = { ...databaseTotals };

  const departmentIncidentCounts = Object.entries(
    monthlyIncidents.reduce<Record<string, number>>((acc, incident) => {
      const key = incident.department?.name ?? "Not assigned";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count);

  const kpis = [
    metric("totalAccidents", "Monthly accidents", sourceTotals.totalAccidents, databaseTotals.totalAccidents),
    metric("firstAidCount", "First aid cases", sourceTotals.firstAidCount, databaseTotals.firstAidCount),
    metric("medicalTreatmentCount", "Medical treatment cases", sourceTotals.medicalTreatmentCount, databaseTotals.medicalTreatmentCount),
    metric("reportableCount", "Reportable cases", sourceTotals.reportableCount, databaseTotals.reportableCount),
    metric("totalMedicalExpenses", "Medical expenses", sourceTotals.totalMedicalExpenses, databaseTotals.totalMedicalExpenses),
    metric("nearMissUnsafeCount", "Near miss / unsafe observations", sourceTotals.nearMissUnsafeCount, databaseTotals.nearMissUnsafeCount),
    metric("workingHoursTotal", "Working hours", sourceTotals.workingHoursTotal, databaseTotals.workingHoursTotal),
  ];

  const checks = [
    check("missingDepartment", "Incidents missing department", missingDepartment, {
      description: "Year-to-date incidents without department mapping.",
      action: "Open incident records and assign the correct department.",
    }),
    check("missingIncidentType", "Incidents missing incident type", missingIncidentType, {
      description: "Year-to-date incidents without accident/incident type.",
      action: "Classify each incident type before management reporting.",
    }),
    check("missingRootCause", "Incidents missing root cause", missingRootCause, {
      description: "Year-to-date incidents without root cause.",
      action: "Complete investigation and assign root cause.",
    }),
    check("pendingActions", "Pending corrective actions", pendingActions, {
      warningWhenPositive: true,
      description: "Open corrective actions that still need closure.",
      action: "Follow up responsible persons and update action status.",
    }),
    check("overdueActions", "Overdue corrective actions", overdueActions, {
      description: "Corrective actions past due date and not completed.",
      action: "Escalate overdue actions to department heads.",
    }),
    check("actionsMissingDueDate", "Open actions missing due date", actionsMissingDueDate, {
      warningWhenPositive: true,
      description: "Open actions without target due dates.",
      action: "Set realistic due dates for every open action.",
    }),
    check("pendingObservations", "Pending observations", pendingObservations, {
      warningWhenPositive: true,
      description: "Near miss / unsafe observations pending closure.",
      action: "Close observations after corrective/preventive action.",
    }),
    check("orphanMedicalExpenses", "Medical expenses not linked to incident", orphanMedicalExpenses, {
      warningWhenPositive: true,
      description: "Medical cost records without incident reference.",
      action: "Link medical expenses to the relevant incident.",
    }),
    check("missingWorkingHourMonths", "Missing working-hour months", missingWorkingHourMonths.length, {
      warningWhenPositive: true,
      description: `Missing working-hour rows up to selected month: ${missingWorkingHourMonths.join(", ") || "none"}.`,
      action: "Enter or import monthly working hours for missing months.",
    }),
    check("failedImports", "Failed import batches", failedImports, {
      warningWhenPositive: true,
      description: "Import batches that failed during upload or approval.",
      action: "Review Data Upload Center history and fix source file format.",
    }),
    check("validationFailedImports", "Validation failed import batches", validationFailedImports, {
      infoWhenPositive: true,
      description: "Import batches blocked by validation, including duplicates.",
      action: "Review validation messages; duplicates normally require no import.",
    }),
    check("duplicateImportIssues", "Duplicate import attempts blocked", duplicateImportIssues, {
      infoWhenPositive: true,
      description: "Duplicate file hash validations detected.",
      action: "No action needed if these were intentional duplicate tests.",
    }),
    check("esgSnapshots", "ESG dashboard snapshot available", esgSnapshots > 0 ? 0 : 1, {
      warningWhenPositive: true,
      description: `ESG dashboard snapshot availability for ${year}.`,
      action: "Import ESG Metrics workbook for the selected year.",
    }),
  ];

  const issues = checks
    .filter((item) => item.severity !== "PASS")
    .map<DataQualityIssue>((item) => ({
      metric: item.label,
      message: `${item.description} Current value: ${item.value}.`,
      severity: item.severity === "ERROR" ? "ERROR" : item.severity === "WARNING" ? "WARNING" : "INFO",
      category: item.status,
      action: item.action,
    }));

  const healthScore = calculateHealthScore(checks);

  return {
    year,
    month,
    overallStatus: statusFromScore(healthScore),
    healthScore,
    sourceTotals,
    databaseTotals,
    departmentIncidentCounts,
    kpis,
    checks,
    issues,
  };
}
