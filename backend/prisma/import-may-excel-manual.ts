import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  IncidentSeverity,
  ObservationType,
  PrismaClient,
  RecordStatus,
  RiskLevel,
} from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(backendDir, ".env") });

const prisma = new PrismaClient();

const SOURCE = "EXCEL_MAY_2026_MANUAL_IMPORT";
const SOURCE_NOTE = "Imported from Accident Summary - May.xlsx";
const YEAR = 2026;
const IMPORT_PREFIX = "EXCEL-MAY-2026";

type CounterName =
  | "departments"
  | "employees"
  | "shifts"
  | "machines"
  | "incidentTypes"
  | "injuryTypes"
  | "rootCauses"
  | "incidents"
  | "correctiveActions"
  | "medicalExpenses"
  | "workingHours"
  | "observations";

type Counter = { inserted: number; updated: number; skipped: number };

const counters: Record<CounterName, Counter> = {
  departments: { inserted: 0, updated: 0, skipped: 0 },
  employees: { inserted: 0, updated: 0, skipped: 0 },
  shifts: { inserted: 0, updated: 0, skipped: 0 },
  machines: { inserted: 0, updated: 0, skipped: 0 },
  incidentTypes: { inserted: 0, updated: 0, skipped: 0 },
  injuryTypes: { inserted: 0, updated: 0, skipped: 0 },
  rootCauses: { inserted: 0, updated: 0, skipped: 0 },
  incidents: { inserted: 0, updated: 0, skipped: 0 },
  correctiveActions: { inserted: 0, updated: 0, skipped: 0 },
  medicalExpenses: { inserted: 0, updated: 0, skipped: 0 },
  workingHours: { inserted: 0, updated: 0, skipped: 0 },
  observations: { inserted: 0, updated: 0, skipped: 0 },
};

const warnings: string[] = [];

type DepartmentMaster = {
  code: string;
  name: string;
  aliases: string[];
};

const DEPARTMENT_MASTERS: DepartmentMaster[] = [
  { code: "PROD", name: "Production", aliases: ["Production", "Produciton"] },
  { code: "ENG-M", name: "Engineering", aliases: ["Engineering", "Engineering - Maintenance"] },
  { code: "ENG-MOLD", name: "Mold", aliases: ["Mold", "Engineering - Mold"] },
  { code: "QC", name: "QC", aliases: ["QC", "Quality Control"] },
  { code: "SRM", name: "Stores RM", aliases: ["Stores RM", "Stores - RM", "RM Stores"] },
  { code: "SFG", name: "Stores FG", aliases: ["Stores FG", "Stores - FG", "Finsh Goods", "Finish Goods"] },
  { code: "RT", name: "R&T", aliases: ["R&T", "R & T"] },
  { code: "OTHER", name: "Other", aliases: ["Other", "Other (Sicknesses)"] },
];

type AccidentRow = {
  row: number;
  department: string;
  shift?: string;
  employeeName: string;
  empNo: string;
  date: string;
  description: string;
  lineMachine: string;
  accidentType: string;
  injuryType: string;
  rootCause: string;
  correctiveAction: string;
  time: string;
  lostTime: string;
  monthlyLostHours?: string;
  quarterlyLostHours?: string;
  caStatus?: string;
};

