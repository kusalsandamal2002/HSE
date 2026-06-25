import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { toNumber } from "../../utils/http.js";
import { getEsgDashboard, listEsgSnapshots } from "./esg.service.js";

export const esgRouter = Router();

esgRouter.use(requireAuth);

esgRouter.get("/summary", async (req, res, next) => {
  try {
    res.json(await getEsgDashboard(toNumber(req.query.year)));
  } catch (error) {
    next(error);
  }
});

esgRouter.get("/reports", async (req, res, next) => {
  try {
    res.json(await getEsgDashboard(toNumber(req.query.year)));
  } catch (error) {
    next(error);
  }
});

esgRouter.get("/snapshots", async (_req, res, next) => {
  try {
    res.json(await listEsgSnapshots());
  } catch (error) {
    next(error);
  }
});
