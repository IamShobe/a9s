import { z } from "zod";

export const ELBRowMetaSchema = z.object({
  type: z.enum(["load-balancer", "target-group", "target"]),
  lbArn: z.string().optional(),
  lbName: z.string().optional(),
  lbType: z.string().optional(),
  dnsName: z.string().optional(),
  scheme: z.string().optional(),
  tgArn: z.string().optional(),
  tgName: z.string().optional(),
  targetId: z.string().optional(),
  health: z.string().optional(),
});

export type ELBRowMetaFlat = z.infer<typeof ELBRowMetaSchema>;
