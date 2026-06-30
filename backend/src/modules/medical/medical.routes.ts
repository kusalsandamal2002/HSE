import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ADMIN_ONLY_ROLES, DATA_WRITE_ROLES, requireAuth, requireRole } from "../../middleware/auth.js";
import { generateCode, monthRange, toNumber, toStringValue } from "../../utils/http.js";
import { nullableId, nullableText } from "../../utils/schema.js";

export const medicalRouter = Router();
medicalRouter.use(requireAuth);

const schema = z.object({
  expenseNo: z.string().optional(),
  incidentId: nullableId,
  expenseDate: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  expenseType: nullableText,
  provider: nullableText,
  billNo: nullableText,
  remarks: nullableText,
});

medicalRouter.get("/", async (req, res, next) => {
  try {
    const year = toNumber(req.query.year);
    const month = toNumber(req.query.month);
    const data = await prisma.medicalExpense.findMany({
      where: { isDeleted: false, incidentId: toStringValue(req.query.incidentId), expenseDate: monthRange(year, month) },
      include: { incident: { include: { department: true, employee: true } } },
      orderBy: { expenseDate: "desc" },
    });
    res.json(data);
  } catch (error) { next(error); }
});

medicalRouter.post("/", requireRole(DATA_WRITE_ROLES), async (req, res, next) => {
  try {
    const body = schema.parse(req.body);
    const created = await prisma.$transaction(async (tx) => {
      const expense = await tx.medicalExpense.create({
        data: { ...body, expenseNo: body.expenseNo || generateCode("MED"), expenseDate: new Date(body.expenseDate), amount: body.amount },
        include: { incident: true },
      });
      if (body.incidentId) {
        const sum = await tx.medicalExpense.aggregate({ where: { incidentId: body.incidentId, isDeleted: false }, _sum: { amount: true } });
        await tx.incident.update({ where: { id: body.incidentId }, data: { medicalExpenseTotal: sum._sum.amount || 0 } });
      }
      return expense;
    });
    res.status(201).json(created);
  } catch (error) { next(error); }
});

medicalRouter.put("/:id", requireRole(DATA_WRITE_ROLES), async (req, res, next) => {
  try {
    const body = schema.partial().parse(req.body);
    const updated = await prisma.$transaction(async (tx) => {
      const expense = await tx.medicalExpense.update({
        where: { id: req.params.id },
        data: { ...body, expenseDate: body.expenseDate ? new Date(body.expenseDate) : undefined },
      });
      if (expense.incidentId) {
        const sum = await tx.medicalExpense.aggregate({ where: { incidentId: expense.incidentId, isDeleted: false }, _sum: { amount: true } });
        await tx.incident.update({ where: { id: expense.incidentId }, data: { medicalExpenseTotal: sum._sum.amount || 0 } });
      }
      return expense;
    });
    res.json(updated);
  } catch (error) { next(error); }
});

medicalRouter.delete("/:id", requireRole(ADMIN_ONLY_ROLES), async (req, res, next) => {
  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const expense = await tx.medicalExpense.update({ where: { id: req.params.id }, data: { isDeleted: true } });
      if (expense.incidentId) {
        const sum = await tx.medicalExpense.aggregate({ where: { incidentId: expense.incidentId, isDeleted: false }, _sum: { amount: true } });
        await tx.incident.update({ where: { id: expense.incidentId }, data: { medicalExpenseTotal: sum._sum.amount || 0 } });
      }
      return expense;
    });
    res.json(deleted);
  } catch (error) { next(error); }
});

