export interface ColumnDef {
  key: string;
  label: string;
  width?: number; // fixed width; undefined = flex
  minWidth?: number;
}

export interface TableRow {
  id: string;
  cells: Record<string, string>;
  meta?: Record<string, unknown>;
}

export interface NavFrame {
  level: unknown;
  selectedIndex: number;
  filterText?: string;
}

export type AppMode = 'navigate' | 'search' | 'command';

export type SelectResult =
  | { action: 'navigate' }
  | { action: 'edit'; filePath: string; metadata?: Record<string, unknown> }
  | { action: 'none' };

export type ServiceViewResult =
  | SelectResult
  | {
      action: 'edit';
      filePath: string;
      metadata: Record<string, unknown>;
      needsUpload: true;
    };
