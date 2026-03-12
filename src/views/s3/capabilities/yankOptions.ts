import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import type { S3RowMeta } from "../schema.js";
import type { S3YankCtx } from "./yankCapability.js";

const isS3Navigable = (row: { meta: S3RowMeta }) =>
  row.meta.type === "bucket" || row.meta.type === "folder" || row.meta.type === "object";

export const s3YankOptions: YankOptionDef<S3RowMeta, S3YankCtx>[] = [
  {
    trigger: { type: "key", char: "p" },
    label: "copy path (s3://)",
    feedback: "Copied Path",
    headerKey: "name",
    isRelevant: isS3Navigable,
    resolve: async (row, ctx) => {
      const level = ctx.getLevel();
      const bucket = level.kind === "objects" ? level.bucket : row.id;
      if (row.meta.type === "bucket") return `s3://${row.id}`;
      return `s3://${bucket}/${row.meta.key}`;
    },
  },
  {
    trigger: { type: "key", char: "k" },
    label: "copy key (from bucket root)",
    feedback: "Copied Key",
    headerKey: "name",
    isRelevant: (row) => row.meta.type === "folder" || row.meta.type === "object",
    resolve: async (row) =>
      row.meta.type !== "bucket" ? row.meta.key : null,
  },
  {
    trigger: { type: "key", char: "a" },
    label: "copy arn",
    feedback: "Copied ARN",
    headerKey: "name",
    isRelevant: isS3Navigable,
    resolve: async (row, ctx) => {
      const level = ctx.getLevel();
      const bucket = level.kind === "objects" ? level.bucket : row.id;
      if (row.meta.type === "bucket") return `arn:aws:s3:::${row.id}`;
      return `arn:aws:s3:::${bucket}/${row.meta.key}`;
    },
  },
  {
    trigger: { type: "key", char: "e" },
    label: "copy etag",
    feedback: "Copied ETag",
    headerKey: "name",
    isRelevant: (row) => row.meta.type === "object",
    resolve: async (row, ctx) => {
      const fields = await ctx.getDetails(row);
      const etag = fields.find((f) => f.label === "ETag")?.value ?? "";
      return etag && etag !== "-" ? etag : null;
    },
  },
  {
    trigger: { type: "key", char: "d" },
    label: "copy last-modified",
    feedback: "Copied Last Modified",
    headerKey: "lastModified",
    isRelevant: (row) => row.meta.type === "object",
    resolve: async (row, ctx) => {
      const fields = await ctx.getDetails(row);
      const lastModified = fields.find((f) => f.label === "Last Modified")?.value ?? "";
      return lastModified && lastModified !== "-" ? lastModified : null;
    },
  },
];
