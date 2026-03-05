import type { ColumnDef, TableRow, SelectResult } from '../types.js';

export interface DetailField {
  label: string;
  value: string;
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
  uploadFile?(filePath: string, metadata: Record<string, unknown>): Promise<void>; // Upload edited file
  getDetails?(row: TableRow): Promise<DetailField[]>; // Get detail fields for a row
}
