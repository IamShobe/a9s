import type { S3Client } from "@aws-sdk/client-s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import Papa from "papaparse";
import { parquetRead } from "hyparquet";
import type { AsyncBuffer } from "hyparquet";
import type { PreviewCapability, PreviewPageResult } from "../../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow } from "../../../types.js";
import { textCell } from "../../../types.js";
import type { S3Level } from "../adapter.js";

function makeAsyncBuffer(buf: ArrayBuffer): AsyncBuffer {
  return {
    byteLength: buf.byteLength,
    slice: (start: number, end?: number) => Promise.resolve(buf.slice(start, end)),
  };
}

export function createS3PreviewCapability(
  client: S3Client,
  getLevel: () => S3Level,
): PreviewCapability {
  const canPreview = (row: TableRow): boolean => {
    if (row.meta?.type !== "object") return false;
    const key = row.meta?.key as string | undefined;
    if (!key) return false;
    const lower = key.toLowerCase();
    return lower.endsWith(".csv") || lower.endsWith(".parquet");
  };

  const getPage = async (
    row: TableRow,
    page: number,
    pageSize: number,
  ): Promise<PreviewPageResult> => {
    const level = getLevel();
    if (level.kind !== "objects") throw new Error("Not in objects level");

    const key = row.meta?.key as string;
    const fileName = key.split("/").pop() ?? key;
    const isParquet = key.toLowerCase().endsWith(".parquet");

    const response = await client.send(new GetObjectCommand({ Bucket: level.bucket, Key: key }));
    if (!response.Body) throw new Error("Empty response body");
    const bytes = await response.Body.transformToByteArray();

    let allRows: Record<string, unknown>[];
    let headers: string[];

    if (isParquet) {
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const asyncBuf = makeAsyncBuffer(buf);
      let rowData: Record<string, unknown>[] = [];
      await parquetRead({
        file: asyncBuf,
        rowFormat: "object",
        onComplete: (rows) => {
          rowData = rows as Record<string, unknown>[];
        },
      });
      allRows = rowData;
      headers = allRows.length > 0 ? Object.keys(allRows[0]!) : [];
    } else {
      const content = new TextDecoder().decode(bytes);
      const result = Papa.parse<Record<string, string>>(content, {
        header: true,
        skipEmptyLines: true,
      });
      allRows = result.data as Record<string, unknown>[];
      headers = result.meta.fields ?? [];
    }

    const totalRows = allRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
    const start = clampedPage * pageSize;
    const end = Math.min(start + pageSize, totalRows);
    const pageData = allRows.slice(start, end);

    const columns: ColumnDef[] = headers.map((h) => ({ key: h, label: h }));
    const rows: TableRow[] = pageData.map((record, i) => ({
      id: `row-${start + i}`,
      cells: Object.fromEntries(headers.map((h) => [h, textCell(String(record[h] ?? ""))])),
    }));

    return { columns, rows, page: clampedPage, totalRows, totalPages, fileName };
  };

  return { canPreview, getPage };
}
