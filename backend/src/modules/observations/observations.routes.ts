import { Router } from "express";
import { ObservationType, RecordStatus, RiskLevel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ADMIN_ONLY_ROLES, DATA_WRITE_ROLES, requireAuth, requireRole } from "../../middleware/auth.js";
import { generateCode, monthRange, toNumber, toStringValue } from "../../utils/http.js";
import { nullableId, nullableText } from "../../utils/schema.js";

export const observationsRouter = Router();
observationsRouter.use(requireAuth);

const schema = z.object({
  observationNo: z.string().optional(),
  observationDate: z.string().min(1),
  observationTime: nullableText,
  departmentId: nullableId,
  type: z.nativeEnum(ObservationType),
  riskLevel: z.nativeEnum(RiskLevel).default("LOW"),
  description: z.string().min(1),
  actionTaken: nullableText,
  reportedBy: nullableText,
  status: z.nativeEnum(RecordStatus).default("PENDING"),
});

const include = { department: true, correctiveActions: { where: { isDeleted: false } } };

observationsRouter.get("/", async (req, res, next) => {
  try {
    const year = toNumber(req.query.year);
    const month = toNumber(req.query.month);
    const data = await prisma.observation.findMany({
      where: {
        isDeleted: false,
        observationDate: monthRange(year, month),
        departmentId: toStringValue(req.query.departmentId),
        type: toStringValue(req.query.type) as ObservationType | undefined,
        riskLevel: toStringValue(req.query.riskLevel) as RiskLevel | undefined,
        status: toStringValue(req.query.status) as RecordStatus | undefined,
      },
      include,
      orderBy: [{ observationDate: "desc" }, { createdAt: "desc" }],
    });
    res.json(data);
  } catch (error) { next(error); }
});

observationsRouter.post("/", requireRole(DATA_WRITE_ROLES), async (req, res, next) => {
  try {
    const body = schema.parse(req.body);
    const data = await prisma.observation.create({
      data: { ...body, observationNo: body.observationNo || generateCode("OBS"), observationDate: new Date(body.observationDate) },
      include,
    });
    res.status(201).json(data);
  } catch (error) { next(error); }
});

observationsRouter.put("/:id", requireRole(DATA_WRITE_ROLES), async (req, res, next) => {
  try {
    const body = schema.partial().parse(req.body);
    const data = await prisma.observation.update({
      where: { id: req.params.id },
      data: { ...body, observationDate: body.observationDate ? new Date(body.observationDate) : undefined },
      include,
    });
    res.json(data);
  } catch (error) { next(error); }
});

observationsRouter.delete("/:id", requireRole(ADMIN_ONLY_ROLES), async (req, res, next) => {
  try { res.json(await prisma.observation.update({ where: { id: req.params.id }, data: { isDeleted: true } })); }
  catch (error) { next(error); }
});

