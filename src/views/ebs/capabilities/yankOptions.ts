import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { EBSRowMetaSchema } from "../schema.js";

type EBSMeta = z.infer<typeof EBSRowMetaSchema>;

export const EBSYankOptions: YankOptionDef<EBSMeta, Record<string, never>>[] = [
  // Volume options
  {
    trigger: { type: "key", char: "i" },
    label: "Copy volume ID",
    feedback: "Copied volume ID",
    isRelevant: (row) => row.meta.type === "volume",
    resolve: async (row) => row.meta.volumeId ?? null,
  },
  {
    trigger: { type: "key", char: "s" },
    label: "Copy state",
    feedback: "Copied state",
    isRelevant: (row) => row.meta.type === "volume",
    resolve: async (row) => row.meta.state ?? null,
  },
  // Snapshot options
  {
    trigger: { type: "key", char: "i" },
    label: "Copy snapshot ID",
    feedback: "Copied snapshot ID",
    isRelevant: (row) => row.meta.type === "snapshot",
    resolve: async (row) => row.meta.snapshotId ?? null,
  },
  {
    trigger: { type: "key", char: "v" },
    label: "Copy volume ID",
    feedback: "Copied volume ID",
    isRelevant: (row) => row.meta.type === "snapshot",
    resolve: async (row) => row.meta.volumeId ?? null,
  },
];
