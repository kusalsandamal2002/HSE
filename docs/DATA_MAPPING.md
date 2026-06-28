# Data Mapping Reference

This document records the core mapping between imported Excel totals and the application database tables used by the Data Quality Center.

| Excel Sheet | Excel Column | Database Table | Database Column | Required | Transformation / Rule |
| --- | --- | --- | --- | --- | --- |
| Accident Summary | Accident Date | Incident | incidentDate | Yes | Convert to UTC date |
| Accident Summary | Department | Incident | departmentId | Yes | Match department master by name/code |
| Accident Summary | Incident Type | Incident | incidentTypeId | Yes | Match incident type master by name |
| Accident Summary | Medical Cost | Incident | medicalExpenseTotal | Optional | Numeric only, non-negative |
| Accident Summary | Lost Minutes | Incident | lostMinutes | Optional | Numeric only, non-negative |
| Near Miss / Unsafe | Observation Date | Observation | observationDate | Yes | Convert to UTC date |
| Near Miss / Unsafe | Observation Type | Observation | type | Yes | Map to enum values |
| Near Miss / Unsafe | Department | Observation | departmentId | Optional | Match department master |
| Working Hours | Year | WorkingHours | year | Yes | Must be a valid year |
| Working Hours | Month | WorkingHours | month | Yes | Must be 1-12 |
| Working Hours | Department | WorkingHours | departmentId | Yes | Match department master |
