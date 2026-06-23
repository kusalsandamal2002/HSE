import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertByName(model: any, name: string, extra: Record<string, unknown> = {}) {
  return model.upsert({ where: { name }, update: extra, create: { name, ...extra } });
}

async function main() {
  const passwordHash = await bcrypt.hash("Admin@123", 10);
  await prisma.user.upsert({
    where: { email: "admin@hse.local" },
    update: { passwordHash, role: "ADMIN", isActive: true },
    create: { name: "System Admin", email: "admin@hse.local", passwordHash, role: "ADMIN" },
  });

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

  console.log("Seed complete. Login: admin@hse.local / Admin@123");
}

main().finally(async () => prisma.$disconnect());