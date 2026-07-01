import { Router } from "express";
import { RecordStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ADMIN_ONLY_ROLES, DATA_WRITE_ROLES, requireAuth, requireRole } from "../../middleware/auth.js";
import { generateCode, toStringValue } from "../../utils/http.js";
import { nullableId, nullableText } from "../../utils/schema.js";
import { writeAuditLog } from "../../utils/audit.js";

export const actionsRouter = Router();
actionsRouter.use(requireAuth);

const schema = z.object({
  actionNo: z.string().optional(),
  incidentId: nullableId,
  observationId: nullableId,
  action: z.string().min(1),
  responsiblePerson: nullableText,
  dueDate: nullableText,
  completedDate: nullableText,
  status: z.nativeEnum(RecordStatus).default("PENDING"),
  remarks: nullableText,
});

const include = { incident: { include: { department: true } }, observation: { include: { department: true } } };

actionsRouter.get("/", async (req, res, next) => {
  try {
    const data = await prisma.correctiveAction.findMany({
      where: {
        isDeleted: false,
        status: toStringValue(req.query.status) as RecordStatus | undefined,
        incidentId: toStringValue(req.query.incidentId),
        observationId: toStringValue(req.query.observationId),
      },
      include,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });
    res.json(data);
  } catch (error) { next(error); }
});

actionsRouter.post("/", requireRole(DATA_WRITE_ROLES), async (req, res, next) => {
  try {
    const body = schema.parse(req.body);
    const data = await prisma.correctiveAction.create({
      data: {
        ...body,
        actionNo: body.actionNo || generateCode("CA"),
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        completedDate: body.completedDate ? new Date(body.completedDate) : undefined,
      },
      include,
    });

    await writeAuditLog({
      user: req.user,
      action: "CREATE_CORRECTIVE_ACTION",
      entity: "CorrectiveAction",
      entityId: data.id,
      after: data,
    });

    res.status(201).json(data);
  } catch (error) { next(error); }
});

actionsRouter.put("/:id", requireRole(DATA_WRITE_ROLES), async (req, res, next) => {
  try {
    const body = schema.partial().parse(req.body);
    const before = await prisma.correctiveAction.findUnique({ where: { id: req.params.id } });

    const data = await prisma.correctiveAction.update({
      where: { id: req.params.id },
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : body.dueDate === null ? null : undefined,
        completedDate: body.completedDate ? new Date(body.completedDate) : body.completedDate === null ? null : undefined,
      },
      include,
    });

    await writeAuditLog({
      user: req.user,
      action: "UPDATE_CORRECTIVE_ACTION",
      entity: "CorrectiveAction",
      entityId: data.id,
      before,
      after: data,
    });

    res.json(data);
  } catch (error) { next(error); }
});

actionsRouter.delete("/:id", requireRole(ADMIN_ONLY_ROLES), async (req, res, next) => {
  try {
    const before = await prisma.correctiveAction.findUnique({ where: { id: req.params.id } });
    const data = await prisma.correctiveAction.update({ where: { id: req.params.id }, data: { isDeleted: true } });

    await writeAuditLog({
      user: req.user,
      action: "DELETE_CORRECTIVE_ACTION",
      entity: "CorrectiveAction",
      entityId: data.id,
      before,
      after: data,
    });

    res.json(data);
  } catch (error) { next(error); }
});
