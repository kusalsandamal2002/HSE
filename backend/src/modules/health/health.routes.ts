import { Router } from "express";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { prisma } from "../../lib/prisma.js";

export const healthRouter = Router();

function getBackendVersion(): string {
  try {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");

    if (!existsSync(packageJsonPath)) {
      return "unknown";
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { version?: string };
    return packageJson.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

healthRouter.get("/", async (_req, res) => {
  const startedAt = Date.now();

  const checks: Record<string, "ok" | "error"> = {
    api: "ok",
    prisma: "ok",
    database: "ok",
  };

  let status: "ok" | "degraded" = "ok";
  let databaseMessage = "connected";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    status = "degraded";
    checks.database = "error";
    databaseMessage = error instanceof Error ? error.message : "Database connection failed";
  }

  const responseStatus = status === "ok" ? 200 : 503;

  res.status(responseStatus).json({
    status,
    service: "hse-backend",
    app: "HSE",
    version: getBackendVersion(),
    environment: process.env.NODE_ENV ?? "development",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    responseTimeMs: Date.now() - startedAt,
    checks,
    database: {
      status: checks.database,
      message: databaseMessage,
    },
  });
});
