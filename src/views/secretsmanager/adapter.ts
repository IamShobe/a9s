import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell, secretCell } from "../../types.js";
import { runAwsJsonAsync, buildRegionArgs, resolveRegion } from "../../utils/aws.js";
import { atom } from "jotai";
import { getDefaultStore } from "jotai";
import type { AwsSecret, SecretRowMeta, SecretLevel } from "./types.js";
import { revealSecretsAtom } from "../../state/atoms.js";
import { createSecretsManagerDetailCapability } from "./capabilities/detailCapability.js";
import { createSecretsManagerYankCapability } from "./capabilities/yankCapability.js";
import { createSecretsManagerActionCapability } from "./capabilities/actionCapability.js";
import { createSecretsManagerEditCapability } from "./capabilities/editCapability.js";
import { getSecretValue } from "./client.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";
import { ageBandProps } from "../../utils/ageBanding.js";

interface SecretNavFrame extends NavFrame {
  level: SecretLevel;
}

export const secretsManagerLevelAtom = atom<SecretLevel>({ kind: "secrets" });
export const secretsManagerBackStackAtom = atom<SecretNavFrame[]>([]);

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
  const regionArgs = buildRegionArgs(region);

  // Getters and setters for level/backStack from atoms
  const getLevel = () => store.get(secretsManagerLevelAtom);
  const setLevel = (level: SecretLevel) => store.set(secretsManagerLevelAtom, level);
  const getBackStack = () => store.get(secretsManagerBackStackAtom);
  const setBackStack = (stack: SecretNavFrame[]) => store.set(secretsManagerBackStackAtom, stack);
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
        ...ageBandProps(secret.LastChangedDate),
      }));
    }

    // secret-fields level
    const { secretArn, secretName } = level;
    try {
      const secretData = await getSecretValue(secretArn, region);

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
    } catch (e) {
      debugLog("secretsmanager", `getRows (fields) failed for ${level.secretName}`, e);
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

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

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

  const getBrowserUrl = (row: TableRow): string | null => {
    const r = resolveRegion(region);
    const meta = row.meta as SecretRowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "secret") {
      return `https://${r}.console.aws.amazon.com/secretsmanager/secret?name=${encodeURIComponent(meta.name!)}&region=${r}`;
    }
    return null;
  };

  return {
    id: "secretsmanager",
    label: "Secrets Manager",
    hudColor: SERVICE_COLORS.secretsmanager,
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    getBrowserUrl,
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
