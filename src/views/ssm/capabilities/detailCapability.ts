import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { SSMLevel, SSMRowMeta } from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

interface AwsSSMParameterFull {
  Name: string;
  Type: string;
  Value?: string;
  ARN?: string;
  Version?: number;
  LastModifiedDate?: string;
  DataType?: string;
  Description?: string;
}

export function createSSMDetailCapability(
  region?: string,
  getLevel?: () => SSMLevel,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as SSMRowMeta | undefined;
    if (!meta) return [];

    const level = getLevel?.();

    if (level?.kind === "parameters" && meta.type === "parameter") {
      try {
        const data = await runAwsJsonAsync<{ Parameter: AwsSSMParameterFull }>([
          "ssm",
          "get-parameter",
          "--name",
          meta.parameterName,
          "--with-decryption",
          ...regionArgs,
        ]);
        const p = data.Parameter;
        const valuePreview = p.Value
          ? p.Value.length > 100
            ? p.Value.slice(0, 100) + "…"
            : p.Value
          : "-";
        return [
          { label: "Name", value: meta.parameterName },
          { label: "ARN", value: meta.parameterArn || p.ARN || "-" },
          { label: "Type", value: p.Type },
          { label: "Version", value: p.Version != null ? String(p.Version) : "-" },
          { label: "Last Modified", value: p.LastModifiedDate ? p.LastModifiedDate.slice(0, 19).replace("T", " ") : "-" },
          { label: "Data Type", value: p.DataType ?? "-" },
          { label: "Value", value: valuePreview },
        ];
      } catch (e) {
        debugLog("ssm", "getDetails (parameter) failed", e);
        return [];
      }
    }

    if (level?.kind === "history" && meta.type === "history") {
      return [
        { label: "Name", value: meta.parameterName },
        { label: "Version", value: String(meta.version) },
        { label: "Type", value: meta.parameterType },
        { label: "Last Modified", value: row.cells["lastModified"]?.displayName ?? "-" },
        { label: "Modified By", value: row.cells["modifiedBy"]?.displayName ?? "-" },
      ];
    }

    return [];
  };

  return { getDetails };
}
