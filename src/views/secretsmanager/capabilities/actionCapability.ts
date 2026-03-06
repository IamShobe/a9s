import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../../adapters/capabilities/ActionCapability.js";
import { runAwsJsonAsync } from "../../../utils/aws.js";
import { writeFile, stat, mkdir } from "fs/promises";
import { resolve, basename, join } from "path";
import type { AwsSecretValue, SecretRowMeta, SecretLevel } from "../types.js";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function hasCode(error: unknown, code: string): boolean {
  return Boolean(
    typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === code,
  );
}

export function createSecretsManagerActionCapability(
  region?: string,
  getLevel?: () => SecretLevel,
): ActionCapability {
  const regionArgs = region ? ["--region", region] : [];

  const getKeybindings = (): AdapterKeyBinding[] => [
    {
      trigger: { type: "key", char: "f" },
      actionId: "fetch",
      label: "Fetch / save to file",
      shortLabel: "save file",
      scope: "navigate",
      adapterId: "secrets-manager",
    },
  ];

  const executeAction = async (actionId: string, context: ActionContext): Promise<ActionEffect> => {
    const level = getLevel?.();

    if (actionId === "fetch") {
      // Start fetch flow: prompt for path
      if (!context.row) return { type: "error", message: "No row selected" };
      const meta = context.row.meta as SecretRowMeta | undefined;
      if (!meta) {
        return { type: "error", message: "No item selected" };
      }

      const isValidLevel = (level?.kind === "secrets" && meta.type === "secret") ||
                          (level?.kind === "secret-fields" && meta.type === "secret-field");
      if (!isValidLevel) {
        return { type: "error", message: "Fetch is not available for this item" };
      }

      const promptLabel = level?.kind === "secrets" ? "Fetch secret to:" : "Fetch field to:";
      return {
        type: "prompt",
        label: promptLabel,
        defaultValue: "",
        nextActionId: "fetch:submit",
      };
    }

    if (actionId === "fetch:submit") {
      // User entered a path; try to write the secret/field
      if (!context.row || !context.data?.path) {
        return { type: "error", message: "Invalid path" };
      }

      const meta = context.row.meta as SecretRowMeta | undefined;
      if (!meta) {
        return { type: "error", message: "No item selected" };
      }

      let content = "";
      let defaultFileName = "data.txt";

      try {
        if (level?.kind === "secrets" && meta.type === "secret") {
          // Fetch secret value
          const secretData = await runAwsJsonAsync<AwsSecretValue>([
            "secretsmanager",
            "get-secret-value",
            "--secret-id",
            meta.arn!,
            ...regionArgs,
          ]);

          content =
            secretData.SecretString ||
            (secretData.SecretBinary ? Buffer.from(secretData.SecretBinary, "base64").toString() : "");
          defaultFileName = `${meta.name}.txt`;
        } else if (level?.kind === "secret-fields" && meta.type === "secret-field") {
          // Use field value directly
          content = meta.value || "";
          defaultFileName = `${meta.key!}.txt`;
        } else {
          return { type: "error", message: "Invalid item type" };
        }

        const destinationPath = context.data.path as string;

        // Handle destination path
        const rawTarget = destinationPath.trim();
        const absTarget = resolve(rawTarget);
        const endsWithSlash = rawTarget.endsWith("/") || rawTarget.endsWith("\\");

        let finalPath = absTarget;
        if (endsWithSlash) {
          await mkdir(absTarget, { recursive: true });
          finalPath = join(absTarget, defaultFileName);
        } else {
          const targetStat = await stat(absTarget).catch(() => null);
          if (targetStat?.isDirectory()) {
            finalPath = join(absTarget, defaultFileName);
          } else if (targetStat?.isFile()) {
            finalPath = absTarget;
            throw new Error("EEXIST_FILE:" + finalPath);
          }
        }

        // Ensure parent directory exists
        await mkdir(resolve(finalPath, ".."), { recursive: true });
        await writeFile(finalPath, content, { mode: 0o600 });

        return {
          type: "feedback",
          message: `Saved to ${finalPath}`,
        };
      } catch (err) {
        // Check for file exists error
        if (hasCode(err, "EEXIST")) {
          const destinationPath = context.data.path as string;
          return {
            type: "confirm",
            message: `File exists. Overwrite ${destinationPath}?`,
            nextActionId: "fetch:overwrite",
            data: { path: destinationPath },
          };
        }
        if (
          err instanceof Error &&
          err.message.includes("EEXIST_FILE")
        ) {
          const filePath = err.message.replace("EEXIST_FILE:", "");
          return {
            type: "confirm",
            message: `File exists. Overwrite ${filePath}?`,
            nextActionId: "fetch:overwrite",
            data: { path: filePath },
          };
        }
        return {
          type: "error",
          message: `Fetch failed: ${toErrorMessage(err)}`,
        };
      }
    }

    if (actionId === "fetch:overwrite") {
      // User confirmed overwrite
      if (!context.row || !context.data?.path) {
        return { type: "error", message: "Invalid path" };
      }

      const meta = context.row.meta as SecretRowMeta | undefined;
      if (!meta) {
        return { type: "error", message: "No item selected" };
      }

      const destinationPath = context.data.path as string;

      try {
        let content = "";

        if (level?.kind === "secrets" && meta.type === "secret") {
          // Fetch secret value
          const secretData = await runAwsJsonAsync<AwsSecretValue>([
            "secretsmanager",
            "get-secret-value",
            "--secret-id",
            meta.arn!,
            ...regionArgs,
          ]);

          content =
            secretData.SecretString ||
            (secretData.SecretBinary ? Buffer.from(secretData.SecretBinary, "base64").toString() : "");
        } else if (level?.kind === "secret-fields" && meta.type === "secret-field") {
          // Use field value directly
          content = meta.value || "";
        } else {
          return { type: "error", message: "Invalid item type" };
        }

        await writeFile(destinationPath, content, { mode: 0o600 });

        return {
          type: "feedback",
          message: `Saved to ${destinationPath}`,
        };
      } catch (err) {
        return {
          type: "error",
          message: `Fetch failed: ${toErrorMessage(err)}`,
        };
      }
    }

    return { type: "none" };
  };

  return {
    getKeybindings,
    executeAction,
  };
}
