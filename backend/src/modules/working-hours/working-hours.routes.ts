import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ADMIN_ONLY_ROLES, DATA_WRITE_ROLES, requireAuth, requireRole } from "../../middleware/auth.js";
import { toNumber, toStringValue } from "../../utils/http.js";
import { nullableId, nullableText } from "../../utils/schema.js";

export const workingHoursRouter = Router();
workingHoursRouter.use(requireAuth);

const schema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  departmentId: nullableId,
  totalEmployees: z.coerce.number().int().nonnegative().default(0),
  regularHours: z.coerce.number().nonnegative().default(0),
  overtimeHours: z.coerce.number().nonnegative().default(0),
  remarks: nullableText,
});

workingHoursRouter.get("/", async (req, res, next) => {
  try {
    const data = await prisma.workingHours.findMany({
      where: {
        year: toNumber(req.query.year),
        month: toNumber(req.query.month),
        departmentId: toStringValue(req.query.departmentId),
      },
      include: { department: true },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    res.json(data);
  } catch (error) { next(error); }
});

workingHoursRouter.post("/", requireRole(DATA_WRITE_ROLES), async (req, res, next) => {
  try {
    const body = schema.parse(req.body);
    const existing = await prisma.workingHours.findFirst({
      where: { year: body.year, month: body.month, departmentId: body.departmentId || null },
    });
    const data = existing
      ? await prisma.workingHours.update({ where: { id: existing.id }, data: body, include: { department: true } })
      : await prisma.workingHours.create({ data: body, include: { department: true } });
    res.status(201).json(data);
  } catch (error) { next(error); }
});

workingHoursRouter.put("/:id", requireRole(DATA_WRITE_ROLES), async (req, res, next) => {
  try {
    const body = schema.partial().parse(req.body);
    res.json(await prisma.workingHours.update({ where: { id: req.params.id }, data: body, include: { department: true } }));
  } catch (error) { next(error); }
});

workingHoursRouter.delete("/:id", requireRole(ADMIN_ONLY_ROLES), async (req, res, next) => {
  try { res.json(await prisma.workingHours.delete({ where: { id: req.params.id } })); }
  catch (error) { next(error); }
});

