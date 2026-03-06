import type { YankCapability, YankOption } from "../../../adapters/capabilities/YankCapability.js";
import type { TableRow } from "../../../types.js";
import type { IamLevel, IamRowMeta } from "../types.js";

function getIamMeta(row: TableRow): IamRowMeta | undefined {
  return row.meta as IamRowMeta | undefined;
}

export function createIamYankCapability(
  _getLevel: () => IamLevel,
): YankCapability {
  const getYankOptions = (row: TableRow): YankOption[] => {
    const meta = getIamMeta(row);
    if (meta?.type === "role" || meta?.type === "managed-policy") {
      return [{ key: "a", label: "copy arn", feedback: "Copied ARN" }];
    }
    return [];
  };

  const getClipboardValue = async (
    row: TableRow,
    yankKey: string,
  ): Promise<string | null> => {
    const meta = getIamMeta(row);
    if (yankKey === "a") {
      if (meta?.type === "role") return meta.arn;
      if (meta?.type === "managed-policy") return meta.policyArn;
    }
    return null;
  };

  return {
    getYankOptions,
    getClipboardValue,
  };
}
