const NUMBER_LOCALE = "en-US";

export function formatNumber(value: unknown, maximumFractionDigits = 0, minimumFractionDigits = 0) {
  const numeric = Number(value || 0);
  return numeric.toLocaleString(NUMBER_LOCALE, { minimumFractionDigits, maximumFractionDigits });
}

export function formatFixed(value: unknown, digits = 2) {
  return formatNumber(value, digits, digits);
}

export function formatCurrency(value: unknown) {
  const numeric = Number(value || 0);
  const hasCents = !Number.isInteger(numeric);
  return `LKR ${formatNumber(numeric, hasCents ? 2 : 0, hasCents ? 2 : 0)}`;
}

export function formatHours(value: unknown) {
  const numeric = Number(value || 0);
  return `${formatNumber(numeric, Number.isInteger(numeric) ? 0 : 2)} h`;
}

export function lostMinutesToHours(minutes: unknown) {
  return formatHours(Number(minutes || 0) / 60);
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 10);
}

export function formatMonthName(month: number) {
  return new Date(Date.UTC(2026, month - 1, 1)).toLocaleString("en", { month: "short", timeZone: "UTC" });
}

export function isOverdue(dueDate?: string | null, status?: string) {
  if (!dueDate || ["COMPLETED", "CLOSED"].includes(status || "")) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));

  const escape = (value: unknown) => {
    const text = value === undefined || value === null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}