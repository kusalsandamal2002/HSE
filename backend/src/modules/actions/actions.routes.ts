import { Router } from "express";
import { RecordStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ADMIN_ONLY_ROLES, DATA_WRITE_ROLES, requireAuth, requireRole } from "../../middleware/auth.js";
import { generateCode, toStringValue } from "../../utils/http.js";
import { nullableId, nullableText } from "../../utils/schema.js";

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
      }, include,
    });
    res.status(201).json(data);
  } catch (error) { next(error); }
});

actionsRouter.put("/:id", requireRole(DATA_WRITE_ROLES), async (req, res, next) => {
  try {
    const body = schema.partial().parse(req.body);
    const data = await prisma.correctiveAction.update({
      where: { id: req.params.id },
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : body.dueDate === null ? null : undefined,
        completedDate: body.completedDate ? new Date(body.completedDate) : body.completedDate === null ? null : undefined,
      }, include,
    });
    res.json(data);
  } catch (error) { next(error); }
});

actionsRouter.delete("/:id", requireRole(ADMIN_ONLY_ROLES), async (req, res, next) => {
  try { res.json(await prisma.correctiveAction.update({ where: { id: req.params.id }, data: { isDeleted: true } })); }
  catch (error) { next(error); }
});
