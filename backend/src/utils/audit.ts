import type { AuthUser } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

type AuditInput = {
  user?: AuthUser;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

const sensitiveKeys = new Set([
  "password",
  "passwordHash",
  "currentPassword",
  "newPassword",
  "token",
  "authorization",
]);

function sanitizeForAudit(value: unknown) {
  if (value === undefined) return null;

  try {
    return JSON.parse(
      JSON.stringify(value, (key, currentValue) => {
        if (sensitiveKeys.has(key)) return "[REDACTED]";
        return currentValue;
      })
    );
  } catch {
    return { message: "Unable to serialize audit payload" };
  }
}

export async function writeAuditLog(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.user?.id,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId || null,
        before: sanitizeForAudit(input.before),
        after: sanitizeForAudit(input.after),
      },
    });
  } catch (error) {
    console.warn("Audit log write failed", error);
  }
}
