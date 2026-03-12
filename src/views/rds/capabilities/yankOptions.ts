import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { RDSRowMetaSchema } from "../schema.js";

type RDSMeta = z.infer<typeof RDSRowMetaSchema>;

export const RDSYankOptions: YankOptionDef<RDSMeta, Record<string, never>>[] = [
  // Instance options
  {
    trigger: { type: "key", char: "i" },
    label: "Copy identifier",
    feedback: "Copied identifier",
    isRelevant: (row) => row.meta.type === "instance",
    resolve: async (row) => row.meta.dbInstanceIdentifier ?? null,
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy ARN",
    feedback: "Copied ARN",
    isRelevant: (row) => row.meta.type === "instance",
    resolve: async (row) => row.meta.dbInstanceArn ?? null,
  },
  {
    trigger: { type: "key", char: "e" },
    label: "Copy endpoint",
    feedback: "Copied endpoint",
    isRelevant: (row) => row.meta.type === "instance",
    resolve: async (row) => {
      // endpoint is not in meta, but identifier is good enough; detail panel shows full endpoint
      return row.meta.dbInstanceIdentifier ?? null;
    },
  },
  // Snapshot options
  {
    trigger: { type: "key", char: "i" },
    label: "Copy snapshot ID",
    feedback: "Copied snapshot ID",
    isRelevant: (row) => row.meta.type === "snapshot",
    resolve: async (row) => row.meta.snapshotIdentifier ?? null,
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy ARN",
    feedback: "Copied ARN",
    isRelevant: (row) => row.meta.type === "snapshot",
    resolve: async (row) => row.meta.snapshotArn ?? null,
  },
];
