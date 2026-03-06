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
      return row.meta.tableName ?? null;
    },
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy table ARN",
    feedback: "Copied table ARN",
    isRelevant: (row) => row.meta.type === "table",
    resolve: async (row) => {
      return row.meta.tableArn ?? null;
    },
  },

  // Item options
  {
    trigger: { type: "key", char: "k" },
    label: "Copy primary key (JSON)",
    feedback: "Copied primary key",
    isRelevant: (row) => row.meta.type === "item",
    resolve: async (row) => {
      if (!row.meta.itemPkValue && !row.meta.itemSkValue) {
        return null;
      }

      const obj: Record<string, string> = {};
      if (row.meta.itemPkValue) {
        obj.pk = row.meta.itemPkValue;
      }
      if (row.meta.itemSkValue) {
        obj.sk = row.meta.itemSkValue;
      }

      return JSON.stringify(obj);
    },
  },
  {
    trigger: { type: "key", char: "j" },
    label: "Copy entire item (JSON)",
    feedback: "Copied item",
    isRelevant: (row) => row.meta.type === "item" && !!row.meta.itemJson,
    resolve: async (row) => {
      return row.meta.itemJson ?? null;
    },
  },

  // Field options
  {
    trigger: { type: "key", char: "v" },
    label: "Copy attribute value",
    feedback: "Copied attribute value",
    isRelevant: (row) => row.meta.type === "item-field",
    resolve: async (row) => {
      return row.meta.fieldValue ?? null;
    },
  },
  {
    trigger: { type: "key", char: "k" },
    label: "Copy attribute name",
    feedback: "Copied attribute name",
    isRelevant: (row) => row.meta.type === "item-field",
    resolve: async (row) => {
      return row.meta.fieldName ?? null;
    },
  },
];
