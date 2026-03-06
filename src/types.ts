export interface ColumnDef {
  key: string;
  label: string;
  width?: number; // fixed width; undefined = flex
  minWidth?: number;
}

export interface Cell {
  displayName: string;
  type?: "text" | "secret"; // defaults to 'text' if not specified
}

export interface TableRow {
  id: string;
  cells: Record<string, Cell>; // Cell for typed cells, string for backward compatibility
  meta?: Record<string, unknown>;
}

/** Helper to create a text cell */
export function textCell(displayName: string): Cell {
  return { displayName, type: "text" };
}

/** Helper to create a secret cell */
export function secretCell(displayName: string): Cell {
  return { displayName, type: "secret" };
}

/** Helper to get cell displayName from Cell or string */
export function getCellValue(cell: Cell | string): string {
  return typeof cell === "string" ? cell : cell.displayName;
}

export interface NavFrame {
  level: unknown;
  selectedIndex: number;
  filterText?: string;
}

export type AppMode = "navigate" | "search" | "command";

export type SelectResult =
  | { action: "navigate" }
  | { action: "edit"; filePath: string; metadata?: Record<string, unknown> }
  | { action: "none" };

export type ServiceViewResult =
  | SelectResult
  | {
      action: "edit";
      filePath: string;
      metadata: Record<string, unknown>;
      needsUpload: true;
    };
