import type { ColumnDef, TableRow, SelectResult } from '../types.js';

export interface DetailField {
  label: string;
  value: string;
}

export interface YankOption {
  key: string;
  label: string;
  feedback: string;
}

export interface ServiceAdapter {
  id: string;
  label: string;
  hudColor: { bg: string; fg: string };

  getColumns(): ColumnDef[];
  getRows(): Promise<TableRow[]>;
  onSelect(row: TableRow): Promise<SelectResult>;
  onEdit?(row: TableRow): Promise<SelectResult>;
  canGoBack(): boolean;
  goBack(): void;
  getPath(): string;
  getContextLabel?(): string; // e.g., "🪣 Buckets" or "📦 Objects"
  uploadFile?(filePath: string, metadata: Record<string, unknown>): Promise<void>; // Upload edited file
  getDetails?(row: TableRow): Promise<DetailField[]>; // Get detail fields for a row
  fetchTo?(row: TableRow, destinationPath: string, overwrite?: boolean): Promise<string>; // Download object to destination path
  jumpTo?(target: string): Promise<void>; // Jump to logical location (service-specific)
  getYankOptions?(row: TableRow): YankOption[]; // Adapter-specific copy options (beyond "n" for name)
  getClipboardValue?(row: TableRow, yankKey: string): Promise<string | null>; // Resolve value for a yank key
}
