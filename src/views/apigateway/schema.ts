import { z } from "zod";

export const ApiGatewayRowMetaSchema = z.object({
  type: z.enum(["api", "stage", "resource"]),
  apiId: z.string().optional(),
  apiName: z.string().optional(),
  protocol: z.string().optional(),
  stageName: z.string().optional(),
  invokeUrl: z.string().optional(),
  resourceId: z.string().optional(),
  resourcePath: z.string().optional(),
  httpMethod: z.string().optional(),
});

export type ApiGatewayRowMetaFlat = z.infer<typeof ApiGatewayRowMetaSchema>;
