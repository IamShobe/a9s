import type { ColumnDef, TableRow } from "../../types.js";

export interface PreviewPageResult {
  columns: ColumnDef[];
  rows: TableRow[];
  page: number;
  totalRows: number;
  totalPages: number;
  fileName: string;
}

export interface PreviewCapability {
  canPreview(row: TableRow): boolean;
  getPage(row: TableRow, page: number, pageSize: number): Promise<PreviewPageResult>;
}
