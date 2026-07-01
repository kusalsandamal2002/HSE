import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../lib/api";
import { companyLogoSrc, companyProfile } from "../lib/brand";
import type { User } from "../types";

type ImportWorkbookType = "HSE_ACCIDENT_SUMMARY" | "ESG_METRICS" | "UNKNOWN";
type ImportBatchStatus = "UPLOADED" | "SCANNED" | "VALIDATION_FAILED" | "READY_FOR_APPROVAL" | "APPROVED" | "IMPORTED" | "CANCELLED" | "FAILED";
type ImportIssueSeverity = "INFO" | "WARNING" | "ERROR";
type ImportPreviewRowStatus = "VALID" | "WARNING" | "REJECTED";

type ImportIssue = {
  sectionKey: string | null;
  severity: ImportIssueSeverity;
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
};

type ImportPreviewRow = {
  sectionKey: string;
  rowIndex: number;
  rawJson: Record<string, unknown>;
  mappedJson: Record<string, unknown>;
  status: ImportPreviewRowStatus;
  validation: ImportIssue[];
};

type ImportSection = {
  sectionKey: string;
  sectionLabel: string;
  sheetName: string | null;
  confidence: number;
  rowCount: number;
  summary: string;
  metadata?: Record<string, unknown> | null;
  rows: ImportPreviewRow[];
};

type ImportBatchHistoryItem = {
  id: string;
  fileName: string;
  originalName: string;
  workbookType: ImportWorkbookType;
  status: ImportBatchStatus;
  uploadedBy: string | null;
  uploadedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  importedAt: string | null;
  rowCount: number;
  validRowCount: number;
  warningCount: number;
  errorCount: number;
  fileHash: string;
  summaryJson: unknown;
};

type ImportBatchPreviewResponse = {
  batch: ImportBatchHistoryItem;
  sheetNames: string[];
  workbookType: ImportWorkbookType;
  confidence: number;
  sections: ImportSection[];
  issues: ImportIssue[];
  summary: Record<string, unknown>;
  counts: {
    rowCount: number;
    validRowCount: number;
    warningCount: number;
    errorCount: number;
  };
  canApprove: boolean;
  importResult?: { scriptName: string; stdout: string; stderr: string };
};

type ImportHistoryResponse = ImportBatchHistoryItem[];

type DataUploadCenterPageProps = {
  scope?: "all" | "esg";
  onNavigate: (path: string) => void;
  onLogout: () => void;
  user?: User | null;
};

const workbookLabels: Record<ImportWorkbookType, string> = {
  HSE_ACCIDENT_SUMMARY: "HSE Accident Summary",
  ESG_METRICS: "ESG Metrics",
  UNKNOWN: "Unknown",
};

