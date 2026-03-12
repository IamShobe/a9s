import { z } from "zod";

export const SFNRowMetaSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("state-machine"),
    stateMachineArn: z.string(),
    stateMachineName: z.string(),
    stateMachineType: z.string(),
  }),
  z.object({
    type: z.literal("execution"),
    executionArn: z.string(),
    stateMachineArn: z.string(),
    stateMachineName: z.string(),
    status: z.string(),
  }),
]);