// Manual mapping from workbook sheet "Data", rows 5:17.
// The workbook has summary-only medical expense and observation tables; those are
// mapped separately below and flagged in console warnings where detail is absent.
const ACCIDENT_ROWS: AccidentRow[] = [
  {
    row: 5,
    department: "Production",
    shift: "Perera",
    employeeName: "Janaka",
    empNo: "51104",
    date: "2026.02.09",
    description: "Little finger was injured during the kneader operation",
    lineMachine: "Kneader",
    accidentType: "Medical",
    injuryType: "Hand",
    rootCause:
      "Machine ramp had lowered automatically while feeding suphur (The Pnuematic jack of the ramp was mal funcitonined)",
    correctiveAction:
      "Machin was stopped to repair the ramp issue, Sulpher feeding unit is fixed and employees were provided with awareness not to put hand inside the chamber while feeding sulphour",
    time: "2.00 pm",
    lostTime: "1h 30m",
    monthlyLostHours: "1h 30m",
    quarterlyLostHours: "6h",
    caStatus: "Completed",
  },
  {
    row: 6,
    department: "Production",
    shift: "Perera",
    employeeName: "Hirantha",
    empNo: "51313",
    date: "2026.02.19",
    description: "Right hand index finger was injured during the 400x8 band tire loading to the cart",
    lineMachine: "200 line",
    accidentType: "1st Aid",
    injuryType: "Hand",
    rootCause: "Unsafe band loading to the cart",
    correctiveAction: "Provide awareness to the employees in proper handling of band tires",
    time: "3.50 pm",
    lostTime: "0",
    caStatus: "Completed",
  },
  {
    row: 7,
    department: "Mold",
    employeeName: "Achidhu",
    empNo: "51304",
    date: "2026.02.21",
    description:
      "Right hand ring finger was injured during tightening a bolt of a mold. The tool used has been slipped and hit on the mold due to which the finger was injured",
    lineMachine: "Mold  changing",
    accidentType: "1st Aid",
    injuryType: "Hand",
    rootCause: "Improper use of tigthning tool",
    correctiveAction: "Instruct the relevant employees on proper using of tools",
    time: "4.30 pm",
    lostTime: "0",
    caStatus: "Completed",
  },
  {
    row: 8,
    department: "QC",
    employeeName: "Asoka",
    empNo: "51262",
    date: "2026.03.03",
    description: "Eye exposed to Xylene vapour",
    lineMachine: "Chemlock painting",
    accidentType: "Medical",
    injuryType: "Eye",
    rootCause: "Not wearing PPEs Unsafe act",
    correctiveAction: "Instruct the employees on safe working",
    time: "10.00am",
    lostTime: "2h",
    monthlyLostHours: "4h 30m",
    caStatus: "Completed",
  },
  {
    row: 9,
    department: "Production",
    shift: "Perera",
    employeeName: "Dhanushka",
    empNo: "50496",
    date: "2026.03.15",
    description: "Leg was entaggled in between the guard and the press bed in the 1100  press",
    lineMachine: "1100 press",
    accidentType: "Medical",
    injuryType: "Leg",
    rootCause: "Keeping the leg on the guard while dragging the cabel. Unsafe act",
    correctiveAction: "Instruct the employees on safe working",
    time: "4.00pm",
    lostTime: "0",
    caStatus: "Completed",
  },
  {
    row: 10,
    department: "Mold",
    employeeName: "Janaka",
    empNo: "51150",
    date: "2026.03.23",
    description: "Leg was hit by a hammer while hammering operation",
    lineMachine: "Mold  changing",
    accidentType: "Medical",
    injuryType: "Leg",
    rootCause: "Hammer has been slipped and hit on the leg during hammering",
    correctiveAction: "Instruct the employees on safe working",
    time: "1.00pm",
    lostTime: "2h 30m",
    caStatus: "Completed",
  },
  {
    row: 11,
    department: "RM Stores",
    employeeName: "Tharindhu",
    empNo: "50896",
    date: "2026.04.17",
    description: "Fore-head was injured due to trip a pallet fork and fall inside the RM stores.",
    lineMachine: "RM Stores",
    accidentType: "Medical",
    injuryType: "Forehead",
    rootCause: "Unsafe work environment",
    correctiveAction: "Instruct the employees to clear the work area prior to start the work",
    time: "2.15pm",
    lostTime: "1h 15m",
    monthlyLostHours: "4h",
  },
  {
    row: 12,
    department: "Production",
    employeeName: "Rose",
    empNo: "MP",
    date: "2026.04.21",
    description: "Eye was exposed to thinner vapour",
    lineMachine: "Production",
    accidentType: "Medical",
    injuryType: "Eye",
    rootCause: "Not wearing PPEs Unsafe act",
    correctiveAction: "Instruct the relevant employees on using of PPEs",
    time: "10.30am",
    lostTime: "2h",
  },
  {
    row: 13,
    department: "Finsh Goods",
    employeeName: "Upul Priyantha",
    empNo: "MP",
    date: "2026.04.28",
    description: "1300 Tire was fallen on the leg during handling",
    lineMachine: "Finsh Goods",
    accidentType: "Medical",
    injuryType: "Leg",
    rootCause: "Unsafe act. The relevant employee has handled the perticular tire alone",
    correctiveAction: "Instruct the employees handle such tire with few others",
    time: "3.45pm",
    lostTime: "0",
  },
  {
    row: 14,
    department: "Production",
    employeeName: "Madushan",
    empNo: "MP",
    date: "2026.04.29",
    description: "Finger injury during band loadng to the band moving trolley",
    lineMachine: "Production (Sand blast)",
    accidentType: "Medical",
    injuryType: "Finger",
    rootCause: "Unsafe band  loading to the trolley",
    correctiveAction: "Instruct the relevant employees on safe loading and unlaoding of bands",
    time: "2.45pm",
    lostTime: "45m",
  },
  {
    row: 15,
    department: "Production",
    employeeName: "Krishna",
    empNo: "MP",
    date: "2026.05.04",
    description: "Finger injury due to hitting the 1300 mold in the 1100 press",
    lineMachine: "Production (800 press)",
    accidentType: "Medical",
    injuryType: "Finger",
    rootCause:
      "Unsafe act. This relevant mold has de-railed and this employess has gone to rail the mold mannual due to which his finger was dammaged.",
    correctiveAction: "Repaired the rail track and advised the employees not do such unsafe acts.",
    time: "1.30pm",
    lostTime: "2h",
    monthlyLostHours: "2h 45m",
  },
  {
    row: 16,
    department: "Finsh Goods",
    employeeName: "Samantha",
    empNo: "51050",
    date: "2026.05.05",
    description: "Tire fallen on a leg while handling",
    lineMachine: "Finsh Goods",
    accidentType: "Medical",
    injuryType: "Leg",
    rootCause: "Unsafe act. The relevant employee has handled the perticular tire alone",
    correctiveAction: "Instruct the employees handle such tire with few others",
    time: "2.45pm",
    lostTime: "45m",
  },
  {
    row: 17,
    department: "Production",
    employeeName: "Amitha",
    empNo: "50245",
    date: "2026.05.08",
    description: "1400 tire was fallen on the left leg",
    lineMachine: "Produciton tire rework",
    accidentType: "Medical",
    injuryType: "Leg",
    rootCause: "Unsafe act. The relevant employee has handled the perticular tire alone",
    correctiveAction: "Instruct the employees handle such tire with few others",
    time: "3.50pm",
    lostTime: "0",
  },
];

