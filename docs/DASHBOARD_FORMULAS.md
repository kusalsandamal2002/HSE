# Dashboard Formula Reference

The Data Quality Center compares imported or expected totals against database-backed KPI values.

- Total Accidents: Count of incidents where `isDeleted = false`
- First Aid Count: Count of incidents linked to incident type `First Aid`
- Medical Treatment Count: Count of incidents linked to incident type `Medical Treatment`
- Reportable Count: Count of incidents linked to incident type `Reportable`
- Total Medical Expenses: Sum of `Incident.medicalExpenseTotal`
- Near Miss / Unsafe: Count of observations with type `NEAR_MISS`, `UNSAFE_ACT`, or `UNSAFE_CONDITION`
- Working Hours Total: Sum of `WorkingHours.regularHours + WorkingHours.overtimeHours`
