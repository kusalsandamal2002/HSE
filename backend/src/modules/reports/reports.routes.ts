import { Router } from "express";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { getDashboardSummary } from "../dashboard/dashboard.service";
import { monthRange, toNumber, toStringValue } from "../../utils/http";

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