const WORKING_HOURS = [
  { month: 1, hours: 72349 },
  { month: 2, hours: 70880 },
  { month: 3, hours: 67126 },
  { month: 4, hours: 67626 },
  { month: 5, hours: 70099 },
];

const MEDICAL_EXPENSES_BY_MONTH = [
  { month: 1, amount: 0 },
  { month: 2, amount: 123980 },
  { month: 3, amount: 7900 },
  { month: 4, amount: 10300 },
  { month: 5, amount: 113440 },
];

const MEDICAL_EXPENSES_BY_DEPARTMENT = [
  { department: "Engineering", amount: 0 },
  { department: "Mold", amount: 2500 },
  { department: "Production", amount: 121480 },
  { department: "QC", amount: 2500 },
  { department: "R&T", amount: 0 },
  { department: "Stores RM", amount: 2500 },
  { department: "Stores FG", amount: 13060 },
  { department: "Other", amount: 0 },
];

const ROOT_CAUSE_SUMMARY = [
  { name: "Employee Negligence (Not wearing PPEs)", count: 3 },
  { name: "Employee Negligence (Unsafe Act)", count: 9 },
  { name: "Unsafe Stacking", count: 0 },
  { name: "Machine / Equipment Fault", count: 1 },
  { name: "Operational Issues (Existing Engineering controls required further improvement)", count: 0 },
];

const NEAR_MISS_UNSAFE_SUMMARY = [
  { month: 1, hseTeam: 27, shopFloor: 0, completed: 22, pending: 5 },
  { month: 2, hseTeam: 29, shopFloor: 3, completed: 22, pending: 7 },
  { month: 3, hseTeam: 28, shopFloor: 5, completed: 20, pending: 8 },
  { month: 4, hseTeam: 23, shopFloor: 4, completed: 18, pending: 5 },
  { month: 5, hseTeam: 21, shopFloor: 8, completed: 21, pending: 8 },
];

function increment(counter: CounterName, field: keyof Counter) {
  counters[counter][field] += 1;
}

function addWarning(message: string) {
  warnings.push(message);
}

function pad(value: number, width = 2) {
  return String(value).padStart(width, "0");
}

function slug(value: string) {
  const out = value
    .trim()
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return out || "UNKNOWN";
}

function monthName(month: number) {
  return new Date(Date.UTC(YEAR, month - 1, 1)).toLocaleString("en", {
    month: "short",
    timeZone: "UTC",
  });
}

