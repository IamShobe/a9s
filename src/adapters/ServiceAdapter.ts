import type { ColumnDef, TableRow, SelectResult } from "../types.js";
import type { EditCapability } from "./capabilities/EditCapability.js";
import type { DetailCapability } from "./capabilities/DetailCapability.js";
import type { YankCapability } from "./capabilities/YankCapability.js";
import type { ActionCapability } from "./capabilities/ActionCapability.js";
import type { PreviewCapability } from "./capabilities/PreviewCapability.js";

// Re-export capability types for convenience
export type { EditCapability } from "./capabilities/EditCapability.js";
export type { DetailCapability, DetailField } from "./capabilities/DetailCapability.js";
export type { YankCapability, YankOption } from "./capabilities/YankCapability.js";
export type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "./capabilities/ActionCapability.js";
export type { PreviewCapability, PreviewPageResult } from "./capabilities/PreviewCapability.js";

/** A related resource that can be jumped to from another service's row. */
export interface RelatedResource {
  serviceId: string; // matches a key in SERVICE_REGISTRY
  label: string; // human-readable description, e.g. "CloudWatch logs"
  filterHint?: string; // pre-populate filter when switching to that service
}

export interface ServiceAdapter {
  id: string;
  label: string;
  hudColor: { bg: string; fg: string };

  getColumns(): ColumnDef[];
  getRows(): Promise<TableRow[]>;
  onSelect(row: TableRow): Promise<SelectResult>;
  canGoBack(): boolean;
  goBack(): void;
  getPath(): string;
  getContextLabel?(): string; // e.g., "🪣 Buckets" or "📦 Objects"
  reset?(): void;

  /** Return related resources for a selected row (e.g. Lambda → CloudWatch log group). */
  getRelatedResources?(row: TableRow): RelatedResource[];

  /** Return an AWS console URL for the selected row, or null if not supported. */
  getBrowserUrl?(row: TableRow): string | null;

  // Capability registry — opt-in composition
  capabilities?: {
    edit?: EditCapability;
    detail?: DetailCapability;
    yank?: YankCapability;
    actions?: ActionCapability;
    preview?: PreviewCapability;
  };
}
