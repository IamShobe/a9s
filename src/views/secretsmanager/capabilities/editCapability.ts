import type { EditCapability } from "../../../adapters/capabilities/EditCapability.js";
import type { TableRow, SelectResult } from "../../../types.js";
import { readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { getSecretValue, putSecretValue } from "../client.js";
import type { SecretRowMeta, SecretLevel } from "../types.js";

export function createSecretsManagerEditCapability(
  region?: string,
  getLevel?: () => SecretLevel,
): EditCapability {
  const onEdit = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel?.();
    const meta = row.meta as SecretRowMeta | undefined;

    if (!meta) {
      return { action: "none" };
    }

    // Level 1: open secret in editor (both JSON and non-JSON)
    if (level?.kind === "secrets" && meta.type === "secret") {
      const secretData = await getSecretValue(meta.arn!, region);

      const secretString = secretData.SecretString || "";
      const safeName = meta.name!.replace(/[^a-z0-9_-]/gi, "_");
      const filePath = join(tmpdir(), `a9s_secret_${safeName}`);
      await writeFile(filePath, secretString, { mode: 0o600 });

      return {
        action: "edit",
        filePath,
        metadata: {
          secretArn: meta.arn,
          secretName: meta.name,
        },
      };
    }

    // Level 2: field edits
    if (level?.kind === "secret-fields" && meta.type === "secret-field") {
      const fieldValue = meta.value || "";
      const safeName = meta.key!.replace(/[^a-z0-9_-]/gi, "_");
      const filePath = join(tmpdir(), `a9s_field_${safeName}`);
      await writeFile(filePath, fieldValue, { mode: 0o600 });

      return {
        action: "edit",
        filePath,
        metadata: {
          fieldKey: meta.key,
          secretArn: meta.secretArn,
          secretName: meta.secretName,
        },
      };
    }

    return { action: "none" };
  };

  const uploadFile = async (filePath: string, metadata: Record<string, unknown>): Promise<void> => {
    const fieldKey = metadata.fieldKey as string | undefined;
    const secretArn = metadata.secretArn as string | undefined;

    try {
      // Level 2: Update field in JSON secret
      if (fieldKey && secretArn) {
        const newContent = await readFile(filePath, "utf-8");

        const secretData = await getSecretValue(secretArn, region);
        const secretString = secretData.SecretString || "";
        let parsed: Record<string, unknown>;

        try {
          parsed = JSON.parse(secretString);
        } catch {
          throw new Error("Failed to parse secret JSON");
        }

        parsed[fieldKey] = newContent;
        await putSecretValue(secretArn, JSON.stringify(parsed), region);
        return;
      }

      // Level 1: Update entire secret (JSON or non-JSON)
      if (secretArn && !fieldKey) {
        const newContent = await readFile(filePath, "utf-8");
        await putSecretValue(secretArn, newContent, region);
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to update secret: ${message}`);
    }
  };

  return {
    onEdit,
    uploadFile,
  };
}
