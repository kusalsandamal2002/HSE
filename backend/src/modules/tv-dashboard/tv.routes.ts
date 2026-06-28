import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { getDashboardSummary } from "../dashboard/dashboard.service.js";
import { nullableId } from "../../utils/schema.js";

export const tvDashboardRouter = Router();

async function getOrCreateSettings() {
  const existing = await prisma.tvDashboardSettings.findFirst();
  if (existing) return existing;
  return prisma.tvDashboardSettings.create({ data: { selectedYear: new Date().getFullYear() } });
}

const nullWhenBlank = (value: unknown) => value === "" ? null : value;

const settingsSchema = z.object({
  companyName: z.string().trim().min(1).optional(),
  dashboardTitle: z.string().trim().min(1).optional(),
  intervalSeconds: z.coerce.number().int().min(5).max(120).optional(),
  languageMode: z.enum(["EN", "SINHALA", "TAMIL", "TRILINGUAL"]).optional(),
  displayMode: z.enum(["AUTO", "SUMMARY", "DETAIL"]).optional(),
  showClock: z.boolean().optional(),
  showCounter: z.boolean().optional(),
  autoAdvance: z.boolean().optional(),
  selectedYear: z.preprocess(nullWhenBlank, z.coerce.number().int().min(2000).max(2100).nullable().optional()),
  selectedMonth: z.preprocess(nullWhenBlank, z.coerce.number().int().min(1).max(12).nullable().optional()),
  selectedDepartmentId: nullableId,
});

tvDashboardRouter.get("/settings", requireAuth, async (_req, res, next) => {
  try { res.json(await getOrCreateSettings()); }
  catch (error) { next(error); }
});

tvDashboardRouter.put("/settings", requireAuth, async (req, res, next) => {
  try {
    const body = settingsSchema.parse(req.body);
    const settings = await getOrCreateSettings();
    const data = await prisma.tvDashboardSettings.update({ where: { id: settings.id }, data: body });
    res.json(data);
  } catch (error) { next(error); }
});

tvDashboardRouter.get("/public", async (_req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    const year = settings.selectedYear || new Date().getFullYear();
    const month = settings.selectedMonth || undefined;
    const dashboard = await getDashboardSummary({ year, month, departmentId: settings.selectedDepartmentId || undefined });
    res.json({
      settings,
      generatedAt: new Date().toISOString(),
      dashboard,
      slides: [
        { key: "summary", title: "HSE Performance Summary", value: dashboard.kpis.totalIncidents, subtitle: "Total incidents recorded", unit: "incidents" },
        { key: "first-aid", title: "First Aid Injuries", value: dashboard.kpis.firstAid, subtitle: "First aid cases", unit: "cases" },
        { key: "medical", title: "Medical Treatment", value: dashboard.kpis.medicalTreatment, subtitle: "Medical treatment cases", unit: "cases" },
        { key: "lost-hours", title: "Lost Time Hours", value: dashboard.kpis.totalLostHours, subtitle: "Total lost work hours", unit: "hours" },
        { key: "expenses", title: "Medical Expenses", value: dashboard.kpis.medicalExpenseTotal, subtitle: "Total medical cost", unit: "LKR" },
        { key: "afr", title: "AFR", value: dashboard.kpis.afr, subtitle: "Accident frequency rate", unit: "" },
        { key: "actions", title: "Corrective Actions", value: dashboard.kpis.pendingActions, subtitle: "Pending / in progress actions", unit: "actions" },
        { key: "observations", title: "Near Miss & Unsafe Conditions", value: dashboard.kpis.observations, subtitle: "Safety observations recorded", unit: "records" },
      ],
    });
  } catch (error) { next(error); }
});
