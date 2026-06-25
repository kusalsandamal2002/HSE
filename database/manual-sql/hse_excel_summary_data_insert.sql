BEGIN;

-- 1. Department-wise accident summary from Accident Summary - May.xlsx
INSERT INTO "HseAccidentDepartmentSummary"
("id","year","departmentName","firstAidCount","medicalCount","reportableCount","lostHoursExcel","lostHoursCalculated","sourceFile","sourceSheet","sourceRow","sourceHash","updatedAt")
VALUES
('acc_dept_2026_engineering_maintenance',2026,'Engineering - Maintenance',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents',21,'manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_dept_2026_engineering_mold',2026,'Engineering - Mold',1,1,0,2.5,2.5,'Accident Summary - May.xlsx','Accidents',22,'manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_dept_2026_production',2026,'Production',1,6,0,6,6,'Accident Summary - May.xlsx','Accidents',23,'manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_dept_2026_qc',2026,'QC',0,1,0,2,2,'Accident Summary - May.xlsx','Accidents',24,'manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_dept_2026_rt',2026,'R&T',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents',25,'manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_dept_2026_stores_rm',2026,'Stores - RM',0,1,0,1.25,1.25,'Accident Summary - May.xlsx','Accidents',26,'manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_dept_2026_stores_fg',2026,'Stores - FG',0,2,0,0.45,0.75,'Accident Summary - May.xlsx','Accidents',27,'manual_excel_may_2026',CURRENT_TIMESTAMP)
ON CONFLICT ("year","departmentName") DO UPDATE SET
"firstAidCount"=EXCLUDED."firstAidCount",
"medicalCount"=EXCLUDED."medicalCount",
"reportableCount"=EXCLUDED."reportableCount",
"lostHoursExcel"=EXCLUDED."lostHoursExcel",
"lostHoursCalculated"=EXCLUDED."lostHoursCalculated",
"sourceFile"=EXCLUDED."sourceFile",
"sourceSheet"=EXCLUDED."sourceSheet",
"sourceRow"=EXCLUDED."sourceRow",
"sourceHash"=EXCLUDED."sourceHash",
"updatedAt"=CURRENT_TIMESTAMP;

-- 2. Monthly accident summary by department, Jan-May 2026
INSERT INTO "HseAccidentMonthlySummary"
("id","year","month","departmentName","firstAidCount","medicalCount","reportableCount","lostHoursExcel","lostHoursCalculated","sourceFile","sourceSheet","sourceHash","updatedAt")
VALUES
('acc_mon_2026_01_engineering_maintenance',2026,1,'Engineering - Maintenance',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_02_engineering_maintenance',2026,2,'Engineering - Maintenance',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_03_engineering_maintenance',2026,3,'Engineering - Maintenance',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_04_engineering_maintenance',2026,4,'Engineering - Maintenance',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_05_engineering_maintenance',2026,5,'Engineering - Maintenance',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),

('acc_mon_2026_01_engineering_mold',2026,1,'Engineering - Mold',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_02_engineering_mold',2026,2,'Engineering - Mold',1,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_03_engineering_mold',2026,3,'Engineering - Mold',0,1,0,2.5,2.5,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_04_engineering_mold',2026,4,'Engineering - Mold',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_05_engineering_mold',2026,5,'Engineering - Mold',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),

('acc_mon_2026_01_production',2026,1,'Production',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_02_production',2026,2,'Production',1,1,0,1.5,1.5,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_03_production',2026,3,'Production',0,1,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_04_production',2026,4,'Production',0,2,0,2.5,2.5,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_05_production',2026,5,'Production',0,2,0,2,2,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),

('acc_mon_2026_01_qc',2026,1,'QC',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_02_qc',2026,2,'QC',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_03_qc',2026,3,'QC',0,1,0,2,2,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_04_qc',2026,4,'QC',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_05_qc',2026,5,'QC',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),

('acc_mon_2026_01_rt',2026,1,'R&T',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_02_rt',2026,2,'R&T',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_03_rt',2026,3,'R&T',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_04_rt',2026,4,'R&T',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_05_rt',2026,5,'R&T',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),

('acc_mon_2026_01_stores_rm',2026,1,'Stores - RM',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_02_stores_rm',2026,2,'Stores - RM',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_03_stores_rm',2026,3,'Stores - RM',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_04_stores_rm',2026,4,'Stores - RM',0,1,0,1.25,1.25,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_05_stores_rm',2026,5,'Stores - RM',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),

