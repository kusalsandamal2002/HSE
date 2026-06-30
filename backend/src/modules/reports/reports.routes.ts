import { Router } from "express";
import { Prisma } from "@prisma/client";
import { ADMIN_ONLY_ROLES, requireAuth, requireRole } from "../../middleware/auth.js";
import { prisma } from "../../lib/prisma.js";
import { getDashboardSummary } from "../dashboard/dashboard.service.js";
import { monthRange, toNumber, toStringValue } from "../../utils/http.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

function incidentWhere(year: number, month?: number, departmentId?: string): Prisma.IncidentWhereInput {
  return { isDeleted: false, incidentDate: monthRange(year, month), departmentId };
}

function observationWhere(year: number, month?: number, departmentId?: string): Prisma.ObservationWhereInput {
  return { isDeleted: false, observationDate: monthRange(year, month), departmentId };
}

function actionWhere(year: number, month?: number, departmentId?: string): Prisma.CorrectiveActionWhereInput {
  return {
    isDeleted: false,
    OR: [
      { incident: incidentWhere(year, month, departmentId) },
      { observation: observationWhere(year, month, departmentId) },
    ],
  };
}

reportsRouter.get("/monthly", async (req, res, next) => {
  try {
    const year = toNumber(req.query.year) || new Date().getFullYear();
    const month = toNumber(req.query.month) || new Date().getMonth() + 1;
    const departmentId = toStringValue(req.query.departmentId);
    const filters = { year, month, departmentId };
    const dashboard = await getDashboardSummary(filters);
    const [incidents, actions, expenses, observations, workingHours] = await Promise.all([
      prisma.incident.findMany({ where: incidentWhere(year, month, departmentId), include: { department: true, employee: true, incidentType: true, injuryType: true, rootCause: true }, orderBy: { incidentDate: "asc" } }),
      prisma.correctiveAction.findMany({ where: actionWhere(year, month, departmentId), include: { incident: true, observation: true }, orderBy: { dueDate: "asc" } }),
      prisma.medicalExpense.findMany({ where: { isDeleted: false, expenseDate: monthRange(year, month), incident: departmentId ? { departmentId } : undefined }, include: { incident: { include: { department: true } } }, orderBy: { expenseDate: "asc" } }),
      prisma.observation.findMany({ where: observationWhere(year, month, departmentId), include: { department: true }, orderBy: { observationDate: "asc" } }),
      prisma.workingHours.findMany({ where: { year, month, departmentId }, include: { department: true } }),
    ]);
    res.json({ reportType: "MONTHLY_HSE_REPORT", generatedAt: new Date().toISOString(), filters, dashboard, incidents, actions, expenses, observations, workingHours });
  } catch (error) { next(error); }
});

reportsRouter.get("/yearly", async (req, res, next) => {
  try {
    const year = toNumber(req.query.year) || new Date().getFullYear();
    const departmentId = toStringValue(req.query.departmentId);
    const filters = { year, departmentId };
    const dashboard = await getDashboardSummary(filters);
    const [incidents, actions, expenses, observations, workingHours] = await Promise.all([
      prisma.incident.findMany({ where: incidentWhere(year, undefined, departmentId), include: { department: true, employee: true, incidentType: true, injuryType: true, rootCause: true }, orderBy: { incidentDate: "asc" } }),
      prisma.correctiveAction.findMany({ where: actionWhere(year, undefined, departmentId), include: { incident: true, observation: true }, orderBy: { dueDate: "asc" } }),
      prisma.medicalExpense.findMany({ where: { isDeleted: false, expenseDate: monthRange(year), incident: departmentId ? { departmentId } : undefined }, include: { incident: { include: { department: true } } }, orderBy: { expenseDate: "asc" } }),
      prisma.observation.findMany({ where: observationWhere(year, undefined, departmentId), include: { department: true }, orderBy: { observationDate: "asc" } }),
      prisma.workingHours.findMany({ where: { year, departmentId }, include: { department: true }, orderBy: { month: "asc" } }),
    ]);
    res.json({ reportType: "YEARLY_HSE_REPORT", generatedAt: new Date().toISOString(), filters, dashboard, incidents, actions, expenses, observations, workingHours });
  } catch (error) { next(error); }
});
reportsRouter.get("/backup/system", requireRole(ADMIN_ONLY_ROLES), async (_req, res, next) => {
  try {
    const generatedAt = new Date();
    const stamp = generatedAt.toISOString().slice(0, 19).replace(/[:T]/g, "-");

    const [
      users,
      departments,
      shifts,
      employees,
      machines,
      incidentTypes,
      injuryTypes,
      rootCauses,
      incidents,
      correctiveActions,
      medicalExpenses,
      observations,
      workingHours,
      tvSettings,
      tfTsMetrics,
      esgSnapshots,
      companyProfileFields,
      importBatches,
    ] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.department.findMany({ orderBy: { name: "asc" } }),
      prisma.shift.findMany({ orderBy: { name: "asc" } }),
      prisma.employee.findMany({ include: { department: true, shift: true }, orderBy: { name: "asc" } }),
      prisma.machine.findMany({ include: { department: true }, orderBy: { name: "asc" } }),
      prisma.incidentType.findMany({ orderBy: { name: "asc" } }),
      prisma.injuryType.findMany({ orderBy: { name: "asc" } }),
      prisma.rootCause.findMany({ orderBy: { name: "asc" } }),
      prisma.incident.findMany({
        include: {
          department: true,
          shift: true,
          employee: true,
          machine: true,
          incidentType: true,
          injuryType: true,
          rootCause: true,
          correctiveActions: true,
          medicalExpenses: true,
        },
        orderBy: [{ incidentDate: "desc" }, { createdAt: "desc" }],
      }),
      prisma.correctiveAction.findMany({
        include: { incident: true, observation: true },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      }),
      prisma.medicalExpense.findMany({
        include: { incident: { include: { department: true } } },
        orderBy: { expenseDate: "desc" },
      }),
      prisma.observation.findMany({
        include: { department: true, correctiveActions: true },
        orderBy: [{ observationDate: "desc" }, { createdAt: "desc" }],
      }),
      prisma.workingHours.findMany({
        include: { department: true },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      }),
      prisma.tvDashboardSettings.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.tfTsMetric.findMany({ orderBy: { year: "desc" } }),
      prisma.esgDashboardSnapshot.findMany({ orderBy: { year: "desc" } }),
      prisma.companyProfileField.findMany({ orderBy: [{ section: "asc" }, { sortOrder: "asc" }] }),
      prisma.importBatch.findMany({
        include: {
          file: true,
          detectedSections: true,
          previewRows: true,
          validationIssues: true,
        },
        orderBy: { uploadedAt: "desc" },
        take: 100,
      }),
    ]);

    const payload = {
      backupType: "FULL_SYSTEM_JSON_BACKUP",
      generatedAt: generatedAt.toISOString(),
      application: "HSE Management System",
      note: "This is a JSON export backup for reporting/audit/archive use. It does not include user password hashes.",
      data: {
        users,
        masterData: {
          departments,
          shifts,
          employees,
          machines,
          incidentTypes,
          injuryTypes,
          rootCauses,
        },
        hse: {
          incidents,
          correctiveActions,
          medicalExpenses,
          observations,
          workingHours,
        },
        esg: {
          tfTsMetrics,
          esgSnapshots,
        },
        companyProfile: {
          companyProfileFields,
        },
        tvDashboard: {
          tvSettings,
        },
        imports: {
          importBatches,
        },
      },
    };

    res.setHeader("Content-Disposition", `attachment; filename="hse-full-system-backup-${stamp}.json"`);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

