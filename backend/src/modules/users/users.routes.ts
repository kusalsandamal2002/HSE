import { Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { ADMIN_ONLY_ROLES, requireAuth, requireRole } from "../../middleware/auth.js";
import { prisma } from "../../lib/prisma.js";
import { writeAuditLog } from "../../utils/audit.js";

export const usersRouter = Router();

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const strongPasswordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol");

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180).transform((value) => value.toLowerCase()),
  role: z.nativeEnum(UserRole),
  password: strongPasswordSchema,
  isActive: z.boolean().default(true),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(180).transform((value) => value.toLowerCase()).optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "At least one field must be provided",
});

const resetPasswordSchema = z.object({
  password: strongPasswordSchema,
});

function actorId(req: { user?: { id?: string } }) {
  return req.user?.id;
}

function userAuditPayload(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function assertAdminAccountSafety(params: {
  targetUserId: string;
  actorUserId?: string;
  currentRole: UserRole;
  currentIsActive: boolean;
  nextRole?: UserRole;
  nextIsActive?: boolean;
}) {
  const nextRole = params.nextRole ?? params.currentRole;
  const nextIsActive = params.nextIsActive ?? params.currentIsActive;

  const isAdminNow = params.currentRole === UserRole.ADMIN;
  const willRemainActiveAdmin = nextRole === UserRole.ADMIN && nextIsActive === true;

  if (params.actorUserId === params.targetUserId && !willRemainActiveAdmin) {
    throw new Error("You cannot remove admin access from your own account");
  }

  if (isAdminNow && params.currentIsActive && !willRemainActiveAdmin) {
    const activeAdminCount = await prisma.user.count({
      where: {
        role: UserRole.ADMIN,
        isActive: true,
      },
    });

    if (activeAdminCount <= 1) {
      throw new Error("At least one active ADMIN account must remain in the system");
    }
  }
}

function handlePrismaError(error: unknown, res: import("express").Response, next: import("express").NextFunction) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    res.status(409).json({ message: "Email already exists" });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    res.status(404).json({ message: "User not found" });
    return;
  }

  if (error instanceof Error && (
    error.message.includes("At least one active ADMIN") ||
    error.message.includes("own account")
  )) {
    res.status(400).json({ message: error.message });
    return;
  }

  next(error);
}

usersRouter.use(requireAuth);
usersRouter.use(requireRole(ADMIN_ONLY_ROLES));

usersRouter.get("/roles", (_req, res) => {
  res.json({
    roles: Object.values(UserRole).map((role) => ({
      value: role,
      label: role.replace(/_/g, " "),
    })),
  });
});

usersRouter.get("/", async (req, res, next) => {
  try {
    const query = z.object({
      search: z.string().trim().optional(),
      role: z.nativeEnum(UserRole).optional(),
      isActive: z.coerce.boolean().optional(),
    }).parse(req.query);

    const where: Prisma.UserWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query.role) where.role = query.role;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const users = await prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [
        { isActive: "desc" },
        { role: "asc" },
        { name: "asc" },
      ],
    });

    res.json({ users });
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/", async (req, res, next) => {
  try {
    const body = createUserSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        role: body.role,
        isActive: body.isActive,
        passwordHash,
      },
      select: userSelect,
    });

    await writeAuditLog({
      user: req.user,
      action: "CREATE_USER",
      entity: "User",
      entityId: user.id,
      after: userAuditPayload(user),
    });

    res.status(201).json({ user });
  } catch (error) {
    handlePrismaError(error, res, next);
  }
});

usersRouter.put("/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const body = updateUserSchema.parse(req.body);

    const before = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: userSelect,
    });

    await assertAdminAccountSafety({
      targetUserId: id,
      actorUserId: actorId(req),
      currentRole: before.role,
      currentIsActive: before.isActive,
      nextRole: body.role,
      nextIsActive: body.isActive,
    });

    const user = await prisma.user.update({
      where: { id },
      data: body,
      select: userSelect,
    });

    await writeAuditLog({
      user: req.user,
      action: "UPDATE_USER",
      entity: "User",
      entityId: user.id,
      before: userAuditPayload(before),
      after: userAuditPayload(user),
    });

    res.json({ user });
  } catch (error) {
    handlePrismaError(error, res, next);
  }
});

usersRouter.post("/:id/reset-password", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const body = resetPasswordSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 10);

    const before = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: userSelect,
    });

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: { id: true },
    });

    await writeAuditLog({
      user: req.user,
      action: "RESET_USER_PASSWORD",
      entity: "User",
      entityId: id,
      before: userAuditPayload(before),
      after: {
        id,
        email: before.email,
        passwordReset: true,
      },
    });

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    handlePrismaError(error, res, next);
  }
});
