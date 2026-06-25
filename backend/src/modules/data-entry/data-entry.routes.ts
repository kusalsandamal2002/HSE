import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { HttpError } from "../../utils/http";

export const dataEntryRouter = Router();
dataEntryRouter.use(requireAuth);

type FieldType = "text" | "textarea" | "number" | "date" | "select" | "boolean" | "json";

type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  readonly?: boolean;
  optionKey?: string;
  options?: string[];
};

type TableConfig = {
  key: string;
  title: string;
  description: string;
  category: "HSE" | "Common" | "Master" | "ESG";
  model: string;
  fields: FieldDef[];
  orderBy?: any;
  where?: any;
  deleteMode: "soft-delete" | "deactivate" | "hard-delete";
};

const staticOptions = {
  severity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
  status: ["PENDING", "IN_PROGRESS", "COMPLETED", "CLOSED", "OVERDUE"],
  observationType: ["NEAR_MISS", "UNSAFE_ACT", "UNSAFE_CONDITION", "POSITIVE_OBSERVATION"],
  riskLevel: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
};

const tables: Record<string, TableConfig> = {
  incidents: {
    key: "incidents",
    title: "Accident Register",
    description: "Enter, edit, and manage accident / incident records.",
    category: "HSE",
    model: "incident",
    deleteMode: "soft-delete",
    where: { isDeleted: false },
    orderBy: [{ incidentDate: "desc" }, { createdAt: "desc" }],
    fields: [
      { key: "incidentNo", label: "Incident No", type: "text" },
      { key: "incidentDate", label: "Date", type: "date", required: true },
      { key: "incidentTime", label: "Time", type: "text" },
      { key: "departmentId", label: "Department", type: "select", optionKey: "departments" },
      { key: "shiftId", label: "Shift", type: "select", optionKey: "shifts" },
      { key: "employeeId", label: "Employee", type: "select", optionKey: "employees" },
      { key: "machineId", label: "Machine / Area", type: "select", optionKey: "machines" },
      { key: "incidentTypeId", label: "Incident Type", type: "select", optionKey: "incidentTypes" },
      { key: "injuryTypeId", label: "Injury Type", type: "select", optionKey: "injuryTypes" },
      { key: "rootCauseId", label: "Root Cause", type: "select", optionKey: "rootCauses" },
      { key: "description", label: "Description", type: "textarea", required: true },
      { key: "immediateAction", label: "Immediate Action", type: "textarea" },
      { key: "correctiveAction", label: "Corrective Action", type: "textarea" },
      { key: "lostMinutes", label: "Lost Minutes", type: "number" },
      { key: "medicalExpenseTotal", label: "Medical Expense", type: "number" },
      { key: "severity", label: "Severity", type: "select", options: staticOptions.severity },
      { key: "status", label: "Status", type: "select", options: staticOptions.status },
    ],
  },


  correctiveActions: {
    key: "correctiveActions",
    title: "Corrective Actions",
    description: "Enter, edit, and manage corrective action records linked to accidents or observations.",
    category: "HSE",
    model: "correctiveAction",
    deleteMode: "soft-delete",
    where: { isDeleted: false },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    fields: [
      { key: "actionNo", label: "Action No", type: "text" },
      { key: "incidentId", label: "Incident ID", type: "text" },
      { key: "observationId", label: "Observation ID", type: "text" },
      { key: "action", label: "Action", type: "textarea", required: true },
      { key: "responsiblePerson", label: "Responsible Person", type: "text" },
      { key: "dueDate", label: "Due Date", type: "date" },
      { key: "completedDate", label: "Completed Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: staticOptions.status },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  medical: {
    key: "medical",
    title: "Medical Expenses",
    description: "Enter and edit medical expense records.",
    category: "HSE",
    model: "medicalExpense",
    deleteMode: "soft-delete",
    where: { isDeleted: false },
    orderBy: { expenseDate: "desc" },
    fields: [
      { key: "expenseNo", label: "Expense No", type: "text" },
      { key: "incidentId", label: "Incident ID", type: "text" },
      { key: "expenseDate", label: "Expense Date", type: "date", required: true },
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "expenseType", label: "Expense Type", type: "text" },
      { key: "provider", label: "Provider", type: "text" },
      { key: "billNo", label: "Bill No", type: "text" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },

  observations: {
    key: "observations",
    title: "Near Miss / Unsafe",
    description: "Enter near miss, unsafe act, and unsafe condition records.",
    category: "HSE",
    model: "observation",
    deleteMode: "soft-delete",
    where: { isDeleted: false },
    orderBy: [{ observationDate: "desc" }, { createdAt: "desc" }],
    fields: [
      { key: "observationNo", label: "Observation No", type: "text" },
      { key: "observationDate", label: "Date", type: "date", required: true },
      { key: "observationTime", label: "Time", type: "text" },
      { key: "departmentId", label: "Department", type: "select", optionKey: "departments" },
      { key: "type", label: "Type", type: "select", options: staticOptions.observationType, required: true },
      { key: "riskLevel", label: "Risk Level", type: "select", options: staticOptions.riskLevel },
      { key: "description", label: "Description", type: "textarea", required: true },
      { key: "actionTaken", label: "Action Taken", type: "textarea" },
      { key: "reportedBy", label: "Reported By", type: "text" },
      { key: "status", label: "Status", type: "select", options: staticOptions.status },
    ],
  },

  workingHours: {
    key: "workingHours",
    title: "Working Hours",
    description: "Enter monthly working hours by department.",
    category: "HSE",
    model: "workingHours",
    deleteMode: "hard-delete",
    orderBy: [{ year: "desc" }, { month: "desc" }],
    fields: [
      { key: "year", label: "Year", type: "number", required: true },
      { key: "month", label: "Month", type: "number", required: true },
      { key: "departmentId", label: "Department", type: "select", optionKey: "departments" },
      { key: "totalEmployees", label: "Total Employees", type: "number" },
      { key: "regularHours", label: "Regular Hours", type: "number" },
      { key: "overtimeHours", label: "Overtime Hours", type: "number" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },


  tfTsMetrics: {
    key: "tfTsMetrics",
    title: "TF / TS Metrics",
    description: "Enter ESG safety metrics for total fatalities and total recordable cases.",
    category: "ESG",
    model: "tfTsMetric",
    deleteMode: "hard-delete",
    orderBy: { year: "desc" },
    fields: [
      { key: "year", label: "Year", type: "number", required: true },
      { key: "tfTotal", label: "TF Total", type: "number" },
      { key: "tfRate", label: "TF Rate", type: "number" },
      { key: "tsTotal", label: "TS Total", type: "number" },
      { key: "tsRate", label: "TS Rate", type: "number" },
      { key: "source", label: "Source", type: "text" },
      { key: "periodLabel", label: "Period Label", type: "text" },
      { key: "tracked", label: "Tracked", type: "boolean" },
    ],
  },

  esgSnapshots: {
    key: "esgSnapshots",
    title: "ESG Dashboard Snapshots",
    description: "Edit imported ESG dashboard snapshot metadata and JSON payload.",
    category: "ESG",
    model: "esgDashboardSnapshot",
    deleteMode: "hard-delete",
    orderBy: { year: "desc" },
    fields: [
      { key: "year", label: "Year", type: "number", required: true },
      { key: "sourceFile", label: "Source File", type: "text", required: true },
      { key: "sourcePath", label: "Source Path", type: "text" },
      { key: "sourceSheet", label: "Source Sheet", type: "text" },
      { key: "periodLabel", label: "Period Label", type: "text", required: true },
      { key: "tracked", label: "Tracked", type: "boolean" },
      { key: "payload", label: "Payload JSON", type: "json", required: true },
    ],
  },
  departments: {
    key: "departments",
    title: "Departments",
    description: "Manage department master data.",
    category: "Master",
    model: "department",
    deleteMode: "deactivate",
    where: { isActive: true },
    orderBy: { name: "asc" },
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "isActive", label: "Active", type: "boolean" },
    ],
  },

  employees: {
    key: "employees",
    title: "Employees",
    description: "Manage employee master data.",
    category: "Master",
    model: "employee",
    deleteMode: "deactivate",
    where: { isActive: true },
    orderBy: { name: "asc" },
    fields: [
      { key: "empNo", label: "Emp No", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "designation", label: "Designation", type: "text" },
      { key: "departmentId", label: "Department", type: "select", optionKey: "departments" },
      { key: "shiftId", label: "Shift", type: "select", optionKey: "shifts" },
      { key: "isActive", label: "Active", type: "boolean" },
    ],
  },

  machines: {
    key: "machines",
    title: "Machines / Areas",
    description: "Manage machine and work-area master data.",
    category: "Master",
    model: "machine",
    deleteMode: "deactivate",
    where: { isActive: true },
    orderBy: { name: "asc" },
    fields: [
      { key: "code", label: "Code", type: "text" },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "departmentId", label: "Department", type: "select", optionKey: "departments" },
      { key: "isActive", label: "Active", type: "boolean" },
    ],
  },

  shifts: {
    key: "shifts",
    title: "Shifts",
    description: "Manage shift master data.",
    category: "Master",
    model: "shift",
    deleteMode: "deactivate",
    where: { isActive: true },
    orderBy: { name: "asc" },
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "startTime", label: "Start Time", type: "text" },
      { key: "endTime", label: "End Time", type: "text" },
      { key: "isActive", label: "Active", type: "boolean" },
    ],
  },

  incidentTypes: {
    key: "incidentTypes",
    title: "Incident Types",
    description: "Manage incident type master data.",
    category: "Master",
    model: "incidentType",
    deleteMode: "deactivate",
    where: { isActive: true },
    orderBy: { name: "asc" },
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "isActive", label: "Active", type: "boolean" },
    ],
  },

  injuryTypes: {
    key: "injuryTypes",
    title: "Injury Types",
    description: "Manage injury type master data.",
    category: "Master",
    model: "injuryType",
    deleteMode: "deactivate",
    where: { isActive: true },
    orderBy: { name: "asc" },
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "isActive", label: "Active", type: "boolean" },
    ],
  },

  rootCauses: {
    key: "rootCauses",
    title: "Root Causes",
    description: "Manage root cause master data.",
    category: "Master",
    model: "rootCause",
    deleteMode: "deactivate",
    where: { isActive: true },
    orderBy: { name: "asc" },
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "category", label: "Category", type: "text" },
      { key: "isActive", label: "Active", type: "boolean" },
    ],
  },
};

