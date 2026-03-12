import { z } from "zod";

export const EBSRowMetaSchema = z.object({
  type: z.enum(["volume", "snapshot"]),
  volumeId: z.string().optional(),
  state: z.string().optional(),
  attachedInstanceId: z.string().optional(),
  snapshotId: z.string().optional(),
});

export type EBSRowMetaFlat = z.infer<typeof EBSRowMetaSchema>;
