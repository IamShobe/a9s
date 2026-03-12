import { z } from "zod";

export const RDSRowMetaSchema = z.object({
  type: z.enum(["instance", "snapshot"]),
  dbInstanceIdentifier: z.string().optional(),
  dbInstanceArn: z.string().optional(),
  engine: z.string().optional(),
  engineVersion: z.string().optional(),
  dbInstanceClass: z.string().optional(),
  status: z.string().optional(),
  multiAZ: z.boolean().optional(),
  snapshotIdentifier: z.string().optional(),
  snapshotArn: z.string().optional(),
  snapshotType: z.string().optional(),
});

export type RDSRowMetaFlat = z.infer<typeof RDSRowMetaSchema>;
