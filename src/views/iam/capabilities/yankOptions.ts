import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import type { IamRowMeta } from "../schema.js";

export const iamYankOptions: YankOptionDef<IamRowMeta>[] = [
  {
    trigger: { type: "key", char: "a" },
    label: "copy arn",
    feedback: "Copied ARN",
    isRelevant: (row) =>
      row.meta.type === "role" || row.meta.type === "managed-policy",
    resolve: async (row) => {
      if (row.meta.type === "role") return row.meta.arn;
      if (row.meta.type === "managed-policy") return row.meta.policyArn;
      return null;
    },
  },
];
