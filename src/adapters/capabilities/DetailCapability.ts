import type { TableRow } from "../../types.js";

export interface DetailField {
  label: string;
  value: string;
}

export interface DetailCapability {
  getDetails(row: TableRow): Promise<DetailField[]>;
}
