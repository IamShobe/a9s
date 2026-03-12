import { z } from "zod";

export const SNSRowMetaSchema = z.object({
  type: z.enum(["topic", "subscription"]),
  topicArn: z.string().optional(),
  topicName: z.string().optional(),
  subscriptionArn: z.string().optional(),
  protocol: z.string().optional(),
  endpoint: z.string().optional(),
});

export type SNSRowMetaFlat = z.infer<typeof SNSRowMetaSchema>;
