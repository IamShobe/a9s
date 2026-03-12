import { z } from "zod";

export const EventBridgeRowMetaSchema = z.object({
  type: z.enum(["bus", "rule"]),
  busName: z.string().optional(),
  busArn: z.string().optional(),
  ruleName: z.string().optional(),
  ruleArn: z.string().optional(),
  state: z.string().optional(),
  schedule: z.string().optional(),
  eventPattern: z.string().optional(),
});

export type EventBridgeRowMetaFlat = z.infer<typeof EventBridgeRowMetaSchema>;
