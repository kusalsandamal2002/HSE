export type ImportWorkbookType = "HSE_ACCIDENT_SUMMARY" | "ESG_METRICS" | "UNKNOWN";

export type ImportBatchStatus =
  | "UPLOADED"
  | "SCANNED"
  | "VALIDATION_FAILED"
  | "READY_FOR_APPROVAL"
  | "APPROVED"
  | "IMPORTED"
  | "CANCELLED"
  | "FAILED";

export type ImportIssueSeverity = "INFO" | "WARNING" | "ERROR";
export type ImportPreviewRowStatus = "VALID" | "WARNING" | "REJECTED";

export type ImportIssue = {
  sectionKey: string | null;
  severity: ImportIssueSeverity;
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
};

export type ImportPreviewRow = {
  sectionKey: string;
  rowIndex: number;
  rawJson: Record<string, unknown>;
  mappedJson: Record<string, unknown>;
  status: ImportPreviewRowStatus;
  validation: ImportIssue[];
};

export type ImportSection = {
  sectionKey: string;
  sectionLabel: string;
  sheetName: string | null;
  confidence: number;
  rowCount: number;
  summary: string;
  metadata?: Record<string, unknown> | null;
  rows: ImportPreviewRow[];
};

export type WorkbookInspection = {
  workbookType: ImportWorkbookType;
  confidence: number;
  sheetNames: string[];
  sections: ImportSection[];
  issues: ImportIssue[];
  summary: Record<string, unknown>;
  rowCount: number;
  validRowCount: number;
  warningCount: number;
  errorCount: number;
};

export type ImportBatchHistoryItem = {
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

export type ImportBatchPreviewResponse = {
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
};
