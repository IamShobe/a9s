import type { YankCapability, YankOption } from "../../../adapters/capabilities/YankCapability.js";
import type { TableRow } from "../../../types.js";
import type { S3Level } from "../adapter.js";

export function createS3YankCapability(
  getLevel: () => S3Level,
  getDetails: (row: TableRow) => Promise<{ label: string; value: string }[]>,
): YankCapability {
  const getYankOptions = (row: TableRow): YankOption[] => {
    const type = row.meta?.type as string | undefined;
    const options: YankOption[] = [];
    if (type === "bucket" || type === "folder" || type === "object") {
      options.push({ key: "k", label: "copy key/path", feedback: "Copied Key" });
      options.push({ key: "a", label: "copy arn", feedback: "Copied ARN" });
    }
    if (type === "object") {
      options.push({ key: "e", label: "copy etag", feedback: "Copied ETag" });
      options.push({
        key: "d",
        label: "copy last-modified",
        feedback: "Copied Last Modified",
      });
    }
    return options;
  };

  const getClipboardValue = async (
    row: TableRow,
    yankKey: string,
  ): Promise<string | null> => {
    const level = getLevel();
    const type = row.meta?.type as string | undefined;
    const key = row.meta?.key as string | undefined;
    const bucket = level.kind === "objects" ? level.bucket : row.id;

    if (yankKey === "k") {
      if (type === "bucket") return `s3://${row.id}`;
      if (key && bucket) return `s3://${bucket}/${key}`;
    }
    if (yankKey === "a") {
      if (type === "bucket") return `arn:aws:s3:::${row.id}`;
      if ((type === "object" || type === "folder") && key && bucket) {
        return `arn:aws:s3:::${bucket}/${key}`;
      }
    }
    if (yankKey === "e" && type === "object") {
      const fields = await getDetails(row);
      const etag = fields.find((f) => f.label === "ETag")?.value ?? "";
      return etag && etag !== "-" ? etag : null;
    }
    if (yankKey === "d" && type === "object") {
      const fields = await getDetails(row);
      const lastModified = fields.find((f) => f.label === "Last Modified")?.value ?? "";
      return lastModified && lastModified !== "-" ? lastModified : null;
    }
    return null;
  };

  return {
    getYankOptions,
    getClipboardValue,
  };
}
