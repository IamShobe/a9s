import type { EditCapability } from "../../../adapters/capabilities/EditCapability.js";
import type { TableRow, SelectResult } from "../../../types.js";
import { readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { SSMLevel, SSMRowMeta } from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

export function createSSMEditCapability(
  region?: string,
  getLevel?: () => SSMLevel,
): EditCapability {
  const regionArgs = buildRegionArgs(region);

  const onEdit = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel?.();
    const meta = row.meta as SSMRowMeta | undefined;

    if (!meta || level?.kind !== "parameters" || meta.type !== "parameter") {
      return { action: "none" };
    }

    // Fetch current value
    let currentValue = "";
    try {
      const data = await runAwsJsonAsync<{ Parameter: { Value?: string } }>([
        "ssm",
        "get-parameter",
        "--name",
        meta.parameterName,
        "--with-decryption",
        ...regionArgs,
      ]);
      currentValue = data.Parameter.Value ?? "";
    } catch (e) {
      debugLog("ssm", "onEdit: failed to fetch parameter value", e);
    }

    const safeName = meta.parameterName.replace(/[^a-z0-9_-]/gi, "_");
    const filePath = join(tmpdir(), `a9s_ssm_param_${safeName}.txt`);
    await writeFile(filePath, currentValue, { mode: 0o600 });

    return {
      action: "edit",
      filePath,
      metadata: {
        parameterName: meta.parameterName,
        parameterType: meta.parameterType,
      },
    };
  };

  const uploadFile = async (filePath: string, metadata: Record<string, unknown>): Promise<void> => {
    const parameterName = metadata.parameterName as string | undefined;
    const parameterType = (metadata.parameterType as string | undefined) ?? "String";
    if (!parameterName) throw new Error("Missing parameterName in metadata");

    const newValue = await readFile(filePath, "utf-8");

    await runAwsJsonAsync<unknown>([
      "ssm",
      "put-parameter",
      "--name",
      parameterName,
      "--value",
      newValue,
      "--type",
      parameterType,
      "--overwrite",
      ...regionArgs,
    ]);
  };

  return { onEdit, uploadFile };
}