function dateFromParts(value: string) {
  const [year, month, day] = value.split(/[.-]/).map((part) => Number(part));
  if (!year || !month || !day) {
    throw new Error(`Invalid date in manual import data: ${value}`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function monthStart(month: number) {
  return new Date(Date.UTC(YEAR, month - 1, 1));
}

function parseLostMinutes(value: string) {
  const raw = value.trim().toLowerCase();
  if (!raw || raw === "0") return 0;

  let minutes = 0;
  const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*h/);
  const minuteMatch = raw.match(/(\d+)\s*m/);

  if (hourMatch) minutes += Math.round(Number(hourMatch[1]) * 60);
  if (minuteMatch) minutes += Number(minuteMatch[1]);

  if (!hourMatch && !minuteMatch) {
    const numeric = Number(raw);
    if (!Number.isNaN(numeric)) return Math.round(numeric * 60);
    addWarning(`Could not parse lost time "${value}". Imported as 0 minutes.`);
    return 0;
  }

  return minutes;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function departmentMasterFor(raw: string) {
  const normalized = normalizeKey(raw);
  const master = DEPARTMENT_MASTERS.find((item) =>
    item.aliases.some((alias) => normalizeKey(alias) === normalized),
  );

  if (!master) {
    addWarning(`Unknown department "${raw}" normalized to Other.`);
    return DEPARTMENT_MASTERS.find((item) => item.name === "Other")!;
  }

  if (raw.trim() !== master.name) {
    addWarning(`Department "${raw}" normalized to "${master.name}".`);
  }
  return master;
}

function normalizeIncidentType(raw: string) {
  const value = normalizeKey(raw);
  if (value.includes("1st") || value.includes("first")) return "First Aid";
  if (value.includes("medical")) return "Medical Treatment";
  if (value.includes("report")) return "Reportable";
  addWarning(`Unknown accident type "${raw}" normalized to Other.`);
  return "Other";
}

function normalizeInjuryType(raw: string) {
  const value = normalizeKey(raw);
  if (value.includes("hand")) return "Hand Injury";
  if (value.includes("finger")) return "Finger Injury";
  if (value.includes("eye")) return "Eye Injury";
  if (value.includes("leg")) return "Leg Injury";
  if (value.includes("forehead") || value.includes("head")) return "Head / Forehead Injury";
  return raw.trim() || "Other";
}

function classifyRootCause(raw: string) {
  const value = normalizeKey(raw);
  if (/(^| )ppes?( |$)/.test(value)) {
    return { name: "Employee Negligence (Not wearing PPEs)", category: "Employee Negligence" };
  }
  if (
    value.includes("machine") ||
    value.includes("equipment") ||
    value.includes("pnuematic") ||
    value.includes("pneumatic") ||
    value.includes("mal func")
  ) {
    return { name: "Machine / Equipment Fault", category: "Equipment" };
  }
  if (value.includes("work environment")) {
    return { name: "Unsafe Work Environment", category: "Workplace" };
  }
  if (
    value.includes("unsafe") ||
    value.includes("improper") ||
    value.includes("slipped") ||
    value.includes("handled")
  ) {
    return { name: "Employee Negligence (Unsafe Act)", category: "Employee Negligence" };
  }
  addWarning(`Root cause "${raw}" did not match a known category and was normalized to Other.`);
  return { name: "Other", category: "Other" };
}

function statusFromText(raw?: string) {
  if (!raw) return RecordStatus.PENDING;
  return raw.toLowerCase().includes("complete") ? RecordStatus.COMPLETED : RecordStatus.PENDING;
}

function severityForIncidentType(incidentType: string) {
  if (incidentType === "Reportable") return IncidentSeverity.HIGH;
  if (incidentType === "Medical Treatment") return IncidentSeverity.MEDIUM;
  return IncidentSeverity.LOW;
}

function resolveWorkbookPath() {
  const explicit =
    process.env.IMPORT_WORKBOOK_PATH?.trim() ||
    process.env.HSE_IMPORT_WORKBOOK?.trim() ||
    process.env.MAY_EXCEL_WORKBOOK?.trim();

  const candidates = [
    explicit,
    path.resolve(backendDir, "..", "data", "Accident Summary - May.xlsx"),
    path.resolve(backendDir, "..", "data", "Accident Summary - May (1).xlsx"),
    path.resolve(backendDir, "..", "deta", "Accident Summary - May.xlsx"),
    path.resolve(backendDir, "..", "deta", "Accident Summary - May (1).xlsx"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `Workbook not found. Checked:\n${candidates.map((candidate) => `- ${candidate}`).join("\n")}`,
    );
  }

  if (explicit && path.resolve(found) === path.resolve(explicit)) {
    addWarning(`Using workbook path from environment: "${found}".`);
  }

  if (found.includes(`${path.sep}deta${path.sep}`)) {
    addWarning(
      `Workbook was not found under data; using discovered path "${found}". Move it to data if you want the requested path used.`,
    );
  }

  return found;
}

async function ensureDepartment(master: DepartmentMaster) {
  const byCode = await prisma.department.findUnique({ where: { code: master.code } });
  const byName = await prisma.department.findUnique({ where: { name: master.name } });

  if (byCode && byName && byCode.id !== byName.id) {
    increment("departments", "skipped");
    addWarning(
      `Department code "${master.code}" and name "${master.name}" already belong to different records. Using the name match for imports.`,
    );
    return byName;
  }

  if (byCode) {
    increment("departments", "updated");
    return prisma.department.update({
      where: { id: byCode.id },
      data: { name: master.name, isActive: true },
    });
  }

  if (byName) {
    increment("departments", "updated");
    return prisma.department.update({
      where: { id: byName.id },
      data: { code: master.code, isActive: true },
    });
  }

  increment("departments", "inserted");
  return prisma.department.create({
    data: { code: master.code, name: master.name, isActive: true },
  });
}

async function ensureNamedRecord(
  model: any,
  counter: CounterName,
  name: string,
  extra: Record<string, unknown> = {},
) {
  const existing = await model.findUnique({ where: { name } });
  if (existing) {
    increment(counter, "updated");
    return model.update({ where: { name }, data: { ...extra, isActive: true } });
  }

  increment(counter, "inserted");
  return model.create({ data: { name, ...extra, isActive: true } });
}

async function ensureShift(name?: string) {
  const cleaned = name?.trim();
  if (!cleaned) return null;

  const existing = await prisma.shift.findUnique({ where: { name: cleaned } });
  if (existing) {
    increment("shifts", "updated");
    return prisma.shift.update({ where: { name: cleaned }, data: { isActive: true } });
  }

  increment("shifts", "inserted");
  addWarning(`Workbook Shift column contains "${cleaned}". Imported it as a Shift name because no shift times are provided.`);
  return prisma.shift.create({ data: { name: cleaned, isActive: true } });
}

async function ensureEmployee(row: AccidentRow, departmentId: string, shiftId: string | null) {
  const empNo = row.empNo.trim();
  if (!/^\d+$/.test(empNo)) {
    increment("employees", "skipped");
    addWarning(
      `Data row ${row.row}: employee "${row.employeeName}" has non-unique EMP No "${row.empNo}". Employee was not created; details are kept on the incident summary.`,
    );
    return null;
  }

  const existing = await prisma.employee.findUnique({ where: { empNo } });
  const data = {
    name: row.employeeName,
    departmentId,
    shiftId,
    isActive: true,
  };

  if (existing) {
    increment("employees", "updated");
    return prisma.employee.update({ where: { empNo }, data });
  }

  increment("employees", "inserted");
  return prisma.employee.create({ data: { empNo, ...data } });
}

async function ensureMachine(row: AccidentRow, departmentId: string) {
  const name = row.lineMachine.trim();
  if (!name) return null;

  const code = `${IMPORT_PREFIX}-MACH-${slug(name)}`;
  const existing = await prisma.machine.findUnique({ where: { code } });
  const data = { name, departmentId, isActive: true };

  if (existing) {
    increment("machines", "updated");
    return prisma.machine.update({ where: { code }, data });
  }

  increment("machines", "inserted");
  return prisma.machine.create({ data: { code, ...data } });
}

function buildInvestigationSummary(
  row: AccidentRow,
  normalizedDepartment: string,
  normalizedIncidentType: string,
  normalizedInjuryType: string,
  normalizedRootCause: string,
  employeeLinked: boolean,
) {
  const parts = [
    `Source: ${SOURCE}`,
    SOURCE_NOTE,
    `Sheet: Data row ${row.row}`,
    `Original department: ${row.department}`,
    `Normalized department: ${normalizedDepartment}`,
    `Original shift: ${row.shift || "blank"}`,
    `Employee: ${row.employeeName} (${row.empNo})`,
    employeeLinked ? "Employee linked by EMP No." : "Employee not linked because EMP No is missing or non-unique.",
    `Original accident type: ${row.accidentType}`,
    `Normalized accident type: ${normalizedIncidentType}`,
    `Original injury type: ${row.injuryType}`,
    `Normalized injury type: ${normalizedInjuryType}`,
    `Original root cause: ${row.rootCause}`,
    `Normalized root cause: ${normalizedRootCause}`,
  ];

  if (row.monthlyLostHours) parts.push(`Workbook monthly lost-hours cell: ${row.monthlyLostHours}`);
  if (row.quarterlyLostHours) parts.push(`Workbook quarterly lost-hours cell: ${row.quarterlyLostHours}`);

  return parts.join(" | ");
}

function buildObservationStatuses(summary: (typeof NEAR_MISS_UNSAFE_SUMMARY)[number]) {
  const total = summary.hseTeam + summary.shopFloor;
  const statuses: Record<"hseTeam" | "shopFloor", RecordStatus[]> = {
    hseTeam: [],
    shopFloor: [],
  };

  if (summary.completed + summary.pending === total) {
    let completedLeft = summary.completed;
    for (let i = 0; i < summary.hseTeam; i += 1) {
      statuses.hseTeam.push(completedLeft > 0 ? RecordStatus.COMPLETED : RecordStatus.PENDING);
      completedLeft -= completedLeft > 0 ? 1 : 0;
    }
    for (let i = 0; i < summary.shopFloor; i += 1) {
      statuses.shopFloor.push(completedLeft > 0 ? RecordStatus.COMPLETED : RecordStatus.PENDING);
      completedLeft -= completedLeft > 0 ? 1 : 0;
    }
    return statuses;
  }

  if (summary.completed + summary.pending === summary.hseTeam) {
    for (let i = 0; i < summary.hseTeam; i += 1) {
      statuses.hseTeam.push(i < summary.completed ? RecordStatus.COMPLETED : RecordStatus.PENDING);
    }
    for (let i = 0; i < summary.shopFloor; i += 1) {
      statuses.shopFloor.push(RecordStatus.PENDING);
    }
    if (summary.shopFloor > 0) {
      addWarning(
        `${monthName(summary.month)} near miss/unsafe summary has shop-floor count ${summary.shopFloor}, but Completed/Pending counts only reconcile to HSE Team total. Shop-floor records were imported as PENDING.`,
      );
    }
    return statuses;
  }

  addWarning(
    `${monthName(summary.month)} near miss/unsafe summary counts do not reconcile. All aggregate observation records for that month were imported as PENDING.`,
  );
  statuses.hseTeam = Array.from({ length: summary.hseTeam }, () => RecordStatus.PENDING);
  statuses.shopFloor = Array.from({ length: summary.shopFloor }, () => RecordStatus.PENDING);
  return statuses;
}

async function upsertWorkingHours(month: number, hours: number) {
  const existing = await prisma.workingHours.findFirst({
    where: { year: YEAR, month, departmentId: null },
  });

  const data = {
    year: YEAR,
    month,
    departmentId: null,
    totalEmployees: 0,
    regularHours: hours,
    overtimeHours: 0,
    remarks: `${SOURCE}; ${SOURCE_NOTE}; Sheet: Accidents rows 163:168; total all departments; employee count not available.`,
  };

  if (existing) {
    if (!existing.remarks?.includes(SOURCE)) {
      increment("workingHours", "skipped");
      addWarning(
        `Working hours for ${YEAR}-${pad(month)} already exist without this import marker. Skipped to avoid overwriting user-entered data.`,
      );
      return;
    }

    increment("workingHours", "updated");
    await prisma.workingHours.update({ where: { id: existing.id }, data });
    return;
  }

  increment("workingHours", "inserted");
  await prisma.workingHours.create({ data });
}

async function upsertObservationSummary() {
  for (const summary of NEAR_MISS_UNSAFE_SUMMARY) {
    const statuses = buildObservationStatuses(summary);
    const observationDate = monthStart(summary.month);

    for (const [sourceKey, count] of [
      ["hseTeam", summary.hseTeam],
      ["shopFloor", summary.shopFloor],
    ] as const) {
      const reportedBy = sourceKey === "hseTeam" ? "HSE Team" : "Shop Floor Employee";

      for (let index = 1; index <= count; index += 1) {
        const observationNo = `${IMPORT_PREFIX}-OBS-M${pad(summary.month)}-${sourceKey === "hseTeam" ? "HSE" : "SHOP"}-${pad(index, 3)}`;
        const existing = await prisma.observation.findUnique({ where: { observationNo } });
        const data = {
          observationDate,
          observationTime: null,
          departmentId: null,
          type: ObservationType.UNSAFE_CONDITION,
          riskLevel: RiskLevel.LOW,
          description: `${SOURCE}; ${SOURCE_NOTE}; Sheet: Accidents row ${185 + summary.month}. Aggregate near miss / unsafe condition summary for ${monthName(summary.month)} ${YEAR}. Individual observation detail is not available in the workbook.`,
          actionTaken: "Aggregate workbook summary only; no individual corrective action text is available.",
          reportedBy,
          status: statuses[sourceKey][index - 1] ?? RecordStatus.PENDING,
          isDeleted: false,
        };

        if (existing) {
          increment("observations", "updated");
          await prisma.observation.update({ where: { observationNo }, data });
        } else {
          increment("observations", "inserted");
          await prisma.observation.create({ data: { observationNo, ...data } });
        }
      }
    }
  }
}

function compareRootCauseSummary(actual: Map<string, number>) {
  for (const item of ROOT_CAUSE_SUMMARY) {
    const importedCount = actual.get(item.name) ?? 0;
    if (importedCount !== item.count) {
      addWarning(
        `Root causes sheet shows "${item.name}" count ${item.count}, but row-level incident mapping imported ${importedCount}. Row-level text was kept instead of forcing the summary total.`,
      );
    }
  }

  for (const [name, count] of actual) {
    if (!ROOT_CAUSE_SUMMARY.some((item) => item.name === name)) {
      addWarning(
        `Row-level incident mapping imported root cause "${name}" count ${count}, but that category is not listed in the workbook Root causes summary.`,
      );
    }
  }
}

function compareMedicalExpenseSummaries() {
  const monthlyTotal = MEDICAL_EXPENSES_BY_MONTH.reduce((sum, item) => sum + item.amount, 0);
  const departmentTotal = MEDICAL_EXPENSES_BY_DEPARTMENT.reduce((sum, item) => sum + item.amount, 0);

  if (monthlyTotal !== departmentTotal) {
    addWarning(
      `Medical Expenses sheet totals do not reconcile: monthly total ${monthlyTotal} LKR, department total ${departmentTotal} LKR. Imported monthly totals and linked each month to the first imported medical incident for that month so existing dashboard totals can display the workbook monthly amount.`,
    );
  }
}

async function main() {
  const workbookPath = resolveWorkbookPath();
  console.log(`Using workbook source: ${workbookPath}`);

  const departmentByName = new Map<string, Awaited<ReturnType<typeof ensureDepartment>>>();
  for (const master of DEPARTMENT_MASTERS) {
    const department = await ensureDepartment(master);
    departmentByName.set(master.name, department);
  }

  await ensureNamedRecord(prisma.incidentType, "incidentTypes", "First Aid");
  await ensureNamedRecord(prisma.incidentType, "incidentTypes", "Medical Treatment");
  await ensureNamedRecord(prisma.incidentType, "incidentTypes", "Reportable");
  await ensureNamedRecord(prisma.incidentType, "incidentTypes", "Other");

  await ensureNamedRecord(prisma.injuryType, "injuryTypes", "Hand Injury");
  await ensureNamedRecord(prisma.injuryType, "injuryTypes", "Finger Injury");
  await ensureNamedRecord(prisma.injuryType, "injuryTypes", "Eye Injury");
  await ensureNamedRecord(prisma.injuryType, "injuryTypes", "Leg Injury");
  await ensureNamedRecord(prisma.injuryType, "injuryTypes", "Head / Forehead Injury");
  await ensureNamedRecord(prisma.injuryType, "injuryTypes", "Other");

  for (const item of ROOT_CAUSE_SUMMARY) {
    const category = item.name.includes("Employee Negligence")
      ? "Employee Negligence"
      : item.name.includes("Machine")
        ? "Equipment"
        : "Other";
    await ensureNamedRecord(prisma.rootCause, "rootCauses", item.name, { category });
  }
  await ensureNamedRecord(prisma.rootCause, "rootCauses", "Unsafe Work Environment", { category: "Workplace" });
  await ensureNamedRecord(prisma.rootCause, "rootCauses", "Other", { category: "Other" });

  const importedIncidentsByMonth = new Map<number, { id: string; incidentNo: string; type: string }[]>();
  const rootCauseCounts = new Map<string, number>();

  for (const row of ACCIDENT_ROWS) {
    const departmentMaster = departmentMasterFor(row.department);
    const department = departmentByName.get(departmentMaster.name);
    if (!department) throw new Error(`Department "${departmentMaster.name}" was not prepared.`);

    const shift = await ensureShift(row.shift);
    const employee = await ensureEmployee(row, department.id, shift?.id ?? null);
    const machine = await ensureMachine(row, department.id);

    const incidentTypeName = normalizeIncidentType(row.accidentType);
    const injuryTypeName = normalizeInjuryType(row.injuryType);
    const rootCauseInfo = classifyRootCause(row.rootCause);

    rootCauseCounts.set(rootCauseInfo.name, (rootCauseCounts.get(rootCauseInfo.name) ?? 0) + 1);

    const incidentType = await ensureNamedRecord(prisma.incidentType, "incidentTypes", incidentTypeName);
    const injuryType = await ensureNamedRecord(prisma.injuryType, "injuryTypes", injuryTypeName);
    const rootCause = await ensureNamedRecord(prisma.rootCause, "rootCauses", rootCauseInfo.name, {
      category: rootCauseInfo.category,
    });

    const incidentNo = `${IMPORT_PREFIX}-DATA-R${pad(row.row, 3)}`;
    const existingIncident = await prisma.incident.findUnique({ where: { incidentNo } });
    const incidentDate = dateFromParts(row.date);
    const status = statusFromText(row.caStatus);
    const data = {
      incidentDate,
      incidentTime: row.time || null,
      departmentId: department.id,
      shiftId: shift?.id ?? null,
      employeeId: employee?.id ?? null,
      machineId: machine?.id ?? null,
      incidentTypeId: incidentType.id,
      injuryTypeId: injuryType.id,
      rootCauseId: rootCause.id,
      description: row.description,
      immediateAction: null,
      correctiveAction: row.correctiveAction,
      investigationSummary: buildInvestigationSummary(
        row,
        departmentMaster.name,
        incidentTypeName,
        injuryTypeName,
        rootCauseInfo.name,
        Boolean(employee),
      ),
      lostMinutes: parseLostMinutes(row.lostTime),
      medicalExpenseTotal: 0,
      severity: severityForIncidentType(incidentTypeName),
      status,
      isDeleted: false,
      createdById: null,
    };

    const incident = existingIncident
      ? await prisma.incident.update({ where: { incidentNo }, data })
      : await prisma.incident.create({ data: { incidentNo, ...data } });
    increment("incidents", existingIncident ? "updated" : "inserted");

    const month = incidentDate.getUTCMonth() + 1;
    const monthIncidents = importedIncidentsByMonth.get(month) ?? [];
    monthIncidents.push({ id: incident.id, incidentNo, type: incidentTypeName });
    importedIncidentsByMonth.set(month, monthIncidents);

    if (row.correctiveAction.trim()) {
      const actionNo = `${IMPORT_PREFIX}-CA-R${pad(row.row, 3)}`;
      const existingAction = await prisma.correctiveAction.findUnique({ where: { actionNo } });
      const actionData = {
        incidentId: incident.id,
        observationId: null,
        action: row.correctiveAction,
        responsiblePerson: null,
        dueDate: null,
        completedDate: null,
        status,
        remarks: `${SOURCE}; ${SOURCE_NOTE}; Sheet: Data row ${row.row}; original CA status: ${row.caStatus || "blank"}.`,
        isDeleted: false,
      };

      if (existingAction) {
        increment("correctiveActions", "updated");
        await prisma.correctiveAction.update({ where: { actionNo }, data: actionData });
      } else {
        increment("correctiveActions", "inserted");
        await prisma.correctiveAction.create({ data: { actionNo, ...actionData } });
      }
    }
  }

  compareRootCauseSummary(rootCauseCounts);
  compareMedicalExpenseSummaries();

  for (const item of WORKING_HOURS) {
    await upsertWorkingHours(item.month, item.hours);
  }

  for (const item of MEDICAL_EXPENSES_BY_MONTH.filter((expense) => expense.amount > 0)) {
    const monthIncidents = importedIncidentsByMonth.get(item.month) ?? [];
    const targetIncident = monthIncidents.find((incident) => incident.type === "Medical Treatment") ?? monthIncidents[0];

    if (!targetIncident) {
      increment("medicalExpenses", "skipped");
      addWarning(
        `Medical expense for ${monthName(item.month)} ${YEAR} was skipped because no imported incident exists for that month.`,
      );
      continue;
    }

    const expenseNo = `${IMPORT_PREFIX}-MED-M${pad(item.month)}`;
    const existingExpense = await prisma.medicalExpense.findUnique({ where: { expenseNo } });
    const expenseData = {
      incidentId: targetIncident.id,
      expenseDate: monthStart(item.month),
      amount: item.amount,
      expenseType: "Workbook monthly medical expense summary",
      provider: null,
      billNo: null,
      remarks: `${SOURCE}; ${SOURCE_NOTE}; Sheet: Medical Expenses rows 3:7. Workbook has monthly total only; linked to incident ${targetIncident.incidentNo} for dashboard aggregation.`,
      isDeleted: false,
    };

    if (existingExpense) {
      increment("medicalExpenses", "updated");
      await prisma.medicalExpense.update({ where: { expenseNo }, data: expenseData });
    } else {
      increment("medicalExpenses", "inserted");
      await prisma.medicalExpense.create({ data: { expenseNo, ...expenseData } });
    }

    await prisma.incident.update({
      where: { id: targetIncident.id },
      data: { medicalExpenseTotal: item.amount },
    });
  }

  await upsertObservationSummary();

  console.log("");
  console.log("May Excel manual import summary");
  console.log("--------------------------------");
  console.log(`Departments inserted/updated/skipped: ${counters.departments.inserted}/${counters.departments.updated}/${counters.departments.skipped}`);
  console.log(`Employees inserted/updated/skipped: ${counters.employees.inserted}/${counters.employees.updated}/${counters.employees.skipped}`);
  console.log(`Shifts inserted/updated/skipped: ${counters.shifts.inserted}/${counters.shifts.updated}/${counters.shifts.skipped}`);
  console.log(`Machines/lines inserted/updated/skipped: ${counters.machines.inserted}/${counters.machines.updated}/${counters.machines.skipped}`);
  console.log(`Incident types inserted/updated/skipped: ${counters.incidentTypes.inserted}/${counters.incidentTypes.updated}/${counters.incidentTypes.skipped}`);
  console.log(`Injury types inserted/updated/skipped: ${counters.injuryTypes.inserted}/${counters.injuryTypes.updated}/${counters.injuryTypes.skipped}`);
  console.log(`Root causes inserted/updated/skipped: ${counters.rootCauses.inserted}/${counters.rootCauses.updated}/${counters.rootCauses.skipped}`);
  console.log(`Incidents imported inserted/updated/skipped: ${counters.incidents.inserted}/${counters.incidents.updated}/${counters.incidents.skipped}`);
  console.log(`Corrective actions imported inserted/updated/skipped: ${counters.correctiveActions.inserted}/${counters.correctiveActions.updated}/${counters.correctiveActions.skipped}`);
  console.log(`Medical expenses imported inserted/updated/skipped: ${counters.medicalExpenses.inserted}/${counters.medicalExpenses.updated}/${counters.medicalExpenses.skipped}`);
  console.log(`Working hours imported inserted/updated/skipped: ${counters.workingHours.inserted}/${counters.workingHours.updated}/${counters.workingHours.skipped}`);
  console.log(`Near miss / unsafe records imported inserted/updated/skipped: ${counters.observations.inserted}/${counters.observations.updated}/${counters.observations.skipped}`);
  console.log(`Warnings/skipped notes: ${warnings.length}`);

  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

