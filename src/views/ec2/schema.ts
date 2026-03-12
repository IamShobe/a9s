import { z } from "zod";

export const EC2RowMetaSchema = z.object({
  type: z.enum(["instance", "volume"]),
  instanceId: z.string().optional(),
  instanceName: z.string().optional(),
  state: z.string().optional(),
  publicIp: z.string().optional(),
  privateIp: z.string().optional(),
  volumeId: z.string().optional(),
});

export type EC2RowMetaFlat = z.infer<typeof EC2RowMetaSchema>;
