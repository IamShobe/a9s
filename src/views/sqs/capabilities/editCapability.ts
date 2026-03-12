import type { EditCapability } from "../../../adapters/capabilities/EditCapability.js";
import type { TableRow, SelectResult } from "../../../types.js";
import { readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsSQSQueueAttributes, SQSLevel, SQSRowMeta } from "../types.js";

const EDITABLE_ATTRS = [
  "VisibilityTimeout",
  "MessageRetentionPeriod",
  "DelaySeconds",
  "ReceiveMessageWaitTimeSeconds",
  "RedrivePolicy",
] as const;

export function createSQSEditCapability(
  region?: string,
  getLevel?: () => SQSLevel,
): EditCapability {
  const regionArgs = buildRegionArgs(region);

  const onEdit = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel?.();
    const meta = row.meta as SQSRowMeta | undefined;

    if (!meta || level?.kind !== "queues" || meta.type !== "queue") {
      return { action: "none" };
    }

    const data = await runAwsJsonAsync<{ Attributes: AwsSQSQueueAttributes }>([
      "sqs",
      "get-queue-attributes",
      "--queue-url",
      meta.queueUrl,
      "--attribute-names",
      "All",
      ...regionArgs,
    ]);
    const attrs = data.Attributes ?? {};

    // Only expose editable attributes
    const editableObj: Record<string, string> = {};
    for (const key of EDITABLE_ATTRS) {
      if (attrs[key] !== undefined) {
        editableObj[key] = attrs[key]!;
      }
    }

    const safeName = meta.queueName.replace(/[^a-z0-9_-]/gi, "_");
    const filePath = join(tmpdir(), `a9s_sqs_attrs_${safeName}.json`);
    await writeFile(filePath, JSON.stringify(editableObj, null, 2), { mode: 0o600 });

    return {
      action: "edit",
      filePath,
      metadata: { queueUrl: meta.queueUrl },
    };
  };

  const uploadFile = async (filePath: string, metadata: Record<string, unknown>): Promise<void> => {
    const queueUrl = metadata.queueUrl as string | undefined;
    if (!queueUrl) throw new Error("Missing queueUrl in metadata");

    const newAttrsJson = await readFile(filePath, "utf-8");
    let newAttrs: Record<string, string>;
    try {
      newAttrs = JSON.parse(newAttrsJson) as Record<string, string>;
    } catch {
      throw new Error("Invalid JSON in attributes file");
    }

    // Filter to only allowed keys
    const safeAttrs: Record<string, string> = {};
    for (const key of EDITABLE_ATTRS) {
      if (key in newAttrs) {
        safeAttrs[key] = newAttrs[key]!;
      }
    }

    if (Object.keys(safeAttrs).length === 0) return;

    await runAwsJsonAsync<unknown>([
      "sqs",
      "set-queue-attributes",
      "--queue-url",
      queueUrl,
      "--attributes",
      JSON.stringify(safeAttrs),
      ...regionArgs,
    ]);
  };

  return { onEdit, uploadFile };
}
