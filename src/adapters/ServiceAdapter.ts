import type { ColumnDef, TableRow, SelectResult } from '../types.js';
import type { EditCapability } from './capabilities/EditCapability.js';
import type { DetailCapability } from './capabilities/DetailCapability.js';
import type { YankCapability } from './capabilities/YankCapability.js';
import type { ActionCapability } from './capabilities/ActionCapability.js';

// Re-export capability types for convenience
export type { EditCapability } from './capabilities/EditCapability.js';
export type { DetailCapability, DetailField } from './capabilities/DetailCapability.js';
export type { YankCapability, YankOption } from './capabilities/YankCapability.js';
export type { ActionCapability, AdapterKeyBinding, ActionContext, ActionEffect } from './capabilities/ActionCapability.js';

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

  // Capability registry — opt-in composition
  capabilities?: {
    edit?: EditCapability;
    detail?: DetailCapability;
    yank?: YankCapability;
    actions?: ActionCapability;
  };
}
