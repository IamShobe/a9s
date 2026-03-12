import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { SSMRowMetaSchema } from "../schema.js";
import { runAwsJsonAsync } from "../../../utils/aws.js";

type SSMMeta = z.infer<typeof SSMRowMetaSchema>;

interface SSMCtx { regionArgs: string[] }

export function buildSSMYankOptions(regionArgs: string[]): YankOptionDef<SSMMeta, SSMCtx>[] {
  return [
    {
      trigger: { type: "key", char: "n" },
      label: "Copy parameter name",
      feedback: "Copied parameter name",
      isRelevant: (row) => row.meta.type === "parameter",
      resolve: async (row) => row.meta.parameterName ?? null,
    },
    {
      trigger: { type: "key", char: "a" },
      label: "Copy ARN",
      feedback: "Copied ARN",
      isRelevant: (row) => row.meta.type === "parameter",
      resolve: async (row) => row.meta.parameterArn ?? null,
    },
    {
      trigger: { type: "key", char: "v" },
      label: "Copy value",
      feedback: "Copied value",
      isRelevant: (row) => row.meta.type === "parameter",
      resolve: async (row, ctx) => {
        if (!row.meta.parameterName) return null;
        try {
          const data = await runAwsJsonAsync<{ Parameter: { Value?: string } }>([
            "ssm",
            "get-parameter",
            "--name",
            row.meta.parameterName,
            "--with-decryption",
            ...ctx.regionArgs,
          ]);
          return data.Parameter.Value ?? null;
        } catch {
          return null;
        }
      },
    },
  ];
}