const statusLabels: Record<ImportBatchStatus, string> = {
  UPLOADED: "Uploaded",
  SCANNED: "Scanned",
  VALIDATION_FAILED: "Validation failed",
  READY_FOR_APPROVAL: "Ready for approval",
  APPROVED: "Approved",
  IMPORTED: "Imported",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((item) => formatCellValue(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function statusTone(status: ImportBatchStatus) {
  if (status === "IMPORTED") return "success";
  if (status === "READY_FOR_APPROVAL" || status === "APPROVED" || status === "SCANNED") return "info";
  if (status === "VALIDATION_FAILED" || status === "FAILED") return "danger";
  if (status === "CANCELLED") return "muted";
  return "warning";
}

function issueTone(severity: ImportIssueSeverity) {
  if (severity === "ERROR") return "danger";
  if (severity === "WARNING") return "warning";
  return "info";
}

function Icon({ kind }: { kind: "upload" | "scan" | "check" | "history" | "alert" | "clock" | "file" | "database" | "refresh" | "cancel" | "logout" | "dashboard" }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "upload":
      return <svg {...common}><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 14v4h14v-4" /></svg>;
    case "scan":
      return <svg {...common}><path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3" /><path d="M8 12h8" /></svg>;
    case "check":
      return <svg {...common}><path d="m5 13 4 4L19 7" /></svg>;
    case "history":
      return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></svg>;
    case "alert":
      return <svg {...common}><path d="M12 9v4" /><path d="M12 16h.01" /><path d="M10.3 4.8 2.9 18a1.5 1.5 0 0 0 1.3 2.2h15.6a1.5 1.5 0 0 0 1.3-2.2L13.7 4.8a2 2 0 0 0-3.4 0Z" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></svg>;
    case "file":
      return <svg {...common}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></svg>;
    case "database":
      return <svg {...common}><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5" /><path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" /></svg>;
    case "refresh":
      return <svg {...common}><path d="M20 12a8 8 0 0 0-14.5-4.5" /><path d="M5 4v4h4" /><path d="M4 12a8 8 0 0 0 14.5 4.5" /><path d="M19 20v-4h-4" /></svg>;
    case "cancel":
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case "logout":
      return <svg {...common}><path d="M10 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" /><path d="M15 7v10" /><path d="m20 12-5-5v3H10v4h5v3z" /></svg>;
    case "dashboard":
      return <svg {...common}><path d="M4 4h7v7H4zM13 4h7v4h-7zM13 12h7v8h-7zM4 13h7v7H4z" /></svg>;
    default:
      return null;
  }
}

function Badge({ tone, children }: { tone: "success" | "warning" | "danger" | "info" | "muted"; children: ReactNode }) {
  return <span className={`data-upload-badge data-upload-badge-${tone}`}>{children}</span>;
}

function hasUploadRole(user: User | null | undefined, allowed: readonly string[]) {
  return Boolean(user?.role && allowed.includes(user.role));
}
export function DataUploadCenterPage({ scope = "all", onNavigate, onLogout, user }: DataUploadCenterPageProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentBatch, setCurrentBatch] = useState<ImportBatchPreviewResponse | null>(null);
  const [history, setHistory] = useState<ImportHistoryResponse>([]);
  const [activeSectionKey, setActiveSectionKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "success" | "warning" | "danger">("info");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const historyFilter = scope === "esg" ? "?workbookType=ESG_METRICS" : "";

  const activeSection = useMemo(() => {
    if (!currentBatch?.sections.length) return null;
    return currentBatch.sections.find((section) => section.sectionKey === activeSectionKey) ?? currentBatch.sections[0];
  }, [activeSectionKey, currentBatch]);

  const previewColumns = useMemo(() => {
    if (!activeSection?.rows.length) return [] as string[];
    const keys = new Set<string>();
    for (const row of activeSection.rows) {
      for (const key of Object.keys(row.mappedJson)) {
        keys.add(key);
      }
    }
    return Array.from(keys);
  }, [activeSection]);

  async function loadHistory() {
    setLoading(true);
    try {
      const data = await api<ImportHistoryResponse>(`/api/imports/history${historyFilter}`);
      setHistory(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load import history");
      setMessageTone("danger");
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview(batchId: string) {
    setLoading(true);
    try {
      const data = await api<ImportBatchPreviewResponse>(`/api/imports/${batchId}/preview`);
      setCurrentBatch(data);
      setActiveSectionKey(data.sections[0]?.sectionKey ?? "");
      setMessage(`Loaded ${data.batch.originalName}`);
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load batch preview");
      setMessageTone("danger");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(file: File) {
    if (!canUpload) {
      setMessage("Upload permission denied for your current role.");
      setMessageTone("danger");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setMessage("Only .xlsx files are supported.");
      setMessageTone("danger");
      return;
    }

    setSelectedFile(file);
    setUploading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await api<ImportBatchPreviewResponse>("/api/imports/upload", { method: "POST", body: formData });
      setCurrentBatch(data);
      setActiveSectionKey(data.sections[0]?.sectionKey ?? "");
      setMessage(`Workbook scanned: ${workbookLabels[data.workbookType]} (${data.batch.originalName})`);
      setMessageTone(data.canApprove ? "success" : "warning");
      await loadHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
      setMessageTone("danger");
    } finally {
      setUploading(false);
    }
  }

  async function handleApprove() {
    if (!canApprove) {
      setMessage("Approval permission denied for your current role.");
      setMessageTone("danger");
      return;
    }

    if (!currentBatch?.canApprove) return;
    setApproving(true);
    setMessage("");
    try {
      const data = await api<ImportBatchPreviewResponse & { importResult?: { scriptName: string } }>(`/api/imports/${currentBatch.batch.id}/approve`, { method: "POST" });
      setCurrentBatch(data);
      setActiveSectionKey(data.sections[0]?.sectionKey ?? "");
      setMessage(`Imported via ${data.importResult?.scriptName ?? "approval script"}.`);
      setMessageTone("success");
      await loadHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approval failed");
      setMessageTone("danger");
    } finally {
      setApproving(false);
    }
  }

  async function handleCancel() {
    if (!currentBatch) {
      setSelectedFile(null);
      setCurrentBatch(null);
      setActiveSectionKey("");
      setMessage("Cleared current upload.");
      setMessageTone("info");
      return;
    }

    if (!canCancel) {
      setMessage("Cleared current preview. Cancelling staged imports is restricted to administrators.");
      setMessageTone("info");
      setCurrentBatch(null);
      setActiveSectionKey("");
      setSelectedFile(null);
      return;
    }

    setCanceling(true);
    try {
      await api(`/api/imports/${currentBatch.batch.id}`, { method: "DELETE" });
      setMessage(`Cancelled ${currentBatch.batch.originalName}.`);
      setMessageTone("info");
      setCurrentBatch(null);
      setActiveSectionKey("");
      setSelectedFile(null);
      await loadHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to cancel batch");
      setMessageTone("danger");
    } finally {
      setCanceling(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, [historyFilter]);

  useEffect(() => {
    if (currentBatch && !activeSectionKey) {
      setActiveSectionKey(currentBatch.sections[0]?.sectionKey ?? "");
    }
  }, [activeSectionKey, currentBatch]);

  const counts = currentBatch?.counts ?? { rowCount: 0, validRowCount: 0, warningCount: 0, errorCount: 0 };
  const previewSource = currentBatch?.batch ?? null;
  const historyTitle = scope === "esg" ? "ESG History" : "Import History";
  const canUpload = hasUploadRole(user, ["ADMIN", "HSE_MANAGER", "HSE_OFFICER"]);
  const canApprove = hasUploadRole(user, ["ADMIN", "HSE_MANAGER"]);
  const canCancel = hasUploadRole(user, ["ADMIN"]);

  return (
    <section className="data-upload-page">
        <header className="data-upload-hero data-upload-card">
          <div className="data-upload-brand">
            <span className="data-upload-logo">
              <img src={companyLogoSrc} alt="LAUGFS Rubber" />
            </span>
            <div>
              <p>Data Upload Center</p>
              <h1>Upload, validate, approve, and import HSE / ESG Excel data.</h1>
              <small>{scope === "esg" ? "ESG-focused workflow running inside the unified HSE app shell." : "Unified HSE + ESG workbook intake for approved imports only."}</small>
            </div>
          </div>

          <div className="data-upload-actions">
            <Badge tone="info">{scope === "esg" ? "ESG focus" : "Unified workspace"}</Badge>
            <div className="data-upload-action-row">
              <button type="button" className="data-upload-icon-button" onClick={() => onNavigate("/master-dashboard")} title="Open HSE Dashboard">
                <Icon kind="dashboard" />
              </button>
              <button type="button" className="data-upload-icon-button" onClick={() => onNavigate("/esg-dashboard")} title="Open ESG Dashboard">
                <Icon kind="dashboard" />
              </button>
              <button type="button" className="data-upload-icon-button" onClick={onLogout} title="Logout">
                <Icon kind="logout" />
              </button>
            </div>
            <div className="data-upload-meta">
              <strong>{user?.name ?? "User"}</strong>
              <span>{companyProfile.factory}</span>
            </div>
          </div>
        </header>

        {message && (
          <div className={`data-upload-alert data-upload-alert-${messageTone}`}>
            <Icon kind={messageTone === "danger" ? "alert" : messageTone === "warning" ? "scan" : "check"} />
            <span>{message}</span>
          </div>
        )}

        <div className="data-upload-grid">
          <section className="data-upload-card data-upload-dropzone">
            <div className="data-upload-section-title">
              <h2>Upload Workbook</h2>
              <span>.xlsx only, no macros, values read only</span>
            </div>
            <div
              className={`data-upload-drop-area ${dragActive ? "is-active" : ""}`}
              onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                const file = event.dataTransfer.files[0];
                if (file) void handleUpload(file);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="data-upload-file-input"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleUpload(file);
                }}
              />
              <Icon kind="upload" />
              <strong>Drop an Excel workbook here</strong>
              <span>Select or drag a `.xlsx` file. The upload is scanned before any database write happens.</span>
              <div className="data-upload-drop-actions">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!canUpload || uploading}>
                  {canUpload ? (uploading ? "Scanning..." : "Browse workbook") : "Upload restricted"}
                </button>
                <button type="button" className="secondary" onClick={handleCancel} disabled={canceling}>
                  {currentBatch ? (canCancel ? "Cancel upload" : "Clear view") : "Clear selection"}
                </button>
              </div>
              {selectedFile && (
                <div className="data-upload-file-chip">
                  <Icon kind="file" />
                  <div>
                    <strong>{selectedFile.name}</strong>
                    <span>{formatBytes(selectedFile.size)}</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="data-upload-card">
            <div className="data-upload-section-title">
              <h2>Workbook Detection</h2>
              <span>Detection status, confidence, and recognized sheets</span>
            </div>
            {currentBatch ? (
              <div className="data-upload-detection">
                <div className="data-upload-detection-grid">
                  <div>
                    <span>Detected type</span>
                    <strong>{workbookLabels[currentBatch.workbookType]}</strong>
                  </div>
                  <div>
                    <span>Confidence</span>
                    <strong>{Math.round((currentBatch.confidence || 0) * 100)}%</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <Badge tone={statusTone(currentBatch.batch.status)}>{statusLabels[currentBatch.batch.status]}</Badge>
                  </div>
                  <div>
                    <span>Sheet count</span>
                    <strong>{currentBatch.sheetNames.length}</strong>
                  </div>
                </div>

                <div className="data-upload-tags">
                  {currentBatch.sheetNames.map((sheet) => (
                    <span key={sheet}>{sheet}</span>
                  ))}
                </div>

                <div className="data-upload-tags data-upload-tags-muted">
                  {currentBatch.sections.map((section) => (
                    <span key={section.sectionKey}>{section.sectionLabel}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="data-upload-empty">
                <Icon kind="scan" />
                <strong>No workbook scanned yet</strong>
                <span>Upload a file to see workbook detection and validation results.</span>
              </div>
            )}
          </section>
        </div>

        <div className="data-upload-grid data-upload-grid-wide">
          <section className="data-upload-card data-upload-preview">
            <div className="data-upload-section-title">
              <h2>Extracted Preview</h2>
              <span>Tab through the recognized sections and inspect mapped rows</span>
            </div>

            {currentBatch?.sections.length ? (
              <>
                <div className="data-upload-tabs">
                  {currentBatch.sections.map((section) => (
                    <button
                      key={section.sectionKey}
                      type="button"
                      className={section.sectionKey === activeSection?.sectionKey ? "is-active" : ""}
                      onClick={() => setActiveSectionKey(section.sectionKey)}
                    >
                      <strong>{section.sectionLabel}</strong>
                      <span>{section.rowCount} rows</span>
                    </button>
                  ))}
                </div>

                {activeSection && (
                  <div className="data-upload-preview-panel">
                    <div className="data-upload-preview-meta">
                      <div>
                        <strong>{activeSection.sectionLabel}</strong>
                        <span>{activeSection.summary}</span>
                      </div>
                      <div>
                        <Badge tone={activeSection.confidence >= 0.9 ? "success" : activeSection.confidence >= 0.75 ? "info" : "warning"}>
                          {Math.round(activeSection.confidence * 100)}% confidence
                        </Badge>
                        {activeSection.sheetName && <span>{activeSection.sheetName}</span>}
                      </div>
                    </div>

                    <div className="data-upload-table-wrap">
                      <table className="data-upload-table">
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Status</th>
                            {previewColumns.map((column) => <th key={column}>{column}</th>)}
                            <th>Validation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeSection.rows.map((row) => (
                            <tr key={`${row.sectionKey}-${row.rowIndex}`}>
                              <td>{row.rowIndex}</td>
                              <td><Badge tone={issueTone(row.status === "REJECTED" ? "ERROR" : row.status === "WARNING" ? "WARNING" : "INFO")}>{row.status}</Badge></td>
                              {previewColumns.map((column) => (
                                <td key={column}>{formatCellValue(row.mappedJson[column])}</td>
                              ))}
                              <td>
                                {row.validation.length ? row.validation.map((item) => item.message).join(" ") : "No issues"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="data-upload-empty">
                <Icon kind="file" />
                <strong>Nothing to preview yet</strong>
                <span>The extracted rows will appear here after the workbook is scanned.</span>
              </div>
            )}
          </section>

          <section className="data-upload-card">
            <div className="data-upload-section-title">
              <h2>Validation Summary</h2>
              <span>Detected rows, warnings, and approval readiness</span>
            </div>
            <div className="data-upload-stat-grid">
              <div><span>Detected</span><strong>{counts.rowCount}</strong></div>
              <div><span>Valid</span><strong>{counts.validRowCount}</strong></div>
              <div><span>Warnings</span><strong>{counts.warningCount}</strong></div>
              <div><span>Rejected</span><strong>{counts.errorCount}</strong></div>
            </div>

            <div className="data-upload-issues">
              {currentBatch?.issues.length ? currentBatch.issues.map((item, index) => (
                <div key={`${item.code}-${index}`} className={`data-upload-issue data-upload-issue-${item.severity.toLowerCase()}`}>
                  <Badge tone={issueTone(item.severity)}>{item.code}</Badge>
                  <strong>{item.message}</strong>
                </div>
              )) : (
                <div className="data-upload-empty-inline">
                  <Icon kind="check" />
                  <span>No validation issues have been recorded.</span>
                </div>
              )}
            </div>

            <div className="data-upload-actions-block">
              <button type="button" className="secondary" onClick={handleCancel} disabled={canceling}>
                <Icon kind="cancel" />
                <span>{currentBatch ? (canCancel ? "Cancel" : "Clear view") : "Reset"}</span>
              </button>
              <button type="button" className="secondary" onClick={() => selectedFile && void handleUpload(selectedFile)} disabled={!selectedFile || uploading}>
                <Icon kind="refresh" />
                <span>Re-scan</span>
              </button>
              <button type="button" onClick={() => void handleApprove()} disabled={!canApprove || !currentBatch?.canApprove || approving}>
                <Icon kind="check" />
                <span>{canApprove ? (approving ? "Approving..." : "Approve & Import") : "Approval restricted"}</span>
              </button>
            </div>

            <div className="data-upload-footer-note">
              <Icon kind="alert" />
              <span>Approval is required before database writes. Unsupported workbooks remain staged and are not written to final tables.</span>
            </div>

            {currentBatch?.batch.importedAt && (
              <div className="data-upload-result-card">
                <strong>Latest import result</strong>
                <span>{currentBatch.importResult?.scriptName ?? "Workbook import completed"}</span>
                <small>{formatDateTime(currentBatch.batch.importedAt)}</small>
              </div>
            )}
          </section>
        </div>

        <section className="data-upload-card data-upload-history">
          <div className="data-upload-section-title">
            <h2>{historyTitle}</h2>
            <span>Recent uploads, approvals, and outcomes</span>
          </div>

          {loading && !history.length ? (
            <div className="data-upload-empty">
              <Icon kind="history" />
              <strong>Loading history</strong>
              <span>Fetching recent import batches...</span>
            </div>
          ) : history.length ? (
            <table className="data-upload-table data-upload-history-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Uploaded by</th>
                  <th>Uploaded</th>
                  <th>Rows</th>
                  <th>Warnings</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} onClick={() => void loadPreview(item.id)} className={currentBatch?.batch.id === item.id ? "is-selected" : ""}>
                    <td>
                      <strong>{item.originalName}</strong>
                      <span>{item.fileName}</span>
                    </td>
                    <td>{workbookLabels[item.workbookType]}</td>
                    <td><Badge tone={statusTone(item.status)}>{statusLabels[item.status]}</Badge></td>
                    <td>{item.uploadedBy ?? "-"}</td>
                    <td>{formatDateTime(item.uploadedAt)}</td>
                    <td>{item.rowCount}</td>
                    <td>{item.warningCount}</td>
                    <td>{item.errorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="data-upload-empty">
              <Icon kind="history" />
              <strong>No history yet</strong>
              <span>Uploaded batches will appear here after the first import.</span>
            </div>
          )}
        </section>
      </section>
  );
}