('acc_mon_2026_01_stores_fg',2026,1,'Stores - FG',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_02_stores_fg',2026,2,'Stores - FG',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_03_stores_fg',2026,3,'Stores - FG',0,0,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_04_stores_fg',2026,4,'Stores - FG',0,1,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('acc_mon_2026_05_stores_fg',2026,5,'Stores - FG',0,1,0,0.45,0.75,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP)
ON CONFLICT ("year","month","departmentName") DO UPDATE SET
"firstAidCount"=EXCLUDED."firstAidCount",
"medicalCount"=EXCLUDED."medicalCount",
"reportableCount"=EXCLUDED."reportableCount",
"lostHoursExcel"=EXCLUDED."lostHoursExcel",
"lostHoursCalculated"=EXCLUDED."lostHoursCalculated",
"sourceFile"=EXCLUDED."sourceFile",
"sourceSheet"=EXCLUDED."sourceSheet",
"sourceHash"=EXCLUDED."sourceHash",
"updatedAt"=CURRENT_TIMESTAMP;

-- 3. Working hours vs lost hours, Jan-May 2026
INSERT INTO "HseWorkingLostHoursSummary"
("id","year","month","workingHours","lostHoursExcel","lostHoursCalculated","lostHoursPercent","sourceFile","sourceSheet","sourceHash","updatedAt")
VALUES
('work_lost_2026_01',2026,1,72349,0,0,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('work_lost_2026_02',2026,2,70880,1.5,1.5,0.002116,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('work_lost_2026_03',2026,3,67126,4.5,4.5,0.006704,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('work_lost_2026_04',2026,4,67626,4,4,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('work_lost_2026_05',2026,5,70099,2.45,2.75,0,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP)
ON CONFLICT ("year","month") DO UPDATE SET
"workingHours"=EXCLUDED."workingHours",
"lostHoursExcel"=EXCLUDED."lostHoursExcel",
"lostHoursCalculated"=EXCLUDED."lostHoursCalculated",
"lostHoursPercent"=EXCLUDED."lostHoursPercent",
"sourceFile"=EXCLUDED."sourceFile",
"sourceSheet"=EXCLUDED."sourceSheet",
"sourceHash"=EXCLUDED."sourceHash",
"updatedAt"=CURRENT_TIMESTAMP;

-- 4. Medical monthly summary
INSERT INTO "HseMedicalMonthlySummary"
("id","year","month","amount","sourceFile","sourceSheet","sourceHash","updatedAt")
VALUES
('med_month_2026_01',2026,1,0,'Accident Summary - May.xlsx','Medical Expenses','manual_excel_may_2026',CURRENT_TIMESTAMP),
('med_month_2026_02',2026,2,123980,'Accident Summary - May.xlsx','Medical Expenses','manual_excel_may_2026',CURRENT_TIMESTAMP),
('med_month_2026_03',2026,3,7900,'Accident Summary - May.xlsx','Medical Expenses','manual_excel_may_2026',CURRENT_TIMESTAMP),
('med_month_2026_04',2026,4,10300,'Accident Summary - May.xlsx','Medical Expenses','manual_excel_may_2026',CURRENT_TIMESTAMP),
('med_month_2026_05',2026,5,113440,'Accident Summary - May.xlsx','Medical Expenses','manual_excel_may_2026',CURRENT_TIMESTAMP)
ON CONFLICT ("year","month") DO UPDATE SET
"amount"=EXCLUDED."amount",
"sourceFile"=EXCLUDED."sourceFile",
"sourceSheet"=EXCLUDED."sourceSheet",
"sourceHash"=EXCLUDED."sourceHash",
"updatedAt"=CURRENT_TIMESTAMP;

-- 5. Medical department summary
INSERT INTO "HseMedicalDepartmentSummary"
("id","year","departmentName","amount","sourceFile","sourceSheet","sourceHash","updatedAt")
VALUES
('med_dept_2026_engineering_maintenance',2026,'Engineering - Maintenance',0,'Accident Summary - May.xlsx','Medical Expenses','manual_excel_may_2026',CURRENT_TIMESTAMP),
('med_dept_2026_engineering_mold',2026,'Engineering - Mold',2500,'Accident Summary - May.xlsx','Medical Expenses','manual_excel_may_2026',CURRENT_TIMESTAMP),
('med_dept_2026_production',2026,'Production',121480,'Accident Summary - May.xlsx','Medical Expenses','manual_excel_may_2026',CURRENT_TIMESTAMP),
('med_dept_2026_qc',2026,'QC',2500,'Accident Summary - May.xlsx','Medical Expenses','manual_excel_may_2026',CURRENT_TIMESTAMP),
('med_dept_2026_rt',2026,'R&T',0,'Accident Summary - May.xlsx','Medical Expenses','manual_excel_may_2026',CURRENT_TIMESTAMP),
('med_dept_2026_stores_rm',2026,'Stores - RM',2500,'Accident Summary - May.xlsx','Medical Expenses','manual_excel_may_2026',CURRENT_TIMESTAMP),
('med_dept_2026_stores_fg',2026,'Stores - FG',13060,'Accident Summary - May.xlsx','Medical Expenses','manual_excel_may_2026',CURRENT_TIMESTAMP),
('med_dept_2026_other_sicknesses',2026,'Other (Sicknesses)',0,'Accident Summary - May.xlsx','Medical Expenses','manual_excel_may_2026',CURRENT_TIMESTAMP)
ON CONFLICT ("year","departmentName") DO UPDATE SET
"amount"=EXCLUDED."amount",
"sourceFile"=EXCLUDED."sourceFile",
"sourceSheet"=EXCLUDED."sourceSheet",
"sourceHash"=EXCLUDED."sourceHash",
"updatedAt"=CURRENT_TIMESTAMP;

-- 6. Near miss / unsafe monthly summary
INSERT INTO "HseNearMissMonthlySummary"
("id","year","month","hseTeamCount","shopFloorCount","completedCount","pendingCount","totalReported","sourceFile","sourceSheet","sourceHash","updatedAt")
VALUES
('near_miss_2026_01',2026,1,27,0,22,5,27,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('near_miss_2026_02',2026,2,29,3,22,7,32,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('near_miss_2026_03',2026,3,28,5,20,8,33,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('near_miss_2026_04',2026,4,23,4,18,5,27,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP),
('near_miss_2026_05',2026,5,21,8,21,8,29,'Accident Summary - May.xlsx','Accidents','manual_excel_may_2026',CURRENT_TIMESTAMP)
ON CONFLICT ("year","month") DO UPDATE SET
"hseTeamCount"=EXCLUDED."hseTeamCount",
"shopFloorCount"=EXCLUDED."shopFloorCount",
"completedCount"=EXCLUDED."completedCount",
"pendingCount"=EXCLUDED."pendingCount",
"totalReported"=EXCLUDED."totalReported",
"sourceFile"=EXCLUDED."sourceFile",
"sourceSheet"=EXCLUDED."sourceSheet",
"sourceHash"=EXCLUDED."sourceHash",
"updatedAt"=CURRENT_TIMESTAMP;

-- 7. Validation results
INSERT INTO "ExcelDataValidationResult"
("id","sourceFile","workbookType","checkKey","checkLabel","excelValue","databaseValue","status","severity","message","detailsJson","createdAt")
VALUES
('val_hse_incident_count','Accident Summary - May.xlsx','HSE_ACCIDENT_SUMMARY','incident_count','Excel accident count vs database Incident count','13',(SELECT COUNT(*)::TEXT FROM "Incident"),CASE WHEN (SELECT COUNT(*) FROM "Incident")=13 THEN 'PASS' ELSE 'WARNING' END,'WARNING','Excel has 13 accident records. Database Incident table currently has a different count if this check is WARNING.',jsonb_build_object('expectedExcelCount',13),CURRENT_TIMESTAMP),

('val_hse_lost_hours','Accident Summary - May.xlsx','HSE_ACCIDENT_SUMMARY','lost_hours','Excel lost hours vs corrected lost hours','12.20','12.75','WARNING','WARNING','Excel summary uses 0.45 for 45 minutes. Correct decimal hour value is 0.75, so corrected total is 12.75.',jsonb_build_object('excelSummaryLostHours',12.20,'correctedLostHours',12.75),CURRENT_TIMESTAMP),

('val_hse_medical_monthly_total','Accident Summary - May.xlsx','HSE_ACCIDENT_SUMMARY','medical_monthly_total','Medical monthly total','255620',(SELECT COALESCE(SUM("amount"),0)::TEXT FROM "HseMedicalMonthlySummary" WHERE "year"=2026 AND "month" BETWEEN 1 AND 5),'PASS','INFO','Medical monthly total from Excel has been stored.',jsonb_build_object('janToMayTotal',255620),CURRENT_TIMESTAMP),

('val_hse_medical_department_total','Accident Summary - May.xlsx','HSE_ACCIDENT_SUMMARY','medical_department_total','Medical monthly total vs department allocation','255620',(SELECT COALESCE(SUM("amount"),0)::TEXT FROM "HseMedicalDepartmentSummary" WHERE "year"=2026),'WARNING','WARNING','Department-wise medical expense total does not equal monthly medical expense total in the Excel workbook.',jsonb_build_object('monthlyTotal',255620,'departmentTotal',142040,'difference',113580),CURRENT_TIMESTAMP),

('val_hse_working_hours_total','Accident Summary - May.xlsx','HSE_ACCIDENT_SUMMARY','working_hours_total','Jan-May working hours total','348080',(SELECT COALESCE(SUM("workingHours"),0)::TEXT FROM "HseWorkingLostHoursSummary" WHERE "year"=2026 AND "month" BETWEEN 1 AND 5),'PASS','INFO','Jan-May working hours from Excel have been stored.',jsonb_build_object('janToMayWorkingHours',348080),CURRENT_TIMESTAMP),

('val_hse_near_miss_total','Accident Summary - May.xlsx','HSE_ACCIDENT_SUMMARY','near_miss_total','Near miss / unsafe total','148',(SELECT COALESCE(SUM("totalReported"),0)::TEXT FROM "HseNearMissMonthlySummary" WHERE "year"=2026 AND "month" BETWEEN 1 AND 5),'PASS','INFO','Near miss / unsafe monthly totals from Excel have been stored.',jsonb_build_object('janToMayNearMissUnsafe',148),CURRENT_TIMESTAMP)
ON CONFLICT ("sourceFile","checkKey") DO UPDATE SET
"excelValue"=EXCLUDED."excelValue",
"databaseValue"=EXCLUDED."databaseValue",
"status"=EXCLUDED."status",
"severity"=EXCLUDED."severity",
"message"=EXCLUDED."message",
"detailsJson"=EXCLUDED."detailsJson",
"createdAt"=CURRENT_TIMESTAMP;

COMMIT;
