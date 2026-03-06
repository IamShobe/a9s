import { z } from "zod";

export const Route53RowMetaSchema = z.object({
  type: z.enum(["zone", "record"]),
  zoneId: z.string().optional(),
  zoneName: z.string().optional(),
  isPrivate: z.boolean().optional(),
  recordName: z.string().optional(),
  recordType: z.string().optional(),
  recordTtl: z.number().optional(),
  recordValues: z.array(z.string()).optional(),
  recordAliasTarget: z
    .object({
      HostedZoneId: z.string(),
      DNSName: z.string(),
      EvaluateTargetHealth: z.boolean(),
    })
    .optional(),
});
