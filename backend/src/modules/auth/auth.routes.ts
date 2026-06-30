import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http.js";
import { requireAuth, signToken } from "../../middleware/auth.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const strongPasswordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one symbol");

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: strongPasswordSchema,
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.isActive) throw new HttpError(401, "Invalid login details");

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) throw new HttpError(401, "Invalid login details");

    const safeUser = { id: user.id, email: user.email, role: user.role, name: user.name };
    res.json({ token: signToken(safeUser), user: safeUser });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

authRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);

    if (body.currentPassword === body.newPassword) {
      throw new HttpError(400, "New password must be different from current password");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
    });

    if (!user || !user.isActive) {
      throw new HttpError(401, "Invalid or inactive user");
    }

    const currentPasswordOk = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!currentPasswordOk) {
      throw new HttpError(400, "Current password is incorrect");
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
});
