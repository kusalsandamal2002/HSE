import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { getDashboardSummary } from "./dashboard.service";
import { toNumber, toStringValue } from "../../utils/http";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", requireAuth, async (req, res, next) => {
  try {
    const data = await getDashboardSummary({
      year: toNumber(req.query.year),
      month: toNumber(req.query.month),
      departmentId: toStringValue(req.query.departmentId),
    });
    res.json(data);
  } catch (error) { next(error); }
});