function getConfig(key: string): TableConfig {
  const config = tables[key];
  if (!config) throw new HttpError(404, "Data entry table not found");
  return config;
}

function getModel(config: TableConfig): any {
  const model = (prisma as any)[config.model];
  if (!model) throw new HttpError(500, `Prisma model not found: ${config.model}`);
  return model;
}

function dateOnly(value: any) {
  if (!value) return value;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

function normalizeRow(row: any, config: TableConfig) {
  const output: any = { id: row.id };
  for (const field of config.fields) {
    const value = row[field.key];
    if (field.type === "date") output[field.key] = dateOnly(value);
    else if (field.type === "json") output[field.key] = value === null || value === undefined ? "" : JSON.stringify(value, null, 2);
    else output[field.key] = value;
  }
  output.createdAt = row.createdAt ? dateOnly(row.createdAt) : undefined;
  output.updatedAt = row.updatedAt ? dateOnly(row.updatedAt) : undefined;
  return output;
}

function normalizeBody(input: any, config: TableConfig, isCreate: boolean) {
  const data: any = {};

  for (const field of config.fields) {
    if (field.readonly) continue;
    if (!(field.key in input)) continue;

    const raw = input[field.key];

    if (raw === "" || raw === undefined) {
      data[field.key] = field.required ? raw : null;
      continue;
    }

    if (field.type === "number") {
      data[field.key] = raw === null ? null : Number(raw);
      continue;
    }

    if (field.type === "date") {
      data[field.key] = raw === null ? null : new Date(raw);
      continue;
    }

    if (field.type === "json") {
      if (typeof raw === "string") {
        try {
          data[field.key] = JSON.parse(raw || "{}");
        } catch {
          throw new HttpError(400, `${field.label} must be valid JSON`);
        }
      } else {
        data[field.key] = raw;
      }
      continue;
    }

    if (field.type === "boolean") {
      data[field.key] = raw === true || raw === "true";
      continue;
    }

    data[field.key] = raw;
  }

  if (isCreate) {
    if (config.key === "incidents" && !data.incidentNo) data.incidentNo = `INC-MAN-${Date.now()}`;
    if (config.key === "medical" && !data.expenseNo) data.expenseNo = `MED-MAN-${Date.now()}`;
    if (config.key === "observations" && !data.observationNo) data.observationNo = `OBS-MAN-${Date.now()}`;

    if ("isActive" in data === false && ["departments", "employees", "machines", "shifts", "incidentTypes", "injuryTypes", "rootCauses"].includes(config.key)) {
      data.isActive = true;
    }

    if (config.key === "incidents") {
      if (!data.severity) data.severity = "LOW";
      if (!data.status) data.status = "PENDING";
      if (!data.lostMinutes) data.lostMinutes = 0;
      if (!data.medicalExpenseTotal) data.medicalExpenseTotal = 0;
    }

    if (config.key === "observations") {
      if (!data.riskLevel) data.riskLevel = "LOW";
      if (!data.status) data.status = "PENDING";
    }

    if (config.key === "workingHours") {
      if (!data.totalEmployees) data.totalEmployees = 0;
      if (!data.regularHours) data.regularHours = 0;
      if (!data.overtimeHours) data.overtimeHours = 0;
    }
  }

  return data;
}

dataEntryRouter.get("/tables", (_req, res) => {
  res.json(Object.values(tables).map(({ model, ...safe }) => safe));
});

dataEntryRouter.get("/tables/:tableKey", (req, res, next) => {
  try {
    const { model, ...safe } = getConfig(req.params.tableKey);
    res.json(safe);
  } catch (error) { next(error); }
});

dataEntryRouter.get("/:tableKey", async (req, res, next) => {
  try {
    const config = getConfig(req.params.tableKey);
    const model = getModel(config);
    const data = await model.findMany({
      where: config.where,
      orderBy: config.orderBy,
      take: 1000,
    });
    res.json(data.map((row: any) => normalizeRow(row, config)));
  } catch (error) { next(error); }
});

dataEntryRouter.post("/:tableKey", async (req, res, next) => {
  try {
    const config = getConfig(req.params.tableKey);
    const model = getModel(config);
    const data = normalizeBody(req.body, config, true);
    const created = await model.create({ data });
    res.status(201).json(normalizeRow(created, config));
  } catch (error) { next(error); }
});

dataEntryRouter.put("/:tableKey/:id", async (req, res, next) => {
  try {
    const config = getConfig(req.params.tableKey);
    const model = getModel(config);
    const data = normalizeBody(req.body, config, false);
    const updated = await model.update({ where: { id: req.params.id }, data });
    res.json(normalizeRow(updated, config));
  } catch (error) { next(error); }
});

dataEntryRouter.delete("/:tableKey/:id", async (req, res, next) => {
  try {
    const config = getConfig(req.params.tableKey);
    const model = getModel(config);

    if (config.deleteMode === "soft-delete") {
      const deleted = await model.update({ where: { id: req.params.id }, data: { isDeleted: true } });
      return res.json(normalizeRow(deleted, config));
    }

    if (config.deleteMode === "deactivate") {
      const deleted = await model.update({ where: { id: req.params.id }, data: { isActive: false } });
      return res.json(normalizeRow(deleted, config));
    }

    const deleted = await model.delete({ where: { id: req.params.id } });
    res.json(normalizeRow(deleted, config));
  } catch (error) { next(error); }
});

