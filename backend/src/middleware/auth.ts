import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http.js";

export const Roles = {
  ADMIN: "ADMIN",
  HSE_MANAGER: "HSE_MANAGER",
  HSE_OFFICER: "HSE_OFFICER",
  DEPARTMENT_HEAD: "DEPARTMENT_HEAD",
  MANAGEMENT_VIEWER: "MANAGEMENT_VIEWER",
  TV_DISPLAY: "TV_DISPLAY",
} as const;

export const ADMIN_ONLY_ROLES = [Roles.ADMIN] as const;

export const DATA_WRITE_ROLES = [
  Roles.ADMIN,
  Roles.HSE_MANAGER,
  Roles.HSE_OFFICER,
] as const;

export const IMPORT_UPLOAD_ROLES = [
  Roles.ADMIN,
  Roles.HSE_MANAGER,
  Roles.HSE_OFFICER,
] as const;

export const IMPORT_APPROVE_ROLES = [
  Roles.ADMIN,
  Roles.HSE_MANAGER,
] as const;

export const CONFIG_WRITE_ROLES = [
  Roles.ADMIN,
  Roles.HSE_MANAGER,
] as const;

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  name: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, env.jwtSecret, { expiresIn: "12h" });
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  try {
    req.user = jwt.verify(header.slice(7), env.jwtSecret) as AuthUser;
  } catch {
    // Ignore invalid token for optional auth.
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(new HttpError(401, "Login required"));
  try {
    req.user = jwt.verify(header.slice(7), env.jwtSecret) as AuthUser;
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired login"));
  }
}

export function requireRole(allowedRoles: readonly string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Login required"));
    if (!allowedRoles.includes(req.user.role)) return next(new HttpError(403, "Permission denied"));
    next();
  };
}

