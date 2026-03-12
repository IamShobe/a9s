import type { EditCapability } from "../../../adapters/capabilities/EditCapability.js";
import type { TableRow, SelectResult } from "../../../types.js";
import { readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { CloudWatchLevel, CloudWatchRowMeta } from "../types.js";

export function createCloudWatchEditCapability(
  region?: string,
  getLevel?: () => CloudWatchLevel,
): EditCapability {
  const regionArgs = buildRegionArgs(region);

  const onEdit = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel?.();
    const meta = row.meta as CloudWatchRowMeta | undefined;

    if (!meta || level?.kind !== "log-groups" || meta.type !== "log-group") {
      return { action: "none" };
    }

    const retentionData = {
      retentionInDays: meta.retentionInDays > 0 ? meta.retentionInDays : 0,
    };

    const safeName = meta.logGroupName.replace(/[^a-z0-9_-]/gi, "_");
    const filePath = join(tmpdir(), `a9s_logs_retention_${safeName}.json`);
    await writeFile(filePath, JSON.stringify(retentionData, null, 2), { mode: 0o600 });

    return {
      action: "edit",
      filePath,
      metadata: { logGroupName: meta.logGroupName },
    };
  };

  const uploadFile = async (filePath: string, metadata: Record<string, unknown>): Promise<void> => {
    const logGroupName = metadata.logGroupName as string | undefined;
    if (!logGroupName) throw new Error("Missing logGroupName in metadata");

    const configJson = await readFile(filePath, "utf-8");
    let config: { retentionInDays?: number };
    try {
      config = JSON.parse(configJson) as { retentionInDays?: number };
    } catch {
      throw new Error("Invalid JSON in retention config file");
    }

    const days = config.retentionInDays ?? 0;
    if (days <= 0) {
      // Remove retention policy (never expire)
      await runAwsJsonAsync<unknown>([
        "logs",
        "delete-retention-policy",
        "--log-group-name",
        logGroupName,
        ...regionArgs,
      ]);
    } else {
      await runAwsJsonAsync<unknown>([
        "logs",
        "put-retention-policy",
        "--log-group-name",
        logGroupName,
        "--retention-in-days",
        String(days),
        ...regionArgs,
      ]);
    }
  };

  return { onEdit, uploadFile };
}
