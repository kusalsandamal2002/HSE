# HSEject Scope

## Purpose

Replace the current Excel-based accident summary workbook with a professional PostgreSQL-based HSE Management System that can later be packaged as a Windows PC application.

## Excel Workflow Converted Into Software

The uploaded Accident Summary workbook is converted into these software workflows:

- Accident data sheet → Accident / Incident Register
- Accident summary dashboard → Live Dashboard
- Department accident table → Department Summary Chart + Report
- Root causes sheet → Root Cause Analysis Module
- Medical expenses sheet → Medical Expense Register
- Lost time and monthly hours → Working Hours + AFR KPI
- Corrective action status → Corrective Action Tracker
- Smart TV prototype → Smart TV Dashboard Module

## Development Mode First

The app must be fully tested from VS Code before installing on the office PC.

Development URLs:

- Backend: http://localhost:5000
- Frontend: http://localhost:5173
- TV: http://localhost:5000/tv

## Installer Later

After the user confirms the project is correct, create:

- Electron wrapper
- Windows installer
- Office PC setup guide
- PostgreSQL service setup / backup strategy
