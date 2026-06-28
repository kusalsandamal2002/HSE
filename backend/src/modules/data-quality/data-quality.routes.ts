import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { getDataQualitySummary } from "./data-quality.service.js";

export const dataQualityRouter = Router();

dataQualityRouter.get("/monthly", requireAuth, requireRole(["ADMIN", "HSE_OFFICER"]), async (req, res, next) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const month = Number(req.query.month || (new Date().getMonth() + 1));
    const summary = await getDataQualitySummary({ year, month });
    res.json(summary);
  } catch (error) {
    next(error);
  }
});
