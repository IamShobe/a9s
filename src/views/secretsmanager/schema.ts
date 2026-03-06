import { z } from "zod";

// Strict schemas for each row type
export const SecretMetaSchema = z.object({
  type: z.literal("secret"),
  name: z.string(),
  arn: z.string(),
  description: z.string().optional(),
});

export const SecretFieldMetaSchema = z.object({
  type: z.literal("secret-field"),
  key: z.string(),
  value: z.string(),
  secretArn: z.string(),
  secretName: z.string(),
});

// Union schema for validation
export const SecretRowMetaUnionSchema = z.union([SecretMetaSchema, SecretFieldMetaSchema]);

// Flat schema for use with yank capability
export const SecretRowMetaSchema = z.object({
  type: z.enum(["secret", "secret-field"]),
  name: z.string().optional(),
  arn: z.string().optional(),
  description: z.string().optional(),
  key: z.string().optional(),
  value: z.string().optional(),
  secretArn: z.string().optional(),
  secretName: z.string().optional(),
});

export type SecretMeta = z.infer<typeof SecretMetaSchema>;
export type SecretFieldMeta = z.infer<typeof SecretFieldMetaSchema>;
export type SecretRowMeta = z.infer<typeof SecretRowMetaSchema>;
