import type { TableRow } from "../../types.js";

export interface YankOption {
  key: string;
  label: string;
  feedback: string;
}

export interface YankCapability {
  getYankOptions(row: TableRow): YankOption[];
  getClipboardValue(row: TableRow, yankKey: string): Promise<string | null>;
}
