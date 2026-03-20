import { z } from "zod";

export const SQSRowMetaSchema = z.object({
  type: z.enum(["queue", "message"]),
  queueUrl: z.string().optional(),
  queueArn: z.string().optional(),
  queueName: z.string().optional(),
  isFifo: z.boolean().optional(),
  messageId: z.string().optional(),
  receiptHandle: z.string().optional(),
  messageBody: z.string().optional(),
});

export type SQSRowMetaFlat = z.infer<typeof SQSRowMetaSchema>;
