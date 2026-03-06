import type { TableRow } from "../../../types.js";
import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { S3RowMetaSchema } from "../schema.js";
import { s3YankOptions } from "./yankOptions.js";
import type { S3Level } from "../adapter.js";

export interface S3YankCtx {
  getLevel(): S3Level;
  getDetails(row: TableRow): Promise<{ label: string; value: string }[]>;
}

export function createS3YankCapability(ctx: S3YankCtx): YankCapability {
  return createYankCapability(s3YankOptions, S3RowMetaSchema, ctx);
}
