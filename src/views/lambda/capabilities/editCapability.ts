import type { EditCapability } from "../../../adapters/capabilities/EditCapability.js";
import type { TableRow, SelectResult } from "../../../types.js";
import { readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsLambdaFunction, LambdaLevel, LambdaRowMeta } from "../types.js";

export function createLambdaEditCapability(
  region?: string,
  getLevel?: () => LambdaLevel,
): EditCapability {
  const regionArgs = buildRegionArgs(region);

  const onEdit = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel?.();
    const meta = row.meta as LambdaRowMeta | undefined;

    if (!meta || level?.kind !== "functions" || meta.type !== "function") {
      return { action: "none" };
    }

    const data = await runAwsJsonAsync<{ Configuration: AwsLambdaFunction }>([
      "lambda",
      "get-function",
      "--function-name",
      meta.functionName,
      ...regionArgs,
    ]);

    const envVars = data.Configuration?.Environment?.Variables ?? {};
    const safeName = meta.functionName.replace(/[^a-z0-9_-]/gi, "_");
    const filePath = join(tmpdir(), `a9s_lambda_env_${safeName}.json`);
    await writeFile(filePath, JSON.stringify(envVars, null, 2), { mode: 0o600 });

    return {
      action: "edit",
      filePath,
      metadata: { functionName: meta.functionName },
    };
  };

  const uploadFile = async (filePath: string, metadata: Record<string, unknown>): Promise<void> => {
    const functionName = metadata.functionName as string | undefined;
    if (!functionName) throw new Error("Missing functionName in metadata");

    const envJson = await readFile(filePath, "utf-8");
    let envVars: Record<string, string>;
    try {
      envVars = JSON.parse(envJson) as Record<string, string>;
    } catch {
      throw new Error("Invalid JSON in environment variables file");
    }

    await runAwsJsonAsync<unknown>([
      "lambda",
      "update-function-configuration",
      "--function-name",
      functionName,
      "--environment",
      JSON.stringify({ Variables: envVars }),
      ...regionArgs,
    ]);
  };

  return { onEdit, uploadFile };
}
