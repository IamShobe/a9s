import { z } from "zod";

export const VPCRowMetaSchema = z.object({
  type: z.enum(["vpc", "security-group", "rule"]),
  vpcId: z.string().optional(),
  vpcName: z.string().optional(),
  cidr: z.string().optional(),
  sgId: z.string().optional(),
  sgName: z.string().optional(),
  direction: z.enum(["inbound", "outbound"]).optional(),
  protocol: z.string().optional(),
  portRange: z.string().optional(),
  sourceDest: z.string().optional(),
});

export type VPCRowMetaFlat = z.infer<typeof VPCRowMetaSchema>;
