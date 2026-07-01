import { Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { ADMIN_ONLY_ROLES, requireAuth, requireRole } from "../../middleware/auth.js";
import { prisma } from "../../lib/prisma.js";

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

function handlePrismaError(error: unknown, res: import("express").Response, next: import("express").NextFunction) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return res.status(409).json({ message: "Email already exists" });
  }

  return next(error);
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

    res.status(201).json({ user });
  } catch (error) {
    handlePrismaError(error, res, next);
  }
});

usersRouter.put("/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const body = updateUserSchema.parse(req.body);

    if (actorId(req) === id && body.isActive === false) {
      return res.status(400).json({ message: "You cannot deactivate your own admin account" });
    }

    const user = await prisma.user.update({
      where: { id },
      data: body,
      select: userSelect,
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

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: { id: true },
    });

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    next(error);
  }
});
