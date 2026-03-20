import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsLambdaFunction, LambdaLevel, LambdaRowMeta } from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

export function createLambdaDetailCapability(
  region?: string,
  getLevel?: () => LambdaLevel,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as LambdaRowMeta | undefined;
    if (!meta) return [];

    const level = getLevel?.();

    if (level?.kind === "functions" && meta.type === "function") {
      try {
        const data = await runAwsJsonAsync<{ Configuration: AwsLambdaFunction }>([
          "lambda",
          "get-function",
          "--function-name",
          meta.functionName,
          ...regionArgs,
        ]);
        const fn = data.Configuration;
        if (!fn) return [];

        const envVars = fn.Environment?.Variables ?? {};
        const envDisplay =
          Object.keys(envVars).length > 0
            ? Object.entries(envVars)
                .map(([k, v]) => `${k}=${v}`)
                .join("\n")
            : "(none)";

        const fields: DetailField[] = [
          { label: "Function Name", value: fn.FunctionName },
          { label: "ARN", value: fn.FunctionArn },
          { label: "Role", value: fn.Role ?? "-" },
          { label: "Architecture", value: (fn.Architectures ?? []).join(", ") || "-" },
          { label: "Package Type", value: fn.PackageType ?? "-" },
          { label: "Code Size", value: fn.CodeSize != null ? (fn.CodeSize >= 1048576 ? `${(fn.CodeSize / 1048576).toFixed(1)} MB` : `${(fn.CodeSize / 1024).toFixed(1)} KB`) : "-" },
          { label: "Runtime", value: fn.Runtime ?? "-" },
          { label: "Handler", value: fn.Handler ?? "-" },
          { label: "Memory", value: fn.MemorySize != null ? `${fn.MemorySize} MB` : "-" },
          { label: "Timeout", value: fn.Timeout != null ? `${fn.Timeout}s` : "-" },
          { label: "Last Modified", value: fn.LastModified ?? "-" },
          { label: "Description", value: fn.Description || "(none)" },
          { label: "Environment", value: envDisplay },
        ];

        if (fn.Layers && fn.Layers.length > 0) {
          fields.push({
            label: "Layers",
            value: fn.Layers.map((l) => l.Arn).join("\n"),
          });
        }

        if (fn.VpcConfig?.VpcId) {
          fields.push({ label: "VPC", value: fn.VpcConfig.VpcId });
          fields.push({
            label: "Subnets",
            value: (fn.VpcConfig.SubnetIds ?? []).join(", ") || "-",
          });
          fields.push({
            label: "Security Groups",
            value: (fn.VpcConfig.SecurityGroupIds ?? []).join(", ") || "-",
          });
        }

        if (fn.ReservedConcurrentExecutions != null) {
          fields.push({
            label: "Reserved Concurrency",
            value: String(fn.ReservedConcurrentExecutions),
          });
        }

        return fields;
      } catch (e) {
        debugLog("lambda", "getDetails (function) failed", e);
        return [];
      }
    }

    if (level?.kind === "versions" && meta.type === "version") {
      return [
        { label: "Function Name", value: meta.functionName },
        { label: "Version", value: meta.version },
        { label: "ARN", value: meta.functionArn },
      ];
    }

    return [];
  };

  return { getDetails };
}
