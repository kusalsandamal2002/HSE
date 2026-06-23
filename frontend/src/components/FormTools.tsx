import type { ReactNode } from "react";
import type { Lookup } from "../types";

export function Field({ label, children, required = false, hint }: { label: string; children: ReactNode; required?: boolean; hint?: string }) {
  return (
    <label className="field">
      <span>{label}{required && <b aria-label="required"> *</b>}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function SelectLookup({ value, onChange, items, placeholder = "Select" }: { value?: string; onChange: (v: string) => void; items: Lookup[]; placeholder?: string }) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {items.map((item) => <option key={item.id} value={item.id}>{item.name || item.code || item.empNo}</option>)}
    </select>
  );
}

export function StatusBadge({ value, tone }: { value?: string; tone?: string }) {
  const label = String(value || "-").replace(/_/g, " ");
  return <span className={`badge ${tone || String(value || "").toLowerCase()}`}>{label}</span>;
}

export function EmptyState({ text = "No records found", detail }: { text?: string; detail?: string }) {
  return <div className="empty-state"><strong>{text}</strong>{detail && <span>{detail}</span>}</div>;
}

export function LoadingState({ text = "Loading data..." }: { text?: string }) {
  return <div className="panel loading-state">{text}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="panel error-state"><strong>Unable to load data</strong><span>{message}</span></div>;
}