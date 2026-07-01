import { Router } from "express";
import { Prisma, IncidentSeverity, RecordStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ADMIN_ONLY_ROLES, DATA_WRITE_ROLES, requireAuth, requireRole } from "../../middleware/auth.js";
import { generateCode, monthRange, toNumber, toStringValue } from "../../utils/http.js";
import { nullableId, nullableText } from "../../utils/schema.js";
import { writeAuditLog } from "../../utils/audit.js";

export const incidentsRouter = Router();
incidentsRouter.use(requireAuth);

const incidentSchema = z.object({
  incidentNo: z.string().min(1).optional(),
  incidentDate: z.string().min(1),
  incidentTime: nullableText,
  departmentId: nullableId,
  shiftId: nullableId,
  employeeId: nullableId,
  machineId: nullableId,
  incidentTypeId: nullableId,
  injuryTypeId: nullableId,
  rootCauseId: nullableId,
  description: z.string().min(1),
  immediateAction: nullableText,
  correctiveAction: nullableText,
  investigationSummary: nullableText,
  lostMinutes: z.coerce.number().int().nonnegative().default(0),
  medicalExpenseTotal: z.coerce.number().nonnegative().default(0),
  severity: z.nativeEnum(IncidentSeverity).default("LOW"),
  status: z.nativeEnum(RecordStatus).default("PENDING"),
});

const updateIncidentSchema = incidentSchema.partial();

function buildWhere(req: any): Prisma.IncidentWhereInput {
  const year = toNumber(req.query.year);
  const month = toNumber(req.query.month);
  return {
    isDeleted: false,
    incidentDate: monthRange(year, month),
    departmentId: toStringValue(req.query.departmentId),
    incidentTypeId: toStringValue(req.query.incidentTypeId),
    injuryTypeId: toStringValue(req.query.injuryTypeId),
    rootCauseId: toStringValue(req.query.rootCauseId),
    status: toStringValue(req.query.status) as RecordStatus | undefined,
  };
}

const include = {
  department: true,
  shift: true,
  employee: true,
  machine: true,
  incidentType: true,
  injuryType: true,
  rootCause: true,
  correctiveActions: { where: { isDeleted: false }, orderBy: { dueDate: "asc" as const } },
  medicalExpenses: { where: { isDeleted: false }, orderBy: { expenseDate: "desc" as const } },
};

incidentsRouter.get("/", async (req, res, next) => {
  try {
    const data = await prisma.incident.findMany({
      where: buildWhere(req),
      include,
      orderBy: [{ incidentDate: "desc" }, { createdAt: "desc" }],
      take: Math.min(toNumber(req.query.limit, 200) || 200, 1000),
    });
    res.json(data);
  } catch (error) { next(error); }
});

incidentsRouter.get("/:id", async (req, res, next) => {
  try {
    const data = await prisma.incident.findFirst({ where: { id: req.params.id, isDeleted: false }, include });
    if (!data) return res.status(404).json({ message: "Incident not found" });
    res.json(data);
  } catch (error) { next(error); }
});

incidentsRouter.post("/", requireRole(DATA_WRITE_ROLES), async (req, res, next) => {
  try {
    const body = incidentSchema.parse(req.body);
    const data = await prisma.incident.create({
      data: {
        ...body,
        incidentNo: body.incidentNo || generateCode("INC"),
        incidentDate: new Date(body.incidentDate),
        medicalExpenseTotal: body.medicalExpenseTotal,
        createdById: req.user?.id,
      },
      include,
    });
    await writeAuditLog({
      user: req.user,
      action: "CREATE_INCIDENT",
      entity: "Incident",
      entityId: data.id,
      after: data,
    });

    res.status(201).json(data);
  } catch (error) { next(error); }
});

incidentsRouter.put("/:id", requireRole(DATA_WRITE_ROLES), async (req, res, next) => {
  try {
    const body = updateIncidentSchema.parse(req.body);
    const before = await prisma.incident.findUnique({ where: { id: req.params.id } });
    const data = await prisma.incident.update({
      where: { id: req.params.id },
      data: {
        ...body,
        incidentDate: body.incidentDate ? new Date(body.incidentDate) : undefined,
      },
      include,
    });

    await writeAuditLog({
      user: req.user,
      action: "UPDATE_INCIDENT",
      entity: "Incident",
      entityId: data.id,
      before,
      after: data,
    });

    res.json(data);
  } catch (error) { next(error); }
});

incidentsRouter.delete("/:id", requireRole(ADMIN_ONLY_ROLES), async (req, res, next) => {
  try {
    const before = await prisma.incident.findUnique({ where: { id: req.params.id } });
    const data = await prisma.incident.update({ where: { id: req.params.id }, data: { isDeleted: true } });

    await writeAuditLog({
      user: req.user,
      action: "DELETE_INCIDENT",
      entity: "Incident",
      entityId: data.id,
      before,
      after: data,
    });

    res.json(data);
  } catch (error) { next(error); }
});

