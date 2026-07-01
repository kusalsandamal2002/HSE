import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ADMIN_ONLY_ROLES, requireAuth, requireRole } from "../../middleware/auth.js";
import { toNumber, toStringValue } from "../../utils/http.js";

export const auditLogsRouter = Router();

auditLogsRouter.use(requireAuth);
auditLogsRouter.use(requireRole(ADMIN_ONLY_ROLES));

function parseDate(value: unknown) {
  const raw = toStringValue(value);
  if (!raw) return undefined;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;

  return date;
}

auditLogsRouter.get("/", async (req, res, next) => {
  try {
    const page = Math.max(toNumber(req.query.page, 1) ?? 1, 1);
    const limit = Math.min(Math.max(toNumber(req.query.limit, 50) ?? 50, 1), 200);
    const skip = (page - 1) * limit;

    const action = toStringValue(req.query.action);
    const entity = toStringValue(req.query.entity);
    const entityId = toStringValue(req.query.entityId);
    const userId = toStringValue(req.query.userId);
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);

    const where: Prisma.AuditLogWhereInput = {};

    if (action) where.action = { contains: action, mode: "insensitive" };
    if (entity) where.entity = { contains: entity, mode: "insensitive" };
    if (entityId) where.entityId = entityId;
    if (userId) where.userId = userId;

    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});
