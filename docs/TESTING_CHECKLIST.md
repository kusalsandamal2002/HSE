# Testing Checklist

## Backend

- [ ] `GET /api/health` returns status ok.
- [ ] Login works with seeded admin user.
- [ ] Master data loads after login.
- [ ] Accident register create/edit/delete works.
- [ ] Dashboard reads PostgreSQL data.
- [ ] TV public endpoint works without login.
- [ ] Monthly and yearly reports generate.

## Frontend

- [ ] Login page opens.
- [ ] Dashboard displays KPI cards and charts.
- [ ] Accident form saves records.
- [ ] Accident table shows records after refresh.
- [ ] Master data can add/deactivate records.
- [ ] Corrective actions can be added.
- [ ] Medical expenses can be added.
- [ ] Near Miss / Unsafe Conditions can be added.
- [ ] Working hours can be added.
- [ ] Reports page generates report preview.
- [ ] TV dashboard control saves settings.

## Smart TV

- [ ] `http://localhost:5000/tv` opens.
- [ ] KPI slides rotate.
- [ ] TV dashboard updates after accident data changes.
- [ ] Smart TV can open `http://YOUR-PC-IP:5000/tv` on same network.

## Before Installer

- [ ] No critical bugs in development mode.
- [ ] Database backup plan approved.
- [ ] Company logo/name finalized.
- [ ] User roles finalized.
- [ ] PDF/Excel export finalized.
