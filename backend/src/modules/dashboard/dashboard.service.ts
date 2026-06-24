import { ObservationType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { monthRange } from "../../utils/http";

export type DashboardFilters = {
  year?: number;
  month?: number;
  departmentId?: string;
};

function incidentWhere(filters: DashboardFilters): Prisma.IncidentWhereInput {
  return {
    isDeleted: false,
    incidentDate: monthRange(filters.year, filters.month),
    departmentId: filters.departmentId,
  };
}

function observationWhere(filters: DashboardFilters): Prisma.ObservationWhereInput {
  return {
    isDeleted: false,
    observationDate: monthRange(filters.year, filters.month),
    departmentId: filters.departmentId,
  };
}

function nearMissUnsafeObservationWhere(filters: DashboardFilters): Prisma.ObservationWhereInput {
  return {
    ...observationWhere(filters),
    type: { in: [ObservationType.NEAR_MISS, ObservationType.UNSAFE_CONDITION, ObservationType.UNSAFE_ACT] },
  };
}

function actionWhere(filters: DashboardFilters): Prisma.CorrectiveActionWhereInput {
  const scoped = Boolean(filters.year || filters.month || filters.departmentId);
  const base: Prisma.CorrectiveActionWhereInput = { isDeleted: false };
  if (!scoped) return base;

  return {
    ...base,
    OR: [
      { incident: incidentWhere(filters) },
      { observation: observationWhere(filters) },
    ],
  };
}

function workingHoursWhere(filters: DashboardFilters, companyOnly = false): Prisma.WorkingHoursWhereInput {
  return {
    year: filters.year,
    month: filters.month,
    departmentId: filters.departmentId || (companyOnly ? null : undefined),
  };
}

function monthName(month: number) {
  return new Date(Date.UTC(2026, month - 1, 1)).toLocaleString("en", { month: "short", timeZone: "UTC" });
}

function chartMonths(filters: DashboardFilters) {
  return filters.month ? [filters.month] : Array.from({ length: 12 }, (_, index) => index + 1);
}

function emptyMonthlyRow(month: number) {
  return {
    month,
    label: monthName(month),
    incidents: 0,
    firstAid: 0,
    medicalTreatment: 0,
    reportable: 0,
    lostTimeIncidents: 0,
    medicalExpense: 0,
    lostHours: 0,
    nearMiss: 0,
    unsafeCondition: 0,
    nearMissUnsafe: 0,
    hseTeam: 0,
    shopFloor: 0,
    observationCompleted: 0,
    observationPending: 0,
    workingHours: 0,
    afr: 0,
  };
}

function incidentTypeBucket(name?: string | null) {
  const value = (name || "").toLowerCase();
  if (value.includes("first") || value.includes("1st")) return "firstAid";
  if (value.includes("medical")) return "medicalTreatment";
  if (value.includes("report")) return "reportable";
  return "other";
}


type TfTsSummary = {
  tfTotal: number;
  tfRate: number;
  tsTotal: number;
  tsRate: number;
  tfTsSource: string | null;
  tfTsPeriod: string | null;
  tfTsTracked: boolean;
};

function emptyTfTsSummary(): TfTsSummary {
  return {
    tfTotal: 0,
    tfRate: 0,
    tsTotal: 0,
    tsRate: 0,
    tfTsSource: null,
    tfTsPeriod: null,
    tfTsTracked: false,
  };
}

async function readTfTsSummary(year: number): Promise<TfTsSummary> {
  try {
    const metric = await prisma.tfTsMetric.findUnique({ where: { year } });
    if (!metric || !metric.tracked || !metric.source || !metric.periodLabel) {
      return emptyTfTsSummary();
    }

    return {
      tfTotal: metric.tfTotal || 0,
      tfRate: Number(metric.tfRate || 0),
      tsTotal: metric.tsTotal || 0,
      tsRate: Number(metric.tsRate || 0),
      tfTsSource: metric.source,
      tfTsPeriod: metric.periodLabel,
      tfTsTracked: true,
    };
  } catch {
    return emptyTfTsSummary();
  }
}

async function getWorkingHoursTotal(filters: DashboardFilters) {
  if (filters.departmentId) {
    const departmentHours = await prisma.workingHours.aggregate({
      where: workingHoursWhere(filters),
      _sum: { regularHours: true, overtimeHours: true },
    });
    return Number(departmentHours._sum.regularHours || 0) + Number(departmentHours._sum.overtimeHours || 0);
  }

  const companyHours = await prisma.workingHours.aggregate({
    where: workingHoursWhere(filters, true),
    _sum: { regularHours: true, overtimeHours: true },
  });
  const companyTotal = Number(companyHours._sum.regularHours || 0) + Number(companyHours._sum.overtimeHours || 0);
  if (companyTotal > 0) return companyTotal;

  const allHours = await prisma.workingHours.aggregate({
    where: workingHoursWhere(filters),
    _sum: { regularHours: true, overtimeHours: true },
  });
  return Number(allHours._sum.regularHours || 0) + Number(allHours._sum.overtimeHours || 0);
}

async function getWorkingHoursByMonth(year: number, departmentId?: string) {
  const totals = Array.from({ length: 12 }, () => 0);

  if (departmentId) {
    const rows = await prisma.workingHours.groupBy({
      by: ["month"],
      where: { year, departmentId },
      _sum: { regularHours: true, overtimeHours: true },
    });
    for (const row of rows) {
      totals[row.month - 1] = Number(row._sum.regularHours || 0) + Number(row._sum.overtimeHours || 0);
    }
    return totals;
  }

  const [companyRows, departmentRows] = await Promise.all([
    prisma.workingHours.groupBy({
      by: ["month"],
      where: { year, departmentId: null },
      _sum: { regularHours: true, overtimeHours: true },
    }),
    prisma.workingHours.groupBy({
      by: ["month"],
      where: { year, departmentId: { not: null } },
      _sum: { regularHours: true, overtimeHours: true },
    }),
  ]);

  const departmentFallback = new Map<number, number>();
  for (const row of departmentRows) {
    departmentFallback.set(row.month, Number(row._sum.regularHours || 0) + Number(row._sum.overtimeHours || 0));
  }

  for (let month = 1; month <= 12; month += 1) {
    totals[month - 1] = departmentFallback.get(month) || 0;
  }
  for (const row of companyRows) {
    totals[row.month - 1] = Number(row._sum.regularHours || 0) + Number(row._sum.overtimeHours || 0);
  }

  return totals;
}

export async function getDashboardSummary(filters: DashboardFilters) {
  const year = filters.year || new Date().getFullYear();
  const scopedFilters: DashboardFilters = { ...filters, year };
  const where = incidentWhere(scopedFilters);
  const obsWhere = nearMissUnsafeObservationWhere(scopedFilters);
  const actionBaseWhere = actionWhere(scopedFilters);

  const [
    totalIncidents,
    lostTimeIncidents,
    firstAid,
    medicalTreatment,
    reportable,
    expenseAgg,
    lostMinutesAgg,
    observations,
    nearMissObservations,
    unsafeConditions,
    pendingActions,
    overdueActions,
    totalWorkingHours,
    byDepartment,
    byRootCause,
    byIncidentType,
    byInjuryType,
    byActionStatus,
    departmentIncidentRows,
    monthlyIncidents,
    monthlyExpenses,
    medicalExpenseDepartmentRows,
    monthlyObservations,
    workingHoursByMonth,
  ] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.count({ where: { ...where, lostMinutes: { gt: 0 } } }),
    prisma.incident.count({ where: { ...where, incidentType: { name: { contains: "First", mode: "insensitive" } } } }),
    prisma.incident.count({ where: { ...where, incidentType: { name: { contains: "Medical", mode: "insensitive" } } } }),
    prisma.incident.count({ where: { ...where, incidentType: { name: { contains: "Report", mode: "insensitive" } } } }),
    prisma.incident.aggregate({ where, _sum: { medicalExpenseTotal: true } }),
    prisma.incident.aggregate({ where, _sum: { lostMinutes: true } }),
    prisma.observation.count({ where: obsWhere }),
    prisma.observation.count({ where: { ...obsWhere, type: ObservationType.NEAR_MISS } }),
    prisma.observation.count({ where: { ...obsWhere, type: { in: [ObservationType.UNSAFE_CONDITION, ObservationType.UNSAFE_ACT] } } }),
    prisma.correctiveAction.count({ where: { ...actionBaseWhere, status: { in: ["PENDING", "IN_PROGRESS"] } } }),
    prisma.correctiveAction.count({ where: { ...actionBaseWhere, dueDate: { lt: new Date() }, status: { in: ["PENDING", "IN_PROGRESS"] } } }),
    getWorkingHoursTotal(scopedFilters),
    prisma.incident.groupBy({ by: ["departmentId"], where, _count: { _all: true }, _sum: { lostMinutes: true, medicalExpenseTotal: true } }),
    prisma.incident.groupBy({ by: ["rootCauseId"], where, _count: { _all: true } }),
    prisma.incident.groupBy({ by: ["incidentTypeId"], where, _count: { _all: true } }),
    prisma.incident.groupBy({ by: ["injuryTypeId"], where, _count: { _all: true } }),
    prisma.correctiveAction.groupBy({ by: ["status"], where: actionBaseWhere, _count: { _all: true } }),
    prisma.incident.findMany({
      where,
      select: {
        departmentId: true,
        department: { select: { name: true } },
        incidentType: { select: { name: true } },
        lostMinutes: true,
        medicalExpenseTotal: true,
      },
    }),
    prisma.incident.findMany({
      where: { isDeleted: false, incidentDate: monthRange(year, scopedFilters.month), departmentId: scopedFilters.departmentId },
      select: { incidentDate: true, lostMinutes: true, incidentType: { select: { name: true } } },
    }),
    prisma.medicalExpense.findMany({
      where: { isDeleted: false, expenseDate: monthRange(year, scopedFilters.month), incident: scopedFilters.departmentId ? { departmentId: scopedFilters.departmentId } : undefined },
      select: { expenseDate: true, amount: true },
    }),
    prisma.medicalExpense.findMany({
      where: { isDeleted: false, expenseDate: monthRange(year, scopedFilters.month), incident: scopedFilters.departmentId ? { departmentId: scopedFilters.departmentId } : undefined },
      select: { amount: true, incident: { select: { departmentId: true, department: { select: { name: true } } } } },
    }),
    prisma.observation.findMany({
      where: { isDeleted: false, observationDate: monthRange(year, scopedFilters.month), departmentId: scopedFilters.departmentId, type: { in: [ObservationType.NEAR_MISS, ObservationType.UNSAFE_CONDITION, ObservationType.UNSAFE_ACT] } },
      select: { observationDate: true, type: true, reportedBy: true, status: true },
    }),
    getWorkingHoursByMonth(year, scopedFilters.departmentId),
  ]);

  const lookupIds = {
    departmentIds: byDepartment.map((x: any) => x.departmentId).filter(Boolean) as string[],
    rootCauseIds: byRootCause.map((x: any) => x.rootCauseId).filter(Boolean) as string[],
    incidentTypeIds: byIncidentType.map((x: any) => x.incidentTypeId).filter(Boolean) as string[],
    injuryTypeIds: byInjuryType.map((x: any) => x.injuryTypeId).filter(Boolean) as string[],
  };

  const [departments, rootCauses, incidentTypes, injuryTypes] = await Promise.all([
    lookupIds.departmentIds.length ? prisma.department.findMany({ where: { id: { in: lookupIds.departmentIds } } }) : [],
    lookupIds.rootCauseIds.length ? prisma.rootCause.findMany({ where: { id: { in: lookupIds.rootCauseIds } } }) : [],
    lookupIds.incidentTypeIds.length ? prisma.incidentType.findMany({ where: { id: { in: lookupIds.incidentTypeIds } } }) : [],
    lookupIds.injuryTypeIds.length ? prisma.injuryType.findMany({ where: { id: { in: lookupIds.injuryTypeIds } } }) : [],
  ]);

  const afr = totalWorkingHours > 0 ? Number(((totalIncidents * 200000) / totalWorkingHours).toFixed(2)) : 0;

  const monthlyTrend = chartMonths(scopedFilters).map((month) => emptyMonthlyRow(month));
  const monthlyByMonth = new Map(monthlyTrend.map((row) => [row.month, row]));

  for (const item of monthlyIncidents) {
    const row = monthlyByMonth.get(item.incidentDate.getUTCMonth() + 1);
    if (!row) continue;
    row.incidents += 1;
    row.lostHours = Number((row.lostHours + (item.lostMinutes || 0) / 60).toFixed(2));
    if ((item.lostMinutes || 0) > 0) row.lostTimeIncidents += 1;

    const bucket = incidentTypeBucket(item.incidentType?.name);
    if (bucket === "firstAid") row.firstAid += 1;
    if (bucket === "medicalTreatment") row.medicalTreatment += 1;
    if (bucket === "reportable") row.reportable += 1;
  }

  for (const item of monthlyExpenses) {
    const row = monthlyByMonth.get(item.expenseDate.getUTCMonth() + 1);
    if (row) row.medicalExpense += Number(item.amount || 0);
  }

  for (const item of monthlyObservations) {
    const row = monthlyByMonth.get(item.observationDate.getUTCMonth() + 1);
    if (!row) continue;
    if (item.type === ObservationType.NEAR_MISS) row.nearMiss += 1;
    if (item.type === ObservationType.UNSAFE_CONDITION || item.type === ObservationType.UNSAFE_ACT) row.unsafeCondition += 1;
    const reporter = (item.reportedBy || "").toLowerCase();
    if (reporter.includes("shop")) row.shopFloor += 1;
    else if (reporter.includes("hse")) row.hseTeam += 1;
    if (["COMPLETED", "CLOSED"].includes(item.status)) row.observationCompleted += 1;
    else row.observationPending += 1;
    row.nearMissUnsafe += 1;
  }

  for (const row of monthlyTrend) {
    row.workingHours = workingHoursByMonth[row.month - 1] || 0;
    row.afr = row.workingHours > 0 ? Number(((row.incidents * 200000) / row.workingHours).toFixed(2)) : 0;
  }

  const departmentMap = new Map<string, string>(departments.map((d: any) => [String(d.id), String(d.name)]));
  const rootCauseMap = new Map<string, string>(rootCauses.map((r: any) => [String(r.id), String(r.name)]));
  const incidentTypeMap = new Map<string, string>(incidentTypes.map((i: any) => [String(i.id), String(i.name)]));
  const injuryTypeMap = new Map<string, string>(injuryTypes.map((i: any) => [String(i.id), String(i.name)]));

  type NamedCount = { id: string | null; name: string; count: number };
  type DepartmentSummary = NamedCount & { lostHours: number; medicalExpense: number };

  const sortCountDesc = <T extends { count: number }>(items: T[]): T[] => items.sort((a, b) => b.count - a.count);
  const departmentSummary: DepartmentSummary[] = sortCountDesc(byDepartment.map((x: any): DepartmentSummary => ({ id: x.departmentId, name: x.departmentId ? departmentMap.get(x.departmentId) || "Unknown" : "Unassigned", count: x._count._all, lostHours: Number(((x._sum.lostMinutes || 0) / 60).toFixed(2)), medicalExpense: Number(x._sum.medicalExpenseTotal || 0) })));
  const rootCauseSummary: NamedCount[] = sortCountDesc(byRootCause.map((x: any): NamedCount => ({ id: x.rootCauseId, name: x.rootCauseId ? rootCauseMap.get(x.rootCauseId) || "Unknown" : "Unassigned", count: x._count._all })));
  const incidentTypeSummary: NamedCount[] = sortCountDesc(byIncidentType.map((x: any): NamedCount => ({ id: x.incidentTypeId, name: x.incidentTypeId ? incidentTypeMap.get(x.incidentTypeId) || "Unknown" : "Unassigned", count: x._count._all })));
  const injuryTypeSummary: NamedCount[] = sortCountDesc(byInjuryType.map((x: any): NamedCount => ({ id: x.injuryTypeId, name: x.injuryTypeId ? injuryTypeMap.get(x.injuryTypeId) || "Unknown" : "Unassigned", count: x._count._all })));

  const departmentAccidentMap = new Map<string, {
    id: string | null;
    name: string;
    count: number;
    firstAid: number;
    medicalTreatment: number;
    reportable: number;
    lostTimeIncidents: number;
    lostHours: number;
    medicalExpense: number;
  }>();

  for (const item of departmentSummary) {
    const key = item.id || "unassigned";
    departmentAccidentMap.set(key, {
      id: item.id,
      name: item.name,
      count: item.count,
      firstAid: 0,
      medicalTreatment: 0,
      reportable: 0,
      lostTimeIncidents: 0,
      lostHours: item.lostHours,
      medicalExpense: item.medicalExpense,
    });
  }

  for (const row of departmentIncidentRows) {
    const key = row.departmentId || "unassigned";
    const existing = departmentAccidentMap.get(key) || {
      id: row.departmentId,
      name: row.department?.name || "Unassigned",
      count: 0,
      firstAid: 0,
      medicalTreatment: 0,
      reportable: 0,
      lostTimeIncidents: 0,
      lostHours: 0,
      medicalExpense: 0,
    };
    if (!departmentAccidentMap.has(key)) {
      existing.count += 1;
      existing.lostHours = Number((existing.lostHours + (row.lostMinutes || 0) / 60).toFixed(2));
      existing.medicalExpense += Number(row.medicalExpenseTotal || 0);
      departmentAccidentMap.set(key, existing);
    }

    const bucket = incidentTypeBucket(row.incidentType?.name);
    if (bucket === "firstAid") existing.firstAid += 1;
    if (bucket === "medicalTreatment") existing.medicalTreatment += 1;
    if (bucket === "reportable") existing.reportable += 1;
    if ((row.lostMinutes || 0) > 0) existing.lostTimeIncidents += 1;
  }

  const departmentAccidentSummary = Array.from(departmentAccidentMap.values()).sort((a, b) => b.count - a.count || b.lostHours - a.lostHours);
  const departmentLostHours = departmentAccidentSummary
    .map((item) => ({ id: item.id, name: item.name, lostHours: item.lostHours, count: item.count }))
    .sort((a, b) => b.lostHours - a.lostHours || b.count - a.count);

  const medicalExpenseByDepartmentMap = new Map<string, { id: string | null; name: string; medicalExpense: number }>();
  for (const row of medicalExpenseDepartmentRows) {
    const id = row.incident?.departmentId || "unassigned";
    const existing = medicalExpenseByDepartmentMap.get(id) || {
      id: row.incident?.departmentId || null,
      name: row.incident?.department?.name || "Unassigned",
      medicalExpense: 0,
    };
    existing.medicalExpense += Number(row.amount || 0);
    medicalExpenseByDepartmentMap.set(id, existing);
  }
  const medicalExpenseByDepartment = Array.from(medicalExpenseByDepartmentMap.values())
    .sort((a, b) => b.medicalExpense - a.medicalExpense)
    .filter((item) => item.medicalExpense > 0);

  const actionStatusCounts = new Map<string, number>(byActionStatus.map((x: any) => [x.status, Number(x._count._all)]));
  const correctiveActionStatus = [
    { name: "Pending", count: actionStatusCounts.get("PENDING") || 0 },
    { name: "In Progress", count: actionStatusCounts.get("IN_PROGRESS") || 0 },
    { name: "Completed", count: (actionStatusCounts.get("COMPLETED") || 0) + (actionStatusCounts.get("CLOSED") || 0) },
    { name: "Overdue", count: Number(overdueActions || 0) + (actionStatusCounts.get("OVERDUE") || 0) },
  ];
  const accidentTypeBreakdown = [
    { name: "First Aid", count: firstAid },
    { name: "Medical", count: medicalTreatment },
    { name: "Reportable", count: reportable },
    { name: "Lost Time", count: lostTimeIncidents },
  ];
  const nearMissUnsafeBreakdown = [
    { name: "Near Miss", count: nearMissObservations },
    { name: "Unsafe Condition", count: unsafeConditions },
  ];
  const workingHoursTrend = monthlyTrend.map((item) => ({ month: item.month, label: item.label, workingHours: item.workingHours, lostHours: item.lostHours, incidents: item.incidents, afr: item.afr }));
  const afrTrend = workingHoursTrend.map((item) => ({ month: item.month, label: item.label, afr: item.afr }));
  const lostHoursTrend = monthlyTrend.map((item) => ({ month: item.month, label: item.label, lostHours: item.lostHours, lostTimeIncidents: item.lostTimeIncidents }));
  const nearMissUnsafeTrend = monthlyTrend.map((item) => ({ month: item.month, label: item.label, nearMiss: item.nearMiss, unsafeCondition: item.unsafeCondition, total: item.nearMissUnsafe }));
  const nearMissUnsafeSourceTrend = monthlyTrend.map((item) => ({ month: item.month, label: item.label, hseTeam: item.hseTeam, shopFloor: item.shopFloor, total: item.nearMissUnsafe }));
  const nearMissUnsafeClosureTrend = monthlyTrend.map((item) => ({ month: item.month, label: item.label, completed: item.observationCompleted, pending: item.observationPending, total: item.nearMissUnsafe }));
  const monthlyKpiSummary = monthlyTrend.map((item) => ({
    month: item.month,
    label: item.label,
    incidents: item.incidents,
    firstAid: item.firstAid,
    medicalTreatment: item.medicalTreatment,
    reportable: item.reportable,
    lostTimeIncidents: item.lostTimeIncidents,
    lostHours: item.lostHours,
    medicalExpense: item.medicalExpense,
    nearMissUnsafe: item.nearMissUnsafe,
    workingHours: item.workingHours,
    afr: item.afr,
  }));
  const tfTsSummary = await readTfTsSummary(year);

  return {
    filters: { year, month: scopedFilters.month, departmentId: scopedFilters.departmentId },
    kpis: {
      totalIncidents,
      firstAid,
      medicalTreatment,
      reportable,
      lostTimeIncidents,
      totalLostHours: Number(((lostMinutesAgg._sum.lostMinutes || 0) / 60).toFixed(2)),
      medicalExpenseTotal: Number(expenseAgg._sum.medicalExpenseTotal || 0),
      observations,
      nearMissObservations,
      unsafeConditions,
      pendingActions,
      overdueActions,
      totalWorkingHours,
      afr,
      ...tfTsSummary,
    },
    charts: {
      monthlyTrend,
      monthlyKpiSummary,
      medicalExpenseTrend: monthlyTrend.map((item) => ({ month: item.month, label: item.label, medicalExpense: item.medicalExpense })),
      workingHoursTrend,
      lostHoursTrend,
      afrTrend,
      nearMissUnsafeTrend,
      nearMissUnsafeSourceTrend,
      nearMissUnsafeClosureTrend,
      nearMissUnsafeBreakdown,
      accidentTypeBreakdown,
      accidentTypeSummary: accidentTypeBreakdown,
      departmentSummary,
      departmentAccidentSummary,
      departmentLostHours,
      medicalExpenseByDepartment,
      rootCauseSummary,
      injuryTypeBreakdown: injuryTypeSummary,
      injuryTypeSummary,
      correctiveActionStatus,
      byDepartment: departmentSummary,
      byRootCause: rootCauseSummary,
      byIncidentType: incidentTypeSummary,
      byInjuryType: injuryTypeSummary,
      byActionStatus: correctiveActionStatus,
    },
  };
}







