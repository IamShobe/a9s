import { z } from "zod";

export const Route53RowMetaSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("zone"),
    zoneId: z.string(),
    zoneName: z.string(),
    isPrivate: z.boolean(),
  }),
  z.object({
    type: z.literal("record"),
    zoneId: z.string(),
    zoneName: z.string(),
    recordName: z.string(),
    recordType: z.string(),
    recordTtl: z.number().optional(),
    recordValues: z.array(z.string()),
    recordAliasTarget: z
      .object({
        HostedZoneId: z.string(),
        DNSName: z.string(),
        EvaluateTargetHealth: z.boolean(),
      })
      .optional(),
  }),
]);
