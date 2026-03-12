import { z } from "zod";

export const ECSRowMetaSchema = z.object({
  type: z.enum(["cluster", "service", "task"]),
  clusterArn: z.string().optional(),
  clusterName: z.string().optional(),
  serviceArn: z.string().optional(),
  serviceName: z.string().optional(),
  taskArn: z.string().optional(),
  taskId: z.string().optional(),
});

export type ECSRowMetaFlat = z.infer<typeof ECSRowMetaSchema>;
