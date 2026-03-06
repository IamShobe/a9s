import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync } from "../../../utils/aws.js";
import type {
  AwsDynamoDBTableDescription,
  DynamoDBLevel,
  DynamoDBRowMeta,
} from "../types.js";
import { formatBillingMode, formatKeySchema, unwrapDynamoValue } from "../utils.js";

export function createDynamoDBDetailCapability(
  region?: string,
  getLevel?: () => DynamoDBLevel,
): DetailCapability {
  const regionArgs = region ? ["--region", region] : [];

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as DynamoDBRowMeta | undefined;
    if (!meta) {
      return [];
    }

    const level = getLevel?.();

    // Table level
    if (level?.kind === "tables" && meta.type === "table") {
      try {
        const data = await runAwsJsonAsync<{ Table: AwsDynamoDBTableDescription }>([
          "dynamodb",
          "describe-table",
          "--table-name",
          meta.tableName!,
          ...regionArgs,
        ]);

        const table = data.Table;

        const fields: DetailField[] = [
          { label: "Table Name", value: table.TableName },
          { label: "Table ARN", value: table.TableArn },
          { label: "Status", value: table.TableStatus },
          { label: "Billing Mode", value: formatBillingMode(table) },
          { label: "Item Count", value: String(table.ItemCount ?? 0) },
          { label: "Table Size", value: `${table.TableSizeBytes ?? 0} bytes` },
          { label: "Key Schema", value: formatKeySchema(table) },
        ];

        // Add attributes
        if (table.AttributeDefinitions && table.AttributeDefinitions.length > 0) {
          const attrs = table.AttributeDefinitions.map((a) => `${a.AttributeName} (${a.AttributeType})`).join(", ");
          fields.push({ label: "Attributes", value: attrs });
        }

        fields.push({
          label: "GSI Count",
          value: String(table.GlobalSecondaryIndexes?.length ?? 0),
        });

        fields.push({
          label: "LSI Count",
          value: String(table.LocalSecondaryIndexes?.length ?? 0),
        });

        if (table.CreationDateTime) {
          fields.push({
            label: "Created",
            value: new Date(table.CreationDateTime).toISOString(),
          });
        }

        return fields;
      } catch {
        return [];
      }
    }

    // Item level
    if (level?.kind === "items" && meta.type === "item") {
      try {
        const itemJson = meta.itemJson ? JSON.parse(meta.itemJson) : {};
        const prettyJson = JSON.stringify(itemJson, null, 2);

        const fields: DetailField[] = [
          {
            label: "Item (JSON)",
            value: prettyJson,
          },
        ];

        if (meta.itemSize) {
          fields.push({
            label: "Size",
            value: `${meta.itemSize} bytes`,
          });
        }

        return fields;
      } catch {
        return [];
      }
    }

    // Item-field level
    if (level?.kind === "item-fields" && meta.type === "item-field") {
      const fields: DetailField[] = [
        { label: "Attribute", value: meta.fieldName ?? "-" },
        { label: "Type", value: meta.fieldType ?? "-" },
        {
          label: "Value",
          value: String(meta.fieldRawValue ?? "-"),
        },
      ];

      return fields;
    }

    return [];
  };

  return { getDetails };
}
