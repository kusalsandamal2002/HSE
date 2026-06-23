# HSE

Professional desktop-ready HSE for company safety operations.

Project path:

```text
C:\HSE\HSE_FULL
```

The app name is currently **HSE**. The Windows installer has not been created yet.

## Stack

- Desktop wrapper: Electron
- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL on `localhost:5434`
- ORM: Prisma
- TV dashboard: backend-served browser page

## Development URLs

- Backend API: `http://localhost:5000`
- Frontend browser mode: `http://localhost:5173`
- Smart TV dashboard: `http://localhost:5000/tv`

## Login

```text
Email: admin@hse.local
Password: Admin@123
```

Change this before production use.

## Desktop Development App

From the project root:

```powershell
cd "C:\HSE\HSE_FULL"
npm.cmd run dev:all
```

This starts backend, frontend, and the Electron desktop window. Electron support is still present.

## Browser Development Mode

Terminal 1:

```powershell
cd "C:\HSE\HSE_FULL\backend"
npm.cmd install
npx.cmd prisma generate
npm.cmd run dev
```

Terminal 2:

```powershell
cd "C:\HSE\HSE_FULL\frontend"
npm.cmd install
npm.cmd run dev
```

Open:

```text
http://localhost:5173
```

## TV Dashboard

Open on the same PC:

```text
http://localhost:5000/tv
```

Open on a smart TV connected to the same network:

```text
http://YOUR-PC-IP:5000/tv
```

The in-app TV Dashboard page shows the URL, backend status, preview, and an external browser button.

## May Excel Manual Import

This is a developer/manual import script, not an app upload feature.

```powershell
cd "C:\HSE\HSE_FULL\backend"
npm.cmd install
npx.cmd prisma generate
npm.cmd run import:may-excel
```

The script is idempotent. It uses source-prefixed keys such as `EXCEL-MAY-2026-*` and reruns update existing imported rows instead of duplicating them.

Expected imported 2026 workbook totals:

- Accidents: `13`
- First Aid: `2`
- Medical: `11`
- Reportable: `0`
- Medical expenses: `255,620 LKR`
- Near miss / unsafe records: `148`
- Department counts: Production `7`, Mold `2`, QC `1`, Stores FG `2`, Stores RM `1`

## Demo Data Cleanup

To remove only the clearly identifiable old seed demo accident and exact seed working-hour rows:

```powershell
cd "C:\HSE\HSE_FULL\backend"
npm.cmd run cleanup:demo-data
```

The cleanup script soft-deletes only `INC-DEMO-001` when its description matches the original seed demo text. It deletes only the exact old seed working-hour rows with matching year/month/hour values and no remarks.

## Prisma Checks

```powershell
cd "C:\HSE\HSE_FULL\backend"
npx.cmd prisma validate
```

Targeted manual script type check:

```powershell
cd "C:\HSE\HSE_FULL\backend"
npx.cmd tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck prisma/import-may-excel-manual.ts prisma/cleanup-demo-data.ts
```

Frontend build check:

```powershell
cd "C:\HSE\HSE_FULL\frontend"
npm.cmd run build
```

## Verification Flow

1. Run cleanup and import:

```powershell
cd "C:\HSE\HSE_FULL\backend"
npm.cmd run cleanup:demo-data
npm.cmd run import:may-excel
```

2. Start the desktop app:

```powershell
cd "C:\HSE\HSE_FULL"
npm.cmd run dev:all
```

3. Login with `admin@hse.local / Admin@123`.

4. On Dashboard, select:

```text
Year: 2026
Month: Full Year
Department: All Departments
```

5. Check dashboard cards and charts:

- Total Accidents
- First Aid
- Medical
- Reportable
- Lost Time Incidents
- Lost Hours
- Medical Expenses
- AFR
- Near Miss / Unsafe
- Pending Actions
- Overdue Actions
- Working Hours
- Department Summary
- Root Cause Analysis
- Medical Expense Trend
- Corrective Action Status

6. Check modules:

- Accident Register search, filters, view/edit/delete
- Corrective Actions status and overdue badges
- Medical Expenses totals and linked incident/department display
- Near Miss / Unsafe summary and records
- Working Hours company totals and remarks
- Reports filters and CSV exports
- TV Dashboard control and `http://localhost:5000/tv`

## Installer Status

Installer packaging is intentionally not created yet. Keep testing in desktop development mode and browser mode first.