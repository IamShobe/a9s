import { z } from "zod";

export const CloudWatchRowMetaSchema = z.object({
  type: z.enum(["log-group", "log-stream", "log-event"]),
  logGroupName: z.string().optional(),
  logGroupArn: z.string().optional(),
  logStreamName: z.string().optional(),
  message: z.string().optional(),
  timestamp: z.string().optional(),
});

export type CloudWatchRowMetaFlat = z.infer<typeof CloudWatchRowMetaSchema>;
