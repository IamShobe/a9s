import { z } from "zod";

export const SSMRowMetaSchema = z.object({
  type: z.enum(["parameter", "history"]),
  parameterName: z.string().optional(),
  parameterType: z.string().optional(),
  parameterArn: z.string().optional(),
  version: z.number().optional(),
});

export type SSMRowMetaFlat = z.infer<typeof SSMRowMetaSchema>;
