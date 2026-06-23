import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    app: "HSE",
    mode: "development",
    timestamp: new Date().toISOString(),
  });
});
