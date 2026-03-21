import { z } from "zod";

export const CloudFrontRowMetaSchema = z.object({
  type: z.enum(["distribution", "invalidation"]),
  distributionId: z.string().optional(),
  domainName: z.string().optional(),
  arn: z.string().optional(),
  status: z.string().optional(),
  enabled: z.boolean().optional(),
  comment: z.string().optional(),
  priceClass: z.string().optional(),
  invalidationId: z.string().optional(),
  createdAt: z.string().optional(),
});

export type CloudFrontRowMetaFlat = z.infer<typeof CloudFrontRowMetaSchema>;
