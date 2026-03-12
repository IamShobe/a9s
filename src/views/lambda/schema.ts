import { z } from "zod";

export const LambdaRowMetaSchema = z.object({
  type: z.enum(["function", "version"]),
  functionName: z.string().optional(),
  functionArn: z.string().optional(),
  runtime: z.string().optional(),
  version: z.string().optional(),
});

export type LambdaRowMetaFlat = z.infer<typeof LambdaRowMetaSchema>;
