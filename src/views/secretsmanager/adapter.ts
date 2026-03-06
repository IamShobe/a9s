import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell, secretCell } from "../../types.js";
import { runAwsJsonAsync } from "../../utils/aws.js";
import { atom } from "jotai";
import { getDefaultStore } from "jotai";
import type { AwsSecret, AwsSecretValue, SecretRowMeta, SecretLevel } from "./types.js";
import { revealSecretsAtom } from "../../state/atoms.js";
import { createSecretsManagerDetailCapability } from "./capabilities/detailCapability.js";
import { createSecretsManagerYankCapability } from "./capabilities/yankCapability.js";
import { createSecretsManagerActionCapability } from "./capabilities/actionCapability.js";
import { createSecretsManagerEditCapability } from "./capabilities/editCapability.js";

interface SecretNavFrame extends NavFrame {
  level: SecretLevel;
}

export const secretLevelAtom = atom<SecretLevel>({ kind: "secrets" });
export const secretBackStackAtom = atom<SecretNavFrame[]>([]);

function tryParseFields(secretString: string): Record<string, string> | null {
  try {
    const parsed = JSON.parse(secretString);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]));
    }
  } catch {
    // Not JSON
  }
  return null;
}

export function createSecretsManagerServiceAdapter(
  endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = region ? ["--region", region] : [];

  // Getters and setters for level/backStack from atoms
  const getLevel = () => store.get(secretLevelAtom);
  const setLevel = (level: SecretLevel) => store.set(secretLevelAtom, level);
  const getBackStack = () => store.get(secretBackStackAtom);
  const setBackStack = (stack: SecretNavFrame[]) => store.set(secretBackStackAtom, stack);
  const setReveal = (reveal: boolean) => store.set(revealSecretsAtom, reveal);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "secrets") {
      return [
        { key: "name", label: "Name" },
        { key: "description", label: "Description", width: 30 },
        { key: "lastChanged", label: "Last Changed", width: 22 },
        { key: "rotation", label: "Rotation", width: 10 },
      ];
    }
    // secret-fields level
    return [
      { key: "key", label: "Key" },
      { key: "value", label: "Value", width: 50 },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();
    if (level.kind === "secrets") {
      const data = await runAwsJsonAsync<{ SecretList?: AwsSecret[] }>([
        "secretsmanager",
        "list-secrets",
        ...regionArgs,
      ]);

      return (data.SecretList ?? []).map((secret) => ({
        id: secret.ARN,
        cells: {
          name: textCell(secret.Name),
          description: textCell(secret.Description ?? ""),
          lastChanged: textCell(
            secret.LastChangedDate
              ? new Date(secret.LastChangedDate).toISOString().replace("T", " ").slice(0, 19)
              : "-",
          ),
          rotation: textCell(secret.RotationEnabled ? "✓" : "-"),
        },
        meta: {
          type: "secret",
          name: secret.Name,
          arn: secret.ARN,
          description: secret.Description ?? "",
        } satisfies SecretRowMeta,
      }));
    }

    // secret-fields level
    const { secretArn, secretName } = level;
    try {
      const secretData = await runAwsJsonAsync<AwsSecretValue>([
        "secretsmanager",
        "get-secret-value",
        "--secret-id",
        secretArn,
        ...regionArgs,
      ]);

      const secretString = secretData.SecretString || "";
      const fields: Array<{ key: string; value: string }> = [];

      // Always add $RAW field (the whole secret value)
      fields.push({ key: "$RAW", value: secretString });

      // If JSON, also add parsed fields
      const parsed = tryParseFields(secretString);
      if (parsed) {
        Object.entries(parsed).forEach(([key, value]) => {
          fields.push({ key, value });
        });
      }

      // Store raw values; formatting happens at display time based on reveal state
      return fields.map(({ key, value }) => ({
        id: key,
        cells: {
          key: textCell(key),
          value: secretCell(value), // Raw value - will be formatted at display time
        },
        meta: {
          type: "secret-field",
          key,
          value, // Raw value stored in metadata too
          secretArn,
          secretName,
        } satisfies SecretRowMeta,
      }));
    } catch {
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as SecretRowMeta | undefined;

    if (level.kind === "secrets") {
      if (!meta || meta.type !== "secret") {
        return { action: "none" };
      }

      // Always navigate to level 2 (which includes $RAW field)
      const newStack = [...backStack, { level: level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "secret-fields",
        secretArn: meta.arn!,
        secretName: meta.name!,
      });
      // Reset reveal state when entering a secret (security: always start hidden)
      setReveal(false);
      return { action: "navigate" };
    }

    // secret-fields level: do nothing (use "e" key to edit)
    return { action: "none" };
  };

  const canGoBack = (): boolean => getBackStack().length > 0;

  const goBack = (): void => {
    const backStack = getBackStack();
    if (backStack.length > 0) {
      const newStack = backStack.slice(0, -1);
      const frame = backStack[backStack.length - 1];
      setBackStack(newStack);
      setLevel(frame.level);
    }
  };

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "secrets") return "secrets://";
    return `secrets://${level.secretName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "secrets") return "🔑 Secrets Manager";
    return `🔑 Secret: ${level.secretName}`;
  };

  // Compose capabilities
  const detailCapability = createSecretsManagerDetailCapability(region, getLevel);
  const editCapability = createSecretsManagerEditCapability(region, getLevel);
  const yankCapability = createSecretsManagerYankCapability(region, getLevel);
  const actionCapability = createSecretsManagerActionCapability(region, getLevel);

  return {
    id: "secretsmanager",
    label: "Secrets Manager",
    hudColor: { bg: "blue", fg: "white" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    reset() {
      setLevel({ kind: "secrets" });
      setBackStack([]);
    },
    capabilities: {
      edit: editCapability,
      detail: detailCapability,
      yank: yankCapability,
      actions: actionCapability,
    },
  };
}
