import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(backendDir, ".env") });

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const demoIncident = await prisma.incident.findUnique({ where: { incidentNo: "INC-DEMO-001" } });
  let incidentsCleaned = 0;
  let actionsCleaned = 0;
  let expensesCleaned = 0;
  let workingHoursCleaned = 0;

  if (demoIncident && demoIncident.description.includes("Demo first-aid incident created for development testing")) {
    const actions = await prisma.correctiveAction.updateMany({
      where: { incidentId: demoIncident.id, isDeleted: false },
      data: { isDeleted: true },
    });
    const expenses = await prisma.medicalExpense.updateMany({
      where: { incidentId: demoIncident.id, isDeleted: false },
      data: { isDeleted: true },
    });
    await prisma.incident.update({ where: { id: demoIncident.id }, data: { isDeleted: true } });
    incidentsCleaned = 1;
    actionsCleaned = actions.count;
    expensesCleaned = expenses.count;
  }

  const prod = await prisma.department.findUnique({ where: { code: "PROD" } });
  if (prod) {
    const deletedDeptHours = await prisma.workingHours.deleteMany({
      where: {
        year,
        month,
        departmentId: prod.id,
        totalEmployees: 80,
        regularHours: 14500,
        overtimeHours: 1200,
        remarks: null,
      },
    });
    workingHoursCleaned += deletedDeptHours.count;
  }

  const deletedCompanyHours = await prisma.workingHours.deleteMany({
    where: {
      year,
      month,
      departmentId: null,
      totalEmployees: 300,
      regularHours: 52000,
      overtimeHours: 4500,
      remarks: null,
    },
  });
  workingHoursCleaned += deletedCompanyHours.count;

  console.log("Demo data cleanup complete");
  console.log(`Demo incidents soft-deleted: ${incidentsCleaned}`);
  console.log(`Demo corrective actions soft-deleted: ${actionsCleaned}`);
  console.log(`Demo medical expenses soft-deleted: ${expensesCleaned}`);
  console.log(`Exact seed working-hour rows deleted: ${workingHoursCleaned}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });