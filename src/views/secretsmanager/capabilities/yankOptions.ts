import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import type { SecretRowMeta, SecretLevel } from "../types.js";
import { getSecretValue } from "../client.js";

export interface SecretYankCtx {
  region: string | undefined;
  getLevel: (() => SecretLevel) | undefined;
}

const isSecret = (row: { meta: SecretRowMeta }) => row.meta.type === "secret";
const isSecretField = (row: { meta: SecretRowMeta }) => row.meta.type === "secret-field";

export const secretYankOptions: YankOptionDef<SecretRowMeta, SecretYankCtx>[] = [
  {
    trigger: { type: "key", char: "n" },
    label: "copy name",
    feedback: "Copied Secret Name",
    headerKey: "name",
    isRelevant: isSecret,
    resolve: async (row) => {
      return (row.meta.name as string) || null;
    },
  },
  {
    trigger: { type: "key", char: "a" },
    label: "copy arn",
    feedback: "Copied ARN",
    headerKey: "name",
    isRelevant: isSecret,
    resolve: async (row) => {
      return (row.meta.arn as string | undefined) || null;
    },
  },
  {
    trigger: { type: "key", char: "v" },
    label: "copy secret value",
    feedback: "Copied Secret Value",
    headerKey: "name",
    isRelevant: isSecret,
    resolve: async (row, ctx) => {
      try {
        const secretData = await getSecretValue(row.meta.arn!, ctx.region);
        return secretData.SecretString || null;
      } catch {
        return null;
      }
    },
  },
  {
    trigger: { type: "key", char: "k" },
    label: "copy field key",
    feedback: "Copied Field Key",
    headerKey: "key",
    isRelevant: isSecretField,
    resolve: async (row) => {
      return (row.meta.key as string | undefined) || null;
    },
  },
  {
    trigger: { type: "key", char: "v" },
    label: "copy field value",
    feedback: "Copied Field Value",
    headerKey: "value",
    isRelevant: isSecretField,
    resolve: async (row) => {
      return (row.meta.value as string | undefined) || null;
    },
  },
];
