import { z } from "zod";

export const ECRRowMetaSchema = z.object({
  type: z.enum(["repository", "image"]),
  repositoryName: z.string().optional(),
  repositoryUri: z.string().optional(),
  repositoryArn: z.string().optional(),
  imageDigest: z.string().optional(),
  imageTag: z.string().optional(),
});

export type ECRRowMetaFlat = z.infer<typeof ECRRowMetaSchema>;
