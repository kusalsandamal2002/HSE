export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function toNumber(value: unknown, fallback?: number): number | undefined {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toStringValue(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

export function monthRange(year?: number, month?: number) {
  if (!year) return undefined;
  const startMonth = month ? month - 1 : 0;
  const endMonth = month ? month : 12;
  return {
    gte: new Date(Date.UTC(year, startMonth, 1)),
    lt: new Date(Date.UTC(year, endMonth, 1)),
  };
}

export function generateCode(prefix: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${y}${m}${d}-${rand}`;
}
