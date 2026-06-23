export type Lookup = { id: string; name: string; code?: string; empNo?: string; departmentId?: string };
export type Lookups = {
  departments: Lookup[];
  shifts: Lookup[];
  employees: Lookup[];
  machines: Lookup[];
  incidentTypes: Lookup[];
  injuryTypes: Lookup[];
  rootCauses: Lookup[];
};

export type User = { id: string; name: string; email: string; role: string };

export type Incident = {
  id: string;
  incidentNo: string;
  incidentDate: string;
  incidentTime?: string;
  description: string;
  immediateAction?: string;
  correctiveAction?: string;
  lostMinutes: number;
  medicalExpenseTotal: string | number;
  severity: string;
  status: string;
  department?: Lookup;
  employee?: Lookup;
  shift?: Lookup;
  machine?: Lookup;
  incidentType?: Lookup;
  injuryType?: Lookup;
  rootCause?: Lookup;
};
