export interface ColumnDef {
  key: string;
  label: string;
  width?: number; // fixed width; undefined = flex
  minWidth?: number;
}

export interface Cell {
  displayName: string;
  type?: "text" | "secret"; // defaults to 'text' if not specified
  color?: string; // optional per-cell foreground color (ignored when row is selected)
}

export interface TableRow {
  id: string;
  cells: Record<string, Cell | undefined>;
  meta?: Record<string, unknown>;
  tags?: Record<string, string>; // optional AWS resource tags for :tag filter support
  rowColor?: string; // optional row-level color applied to all cells (overridden by cell.color)
}

/** Helper to create a text cell */
export function textCell(displayName: string): Cell {
  return { displayName, type: "text" };
}

/** Helper to create a secret cell */
export function secretCell(displayName: string): Cell {
  return { displayName, type: "secret" };
}

/** Helper to create a colored text cell */
export function coloredCell(displayName: string, color: string): Cell {
  return { displayName, type: "text", color };
}

/** Helper to get cell displayName from Cell or string */
export function getCellLabel(cell: Cell | undefined): string | undefined {
  return cell?.displayName;
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
