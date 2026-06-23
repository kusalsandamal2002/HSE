export const recordStatuses = ["PENDING", "IN_PROGRESS", "COMPLETED", "CLOSED", "OVERDUE"];
export const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const observationTypes = ["NEAR_MISS", "UNSAFE_CONDITION", "UNSAFE_ACT", "POSITIVE_OBSERVATION"];
export const riskLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const months = [
  [1, "Jan"], [2, "Feb"], [3, "Mar"], [4, "Apr"], [5, "May"], [6, "Jun"],
  [7, "Jul"], [8, "Aug"], [9, "Sep"], [10, "Oct"], [11, "Nov"], [12, "Dec"],
] as const;
