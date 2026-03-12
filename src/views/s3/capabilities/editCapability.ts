import type { S3Client } from "@aws-sdk/client-s3";
import {
  DeleteBucketPolicyCommand,
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { tmpdir } from "os";
import { join } from "path";
import { readFile, writeFile } from "fs/promises";

import type { EditCapability } from "../../../adapters/capabilities/EditCapability.js";
import type { TableRow, SelectResult } from "../../../types.js";
import { downloadObject } from "../fetcher.js";
import type { S3Level } from "../adapter.js";

export function createS3EditCapability(client: S3Client, getLevel: () => S3Level): EditCapability {
  const onEdit = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const type = row.meta?.type as string;

    if (type === "bucket") {
      const bucket = row.id;
      let policyText = "{}";
      try {
        const result = await client.send(new GetBucketPolicyCommand({ Bucket: bucket }));
        if (result.Policy) {
          policyText = JSON.stringify(JSON.parse(result.Policy), null, 2);
        }
      } catch {
        // No policy attached — start with empty policy template
        policyText = JSON.stringify(
          {
            Version: "2012-10-17",
            Statement: [],
          },
          null,
          2,
        );
      }
      const safeName = bucket.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filePath = join(tmpdir(), `a9s_s3_policy_${safeName}.json`);
      await writeFile(filePath, policyText, "utf8");
      return {
        action: "edit",
        filePath,
        metadata: { bucket, type: "bucket-policy" },
      };
    }

    if (level.kind !== "objects" || type !== "object") {
      return { action: "none" };
    }

    const filePath = await downloadObject(client, level.bucket, row.meta?.key as string);
    return {
      action: "edit",
      filePath,
      metadata: {
        bucket: level.bucket,
        key: row.meta?.key,
      },
    };
  };

  const uploadFile = async (filePath: string, metadata: Record<string, unknown>): Promise<void> => {
    const bucket = metadata.bucket as string;

    if (metadata.type === "bucket-policy") {
      const content = await readFile(filePath, "utf8");
      const trimmed = content.trim();
      // If the user emptied the policy or left an empty Statement array, delete it
      if (!trimmed || trimmed === "{}") {
        await client.send(new DeleteBucketPolicyCommand({ Bucket: bucket }));
        return;
      }
      await client.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: trimmed }));
      return;
    }

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
