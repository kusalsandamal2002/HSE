import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error";
import { healthRouter } from "./modules/health/health.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { masterRouter } from "./modules/master/master.routes";
import { incidentsRouter } from "./modules/incidents/incidents.routes";
import { actionsRouter } from "./modules/actions/actions.routes";
import { medicalRouter } from "./modules/medical/medical.routes";
import { observationsRouter } from "./modules/observations/observations.routes";
import { workingHoursRouter } from "./modules/working-hours/working-hours.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { esgRouter } from "./modules/esg/esg.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes";
import { tvDashboardRouter } from "./modules/tv-dashboard/tv.routes";
import { attachmentsRouter } from "./modules/attachments/attachments.routes";
import { importsRouter } from "./modules/imports/imports.routes.js";
import { dataEntryRouter } from "./modules/data-entry/data-entry.routes";

export const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/master", masterRouter);
app.use("/api/incidents", incidentsRouter);
app.use("/api/corrective-actions", actionsRouter);
app.use("/api/medical-expenses", medicalRouter);
app.use("/api/observations", observationsRouter);
app.use("/api/working-hours", workingHoursRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/esg", esgRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/tv", tvDashboardRouter);
app.use("/api/attachments", attachmentsRouter);
app.use("/api/imports", importsRouter);
app.use("/api/data-entry", dataEntryRouter);

const tvDir = path.resolve(process.cwd(), "../tv-display");
app.use("/tv-assets", express.static(tvDir));
app.get("/tv", (_req, res) => res.sendFile(path.join(tvDir, "tv.html")));

app.use((_req, res) => res.status(404).json({ message: "Route not found" }));
app.use(errorHandler);



