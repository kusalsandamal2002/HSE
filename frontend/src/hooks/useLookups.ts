import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Lookups } from "../types";

const empty: Lookups = { departments: [], shifts: [], employees: [], machines: [], incidentTypes: [], injuryTypes: [], rootCauses: [] };

export function useLookups() {
  const [lookups, setLookups] = useState<Lookups>(empty);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<Lookups>("/api/master/lookups").then(setLookups).finally(() => setLoading(false));
  }, []);
  return { lookups, loading };
}
