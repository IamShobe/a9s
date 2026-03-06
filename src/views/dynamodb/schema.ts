import { z } from "zod";

export const DynamoDBRowMetaSchema = z.object({
  type: z.enum(["table", "item", "item-field"]),
  tableName: z.string().optional(),
  tableStatus: z.string().optional(),
  tableArn: z.string().optional(),
  billing: z.string().optional(),
  gsiCount: z.number().optional(),
  itemIndex: z.number().optional(),
  itemPkValue: z.string().optional(),
  itemSkValue: z.string().optional(),
  itemSize: z.number().optional(),
  itemJson: z.string().optional(),
  fieldName: z.string().optional(),
  fieldValue: z.string().optional(),
  fieldType: z.string().optional(),
  fieldRawValue: z.unknown().optional(),
});
