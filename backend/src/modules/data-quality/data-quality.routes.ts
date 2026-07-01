import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { getDataQualitySummary } from "./data-quality.service.js";

export const dataQualityRouter = Router();

dataQualityRouter.use(requireAuth);

dataQualityRouter.get("/monthly", async (req, res, next) => {
  try {
    const query = z.object({
      year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
      month: z.coerce.number().int().min(1).max(12).default(new Date().getMonth() + 1),
    }).parse(req.query);

    res.json(await getDataQualitySummary(query));
  } catch (error) {
    next(error);
  }
});
