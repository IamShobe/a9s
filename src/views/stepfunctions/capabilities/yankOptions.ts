import type { YankOptionDef, ParsedRow } from "../../../adapters/capabilities/YankCapability.js";
import { z } from "zod";
import { SFNRowMetaSchema } from "../schema.js";

type SFNMeta = z.infer<typeof SFNRowMetaSchema>;

export const SFNYankOptions: YankOptionDef<SFNMeta, Record<string, never>>[] = [
  {
    trigger: { type: "key", char: "a" },
    label: "copy ARN",
    feedback: "Copied ARN",
    isRelevant: () => true,
    resolve: async (row: ParsedRow<SFNMeta>) => {
      if (row.meta.type === "state-machine") return row.meta.stateMachineArn;
      if (row.meta.type === "execution") return row.meta.executionArn;
      return null;
    },
  },
  {
    trigger: { type: "key", char: "n" },
    label: "copy name",
    feedback: "Copied name",
    isRelevant: (row: ParsedRow<SFNMeta>) => row.meta.type === "state-machine",
    resolve: async (row: ParsedRow<SFNMeta>) => {
      if (row.meta.type === "state-machine") return row.meta.stateMachineName;
      return null;
    },
  },
];
