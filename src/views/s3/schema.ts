import { z } from "zod";

export const S3RowMetaSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bucket") }),
  z.object({ type: z.literal("folder"), key: z.string() }),
  z.object({ type: z.literal("object"), key: z.string() }),
]);

export type S3RowMeta = z.infer<typeof S3RowMetaSchema>;
