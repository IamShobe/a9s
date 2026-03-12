import { z } from "zod";

export const CloudFormationRowMetaSchema = z.object({
  type: z.enum(["stack", "resource"]),
  stackName: z.string().optional(),
  stackId: z.string().optional(),
  stackStatus: z.string().optional(),
  creationTime: z.string().optional(),
  logicalResourceId: z.string().optional(),
  physicalResourceId: z.string().optional(),
  resourceType: z.string().optional(),
  resourceStatus: z.string().optional(),
});

export type CloudFormationRowMetaFlat = z.infer<typeof CloudFormationRowMetaSchema>;
