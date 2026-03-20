import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { DynamoDBRowMetaSchema } from "../schema.js";

export const DynamoDBYankOptions: YankOptionDef<
  z.infer<typeof DynamoDBRowMetaSchema>,
  Record<string, never>
>[] = [
  // Table options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy table name",
    feedback: "Copied table name",
    isRelevant: (row) => row.meta.type === "table",
    resolve: async (row) => {
      if (row.meta.type !== "table") return null;
      return row.meta.tableName;
    },
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy table ARN",
    feedback: "Copied table ARN",
    isRelevant: (row) => row.meta.type === "table",
    resolve: async (row) => {
      if (row.meta.type !== "table") return null;
      return row.meta.tableArn;
    },
  },

  // Item options
  {
    trigger: { type: "key", char: "k" },
    label: "Copy primary key (JSON)",
    feedback: "Copied primary key",
    isRelevant: (row) => row.meta.type === "item",
    resolve: async (row) => {
      if (row.meta.type !== "item") return null;
      const { itemPkValue, itemSkValue } = row.meta;
      if (!itemPkValue && !itemSkValue) return null;
      const obj: Record<string, string> = {};
      if (itemPkValue) obj.pk = itemPkValue;
      if (itemSkValue) obj.sk = itemSkValue;
      return JSON.stringify(obj);
    },
  },
  {
    trigger: { type: "key", char: "j" },
    label: "Copy entire item (JSON)",
    feedback: "Copied item",
    isRelevant: (row) => row.meta.type === "item",
    resolve: async (row) => {
      if (row.meta.type !== "item") return null;
      return row.meta.itemJson;
    },
  },

  // Field options
  {
    trigger: { type: "key", char: "v" },
    label: "Copy attribute value",
    feedback: "Copied attribute value",
    isRelevant: (row) => row.meta.type === "item-field",
    resolve: async (row) => {
      if (row.meta.type !== "item-field") return null;
      return row.meta.fieldValueFull;
    },
  },
  {
    trigger: { type: "key", char: "n" },
    label: "Copy attribute name",
    feedback: "Copied attribute name",
    isRelevant: (row) => row.meta.type === "item-field",
    resolve: async (row) => {
      if (row.meta.type !== "item-field") return null;
      return row.meta.fieldName;
    },
  },
];
