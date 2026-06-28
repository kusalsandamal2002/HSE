import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http.js";
import { nullableId, nullableText } from "../../utils/schema.js";
import { requireAuth } from "../../middleware/auth.js";

export const masterRouter = Router();
masterRouter.use(requireAuth);

const activeOnly = (includeInactive: unknown) => includeInactive === "true" ? {} : { isActive: true };

const nameSchema = z.object({
  name: z.string().min(1),
  isActive: z.boolean().optional(),
});

masterRouter.get("/departments", async (req, res, next) => {
  try {
    const data = await prisma.department.findMany({
      where: activeOnly(req.query.includeInactive),
      orderBy: { name: "asc" },
    });
    res.json(data);
  } catch (error) { next(error); }
});

masterRouter.post("/departments", async (req, res, next) => {
  try {
    const body = z.object({ code: z.string().min(1), name: z.string().min(1), isActive: z.boolean().optional() }).parse(req.body);
    res.status(201).json(await prisma.department.create({ data: body }));
  } catch (error) { next(error); }
});

masterRouter.put("/departments/:id", async (req, res, next) => {
  try {
    const body = z.object({ code: z.string().min(1).optional(), name: z.string().min(1).optional(), isActive: z.boolean().optional() }).parse(req.body);
    res.json(await prisma.department.update({ where: { id: req.params.id }, data: body }));
  } catch (error) { next(error); }
});

masterRouter.delete("/departments/:id", async (req, res, next) => {
  try {
    res.json(await prisma.department.update({ where: { id: req.params.id }, data: { isActive: false } }));
  } catch (error) { next(error); }
});

masterRouter.get("/shifts", async (req, res, next) => {
  try {
    const data = await prisma.shift.findMany({ where: activeOnly(req.query.includeInactive), orderBy: { name: "asc" } });
    res.json(data);
  } catch (error) { next(error); }
});

masterRouter.post("/shifts", async (req, res, next) => {
  try {
    const body = z.object({ name: z.string().min(1), startTime: nullableText, endTime: nullableText, isActive: z.boolean().optional() }).parse(req.body);
    res.status(201).json(await prisma.shift.create({ data: body }));
  } catch (error) { next(error); }
});

masterRouter.put("/shifts/:id", async (req, res, next) => {
  try {
    const body = z.object({ name: z.string().min(1).optional(), startTime: nullableText, endTime: nullableText, isActive: z.boolean().optional() }).parse(req.body);
    res.json(await prisma.shift.update({ where: { id: req.params.id }, data: body }));
  } catch (error) { next(error); }
});

masterRouter.delete("/shifts/:id", async (req, res, next) => {
  try { res.json(await prisma.shift.update({ where: { id: req.params.id }, data: { isActive: false } })); }
  catch (error) { next(error); }
});

masterRouter.get("/employees", async (req, res, next) => {
  try {
    const data = await prisma.employee.findMany({
      where: activeOnly(req.query.includeInactive),
      orderBy: { name: "asc" },
      include: { department: true, shift: true },
    });
    res.json(data);
  } catch (error) { next(error); }
});

masterRouter.post("/employees", async (req, res, next) => {
  try {
    const body = z.object({
      empNo: z.string().min(1),
      name: z.string().min(1),
      designation: nullableText,
      departmentId: nullableId,
      shiftId: nullableId,
      isActive: z.boolean().optional(),
    }).parse(req.body);
    res.status(201).json(await prisma.employee.create({ data: body }));
  } catch (error) { next(error); }
});

masterRouter.put("/employees/:id", async (req, res, next) => {
  try {
    const body = z.object({
      empNo: z.string().min(1).optional(), name: z.string().min(1).optional(), designation: nullableText,
      departmentId: nullableId, shiftId: nullableId, isActive: z.boolean().optional(),
    }).parse(req.body);
    res.json(await prisma.employee.update({ where: { id: req.params.id }, data: body }));
  } catch (error) { next(error); }
});

masterRouter.delete("/employees/:id", async (req, res, next) => {
  try { res.json(await prisma.employee.update({ where: { id: req.params.id }, data: { isActive: false } })); }
  catch (error) { next(error); }
});

masterRouter.get("/machines", async (req, res, next) => {
  try {
    const data = await prisma.machine.findMany({ where: activeOnly(req.query.includeInactive), orderBy: { name: "asc" }, include: { department: true } });
    res.json(data);
  } catch (error) { next(error); }
});

masterRouter.post("/machines", async (req, res, next) => {
  try {
    const body = z.object({ code: nullableText, name: z.string().min(1), departmentId: nullableId, isActive: z.boolean().optional() }).parse(req.body);
    res.status(201).json(await prisma.machine.create({ data: body }));
  } catch (error) { next(error); }
});

masterRouter.put("/machines/:id", async (req, res, next) => {
  try {
    const body = z.object({ code: nullableText, name: z.string().min(1).optional(), departmentId: nullableId, isActive: z.boolean().optional() }).parse(req.body);
    res.json(await prisma.machine.update({ where: { id: req.params.id }, data: body }));
  } catch (error) { next(error); }
});

masterRouter.delete("/machines/:id", async (req, res, next) => {
  try { res.json(await prisma.machine.update({ where: { id: req.params.id }, data: { isActive: false } })); }
  catch (error) { next(error); }
});

async function listSimple(model: "incidentType" | "injuryType" | "rootCause", req: any, res: any) {
  const where = activeOnly(req.query.includeInactive);
  const data = await (prisma as any)[model].findMany({ where, orderBy: { name: "asc" } });
  res.json(data);
}

async function createSimple(model: "incidentType" | "injuryType" | "rootCause", req: any, res: any) {
  const schema = model === "rootCause" ? nameSchema.extend({ category: nullableText }) : nameSchema;
  const body = schema.parse(req.body);
  const data = await (prisma as any)[model].create({ data: body });
  res.status(201).json(data);
}

async function updateSimple(model: "incidentType" | "injuryType" | "rootCause", req: any, res: any) {
  const schema = model === "rootCause" ? nameSchema.extend({ category: nullableText }).partial() : nameSchema.partial();
  const body = schema.parse(req.body);
  const data = await (prisma as any)[model].update({ where: { id: req.params.id }, data: body });
  res.json(data);
}

async function deactivateSimple(model: "incidentType" | "injuryType" | "rootCause", req: any, res: any) {
  const data = await (prisma as any)[model].update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json(data);
}

for (const [path, model] of [
  ["incident-types", "incidentType"],
  ["injury-types", "injuryType"],
  ["root-causes", "rootCause"],
] as const) {
  masterRouter.get(`/${path}`, (req, res, next) => listSimple(model, req, res).catch(next));
  masterRouter.post(`/${path}`, (req, res, next) => createSimple(model, req, res).catch(next));
  masterRouter.put(`/${path}/:id`, (req, res, next) => updateSimple(model, req, res).catch(next));
  masterRouter.delete(`/${path}/:id`, (req, res, next) => deactivateSimple(model, req, res).catch(next));
}

masterRouter.get("/lookups", async (_req, res, next) => {
  try {
    const [departments, shifts, employees, machines, incidentTypes, injuryTypes, rootCauses] = await Promise.all([
      prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.shift.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.employee.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.machine.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.incidentType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.injuryType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.rootCause.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    ]);
    res.json({ departments, shifts, employees, machines, incidentTypes, injuryTypes, rootCauses });
  } catch (error) { next(error); }
});

masterRouter.use((_req, _res, next) => next(new HttpError(404, "Master data route not found")));
