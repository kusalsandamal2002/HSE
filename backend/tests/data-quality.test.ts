import test from "node:test";
import assert from "node:assert/strict";
import { buildDataQualityComparison } from "../src/modules/data-quality/data-quality.service";

test("buildDataQualityComparison marks mismatches and exposes issue details", () => {
  const report = buildDataQualityComparison(
    {
      year: 2026,
      month: 5,
      sourceTotals: {
        totalAccidents: 13,
        firstAidCount: 2,
        medicalTreatmentCount: 11,
        reportableCount: 0,
        totalMedicalExpenses: 255620,
        nearMissUnsafeCount: 148,
        workingHoursTotal: 4000,
      },
      databaseTotals: {
        totalAccidents: 12,
        firstAidCount: 2,
        medicalTreatmentCount: 10,
        reportableCount: 0,
        totalMedicalExpenses: 250000,
        nearMissUnsafeCount: 148,
        workingHoursTotal: 3900,
      },
      departmentIncidentCounts: [{ department: "Production", count: 8 }],
    },
  );

  assert.equal(report.overallStatus, "MISMATCH");
  assert.equal(report.issues.length, 4);
  assert.match(report.issues[0].message, /Accidents/);
  assert.equal(report.kpis[0].status, "Mismatch");
});
