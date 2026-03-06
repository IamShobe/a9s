import { z } from "zod";

export const IamRowMetaSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("menu"), kind: z.string(), roleName: z.string().optional() }),
  z.object({ type: z.literal("role"), roleName: z.string(), arn: z.string() }),
  z.object({ type: z.literal("inline-policy"), roleName: z.string(), policyName: z.string() }),
  z.object({ type: z.literal("managed-policy"), policyArn: z.string(), policyName: z.string() }),
]);

export type IamRowMeta = z.infer<typeof IamRowMetaSchema>;
