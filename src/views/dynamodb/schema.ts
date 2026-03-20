import { z } from "zod";

export const DynamoDBRowMetaSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("table"),
    tableName: z.string(),
    tableStatus: z.string(),
    tableArn: z.string(),
    billing: z.string(),
    gsiCount: z.number(),
  }),
  z.object({
    type: z.literal("item"),
    tableName: z.string(),
    itemIndex: z.number(),
    itemPkValue: z.string().optional(),
    itemSkValue: z.string().optional(),
    itemSize: z.number(),
    itemJson: z.string(),
  }),
  z.object({
    type: z.literal("item-field"),
    tableName: z.string(),
    itemIndex: z.number(),
    fieldName: z.string(),
    fieldValue: z.string(),
    fieldValueFull: z.string(),
    fieldType: z.string(),
    fieldRawValue: z.unknown().optional(),
  }),
]);
