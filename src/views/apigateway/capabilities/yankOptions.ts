import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { ApiGatewayRowMetaSchema } from "../schema.js";

type ApiGatewayMeta = z.infer<typeof ApiGatewayRowMetaSchema>;

export const ApiGatewayYankOptions: YankOptionDef<ApiGatewayMeta, Record<string, never>>[] = [
  // API options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy API name",
    feedback: "Copied API name",
    isRelevant: (row) => row.meta.type === "api",
    resolve: async (row) => row.meta.apiName ?? null,
  },
  {
    trigger: { type: "key", char: "i" },
    label: "Copy API ID",
    feedback: "Copied API ID",
    isRelevant: (row) => row.meta.type === "api",
    resolve: async (row) => row.meta.apiId ?? null,
  },
  // Stage options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy stage name",
    feedback: "Copied stage name",
    isRelevant: (row) => row.meta.type === "stage",
    resolve: async (row) => row.meta.stageName ?? null,
  },
  {
    trigger: { type: "key", char: "u" },
    label: "Copy invoke URL",
    feedback: "Copied invoke URL",
    isRelevant: (row) => row.meta.type === "stage",
    resolve: async (row) => row.meta.invokeUrl ?? null,
  },
  // Resource options
  {
    trigger: { type: "key", char: "p" },
    label: "Copy resource path",
    feedback: "Copied resource path",
    isRelevant: (row) => row.meta.type === "resource",
    resolve: async (row) => row.meta.resourcePath ?? null,
  },
  {
    trigger: { type: "key", char: "i" },
    label: "Copy resource ID",
    feedback: "Copied resource ID",
    isRelevant: (row) => row.meta.type === "resource",
    resolve: async (row) => row.meta.resourceId ?? null,
  },
];
