import type { TableRow, SelectResult } from "../../types.js";

export interface EditCapability {
  onEdit(row: TableRow): Promise<SelectResult>;
  uploadFile(filePath: string, metadata: Record<string, unknown>): Promise<void>;
}
