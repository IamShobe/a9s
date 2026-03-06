import type { S3Client } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { readFile } from "fs/promises";

import type { EditCapability } from "../../../adapters/capabilities/EditCapability.js";
import type { TableRow, SelectResult } from "../../../types.js";
import { downloadObject } from "../fetcher.js";
import type { S3Level } from "../adapter.js";

export function createS3EditCapability(
  client: S3Client,
  getLevel: () => S3Level,
): EditCapability {
  const onEdit = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const type = row.meta?.type as string;
    if (level.kind !== "objects" || type !== "object") {
      return { action: "none" };
    }

    const filePath = await downloadObject(
      client,
      level.bucket,
      row.meta?.key as string,
    );
    return {
      action: "edit",
      filePath,
      metadata: {
        bucket: level.bucket,
        key: row.meta?.key,
      },
    };
  };

  const uploadFile = async (
    filePath: string,
    metadata: Record<string, unknown>,
  ): Promise<void> => {
    const bucket = metadata.bucket as string;
    const key = metadata.key as string;
    const fileContent = await readFile(filePath);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileContent,
      }),
    );
  };

  return {
    onEdit,
    uploadFile,
  };
}
