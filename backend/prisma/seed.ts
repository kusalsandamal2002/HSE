import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

const DEFAULT_DEV_ADMIN_PASSWORD = "Admin@123";

function validateProductionAdminPassword(password: string) {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) return;

  const strongEnough =
    password.length >= 10 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  if (!strongEnough) {
    throw new Error(
      "ADMIN_PASSWORD must be at least 10 characters and include uppercase, lowercase, number, and symbol in production."
    );
  }

  if (password === DEFAULT_DEV_ADMIN_PASSWORD) {
    throw new Error("Default development admin password cannot be used in production.");
  }
}

async function upsertByName(model: any, name: string, extra: Record<string, unknown> = {}) {
  return model.upsert({ where: { name }, update: extra, create: { name, ...extra } });
}

async function upsertAdminUser() {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const adminPassword = configuredPassword || DEFAULT_DEV_ADMIN_PASSWORD;

  validateProductionAdminPassword(adminPassword);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@hse.local" },
  });

  if (existingAdmin) {
    const updateData: Record<string, unknown> = {
      name: "System Admin",
      role: "ADMIN",
      isActive: true,
    };

    if (configuredPassword) {
      updateData.passwordHash = await bcrypt.hash(configuredPassword, 10);
    }

    await prisma.user.update({
      where: { email: "admin@hse.local" },
      data: updateData,
    });

    console.log(
      configuredPassword
        ? "Admin user updated with ADMIN_PASSWORD from environment."
        : "Admin user exists. Password was preserved because ADMIN_PASSWORD was not set."
    );
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.create({
    data: {
      name: "System Admin",
      email: "admin@hse.local",
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log(
    configuredPassword
      ? "Admin user created with ADMIN_PASSWORD from environment."
      : "Admin user created with development default password. Change it before production use."
  );
}

async function main() {
  await upsertAdminUser();

  const departments = [
    ["PROD", "Production"],
    ["ENG-M", "Engineering"],
    ["ENG-MOLD", "Mold"],
    ["QC", "QC"],
    ["RT", "R&T"],
    ["SRM", "Stores RM"],
    ["SFG", "Stores FG"],
    ["OTHER", "Other"],
  ];
  for (const [code, name] of departments) {
    await prisma.department.upsert({ where: { code }, update: { name, isActive: true }, create: { code, name } });
  }

  for (const shift of [
    { name: "General", startTime: "08:00", endTime: "17:00" },
    { name: "Day Shift", startTime: "06:00", endTime: "18:00" },
    { name: "Night Shift", startTime: "18:00", endTime: "06:00" },
  ]) {
    await prisma.shift.upsert({ where: { name: shift.name }, update: { ...shift, isActive: true }, create: shift });
  }

  for (const name of ["First Aid", "Medical Treatment", "Reportable", "Lost Time Injury", "Near Miss", "Unsafe Condition", "Other"]) {
    await upsertByName(prisma.incidentType, name, { isActive: true });
  }

  for (const name of ["Cut", "Bruise", "Burn", "Eye Injury", "Hand Injury", "Finger Injury", "Leg Injury", "Head / Forehead Injury", "Back Pain", "No Injury", "Other"]) {
    await upsertByName(prisma.injuryType, name, { isActive: true });
  }

  for (const rc of [
    ["Employee Negligence (Not wearing PPEs)", "Employee Negligence"],
    ["Employee Negligence (Unsafe Act)", "Employee Negligence"],
    ["PPE Not Used", "Employee Negligence"],
    ["Unsafe Act", "Behaviour"],
    ["Unsafe Stacking", "Storage"],
    ["Machine / Equipment Fault", "Equipment"],
    ["Operational Issue", "Process"],
    ["Unsafe Work Environment", "Workplace"],
    ["Manual Handling Issue", "Ergonomics"],
    ["Housekeeping Issue", "5S"],
    ["Other", "Other"],
  ]) {
    await prisma.rootCause.upsert({
      where: { name: rc[0] },
      update: { category: rc[1], isActive: true },
      create: { name: rc[0], category: rc[1] },
    });
  }

  const prod = await prisma.department.findUnique({ where: { code: "PROD" } });
  const general = await prisma.shift.findUnique({ where: { name: "General" } });
  if (prod && general) {
    await prisma.employee.upsert({
      where: { empNo: "EMP-001" },
      update: { name: "Demo Employee", departmentId: prod.id, shiftId: general.id, isActive: true },
      create: { empNo: "EMP-001", name: "Demo Employee", designation: "Operator", departmentId: prod.id, shiftId: general.id },
    });
    await prisma.machine.upsert({
      where: { code: "LINE-01" },
      update: { name: "Line 01", departmentId: prod.id, isActive: true },
      create: { code: "LINE-01", name: "Line 01", departmentId: prod.id },
    });
  }

  await prisma.tvDashboardSettings.upsert({
    where: { id: "default-tv-settings" },
    update: { companyName: "HSE", dashboardTitle: "HSE Dashboard" },
    create: {
      id: "default-tv-settings",
      companyName: "HSE",
      dashboardTitle: "HSE Dashboard",
      selectedYear: new Date().getFullYear(),
      intervalSeconds: 12,
      languageMode: "EN",
    },
  });

  console.log("Seed complete.");
}

main().finally(async () => prisma.$disconnect());
