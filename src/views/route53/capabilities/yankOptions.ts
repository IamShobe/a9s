import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { Route53RowMetaSchema } from "../schema.js";

export const Route53YankOptions: YankOptionDef<
  z.infer<typeof Route53RowMetaSchema>,
  Record<string, never>
>[] = [
  // Zone options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy zone name",
    feedback: "Copied zone name",
    isRelevant: (row) => row.meta.type === "zone",
    resolve: async (row) => {
      return row.meta.zoneName ?? null;
    },
  },
  {
    trigger: { type: "key", char: "i" },
    label: "Copy zone ID",
    feedback: "Copied zone ID",
    isRelevant: (row) => row.meta.type === "zone",
    resolve: async (row) => {
      return row.meta.zoneId ?? null;
    },
  },

  // Record options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy record name",
    feedback: "Copied record name",
    isRelevant: (row) => row.meta.type === "record",
    resolve: async (row) => {
      return row.meta.recordName ?? null;
    },
  },
  {
    trigger: { type: "key", char: "v" },
    label: "Copy first value",
    feedback: "Copied first value",
    isRelevant: (row) => {
      return row.meta.type === "record" && (row.meta.recordValues?.length ?? 0) > 0;
    },
    resolve: async (row) => {
      return row.meta.recordValues?.[0] ?? null;
    },
  },
  {
    trigger: { type: "key", char: "b" },
    label: "Copy in BIND format",
    feedback: "Copied BIND format",
    isRelevant: (row) => row.meta.type === "record",
    resolve: async (row) => {
      const name = row.meta.recordName ?? "";
      const type = row.meta.recordType ?? "";
      const ttl = row.meta.recordTtl ?? 3600;
      const value = row.meta.recordValues?.[0] ?? "";

      if (row.meta.recordAliasTarget) {
        return `${name} ALIAS ${row.meta.recordAliasTarget.DNSName}`;
      }

      return `${name} ${ttl} IN ${type} ${value}`;
    },
  },
];
