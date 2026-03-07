import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../utils/aws.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { atom } from "jotai";
import { getDefaultStore } from "jotai";
import type {
  AwsDynamoDBTableDescription,
  DynamoDBItem,
  DynamoDBLevel,
  DynamoDBRowMeta,
} from "./types.js";
import {
  unwrapDynamoValue,
  formatBillingMode,
  formatKeySchema,
  formatDynamoValue,
  getDynamoType,
  extractPkValue,
  extractSkValue,
  extractPrimaryKeyJson,
} from "./utils.js";
import { createDynamoDBDetailCapability } from "./capabilities/detailCapability.js";
import { createDynamoDBYankCapability } from "./capabilities/yankCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";

interface DynamoDBNavFrame extends NavFrame {
  level: DynamoDBLevel;
}

export const dynamoDBLevelAtom = atom<DynamoDBLevel>({ kind: "tables" });
export const dynamoDBBackStackAtom = atom<DynamoDBNavFrame[]>([]);

// Cache for table descriptions to avoid repeated AWS calls
const tableDescriptionCache = new Map<string, AwsDynamoDBTableDescription>();
// Cache for scanned items
const itemsCache = new Map<string, { items: DynamoDBItem[]; table: AwsDynamoDBTableDescription }>();

export function createDynamoDBServiceAdapter(
  endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = buildRegionArgs(region);

  const getLevel = () => store.get(dynamoDBLevelAtom);
  const setLevel = (level: DynamoDBLevel) => store.set(dynamoDBLevelAtom, level);
  const getBackStack = () => store.get(dynamoDBBackStackAtom);
  const setBackStack = (stack: DynamoDBNavFrame[]) => store.set(dynamoDBBackStackAtom, stack);

  const getTableDescription = async (tableName: string): Promise<AwsDynamoDBTableDescription | null> => {
    const cached = tableDescriptionCache.get(tableName);
    if (cached) return cached;

    try {
      const data = await runAwsJsonAsync<{ Table: AwsDynamoDBTableDescription }>([
        "dynamodb",
        "describe-table",
        "--table-name",
        tableName,
        ...regionArgs,
      ]);
      const table = data.Table;
      tableDescriptionCache.set(tableName, table);
      return table;
    } catch (e) {
      debugLog("dynamodb", `getTableDescription failed for ${tableName}`, e);
      return null;
    }
  };

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();

    if (level.kind === "tables") {
      return [
        { key: "name", label: "Name" },
        { key: "status", label: "Status", width: 12 },
        { key: "items", label: "Items", width: 10 },
        { key: "billing", label: "Billing", width: 25 },
        { key: "gsis", label: "GSIs", width: 6 },
      ];
    }

    if (level.kind === "items") {
      const table = tableDescriptionCache.get(level.tableName);
      if (!table) {
        // Fallback: return standard columns that will always be populated
        return [
          { key: "#", label: "#", width: 4 },
          { key: "pk", label: "PK", width: 20 },
          { key: "sk", label: "SK", width: 20 },
          { key: "size", label: "Size", width: 10 },
        ];
      }

      const keys = table.KeySchema ?? [];
      const hashKey = keys.find((k) => k.KeyType === "HASH");
      const rangeKey = keys.find((k) => k.KeyType === "RANGE");

      const cols: ColumnDef[] = [{ key: "#", label: "#", width: 4 }];
      if (hashKey) {
        cols.push({ key: "pk", label: hashKey.AttributeName, width: 20 });
      }
      if (rangeKey) {
        cols.push({ key: "sk", label: rangeKey.AttributeName, width: 20 });
      }
      cols.push({ key: "size", label: "Size", width: 10 });
      return cols;
    }

    // item-fields level
    return [
      { key: "attribute", label: "Attribute" },
      { key: "value", label: "Value", width: 50 },
      { key: "type", label: "Type", width: 8 },
    ];
  };

  function dynamoItemsToRows(
    items: DynamoDBItem[],
    table: AwsDynamoDBTableDescription,
    tableName: string,
  ): TableRow[] {
    return items.map((item, index) => {
      const pkValue = extractPkValue(item, table);
      const skValue = extractSkValue(item, table);
      const itemSize = JSON.stringify(item).length;

      const cells: Record<string, ReturnType<typeof textCell>> = {
        name: textCell(`Item ${index + 1}`),
        "#": textCell(String(index + 1)),
        pk: textCell(pkValue ?? "-"),
        sk: textCell(skValue ?? "-"),
        size: textCell(`${itemSize}B`),
      };

      return {
        id: pkValue && skValue
          ? `${tableName}-pk:${pkValue}-sk:${skValue}`
          : pkValue
            ? `${tableName}-pk:${pkValue}`
            : `${tableName}-idx:${index}`,
        cells,
        meta: {
          type: "item",
          tableName,
          itemIndex: index,
          itemPkValue: pkValue ?? undefined,
          itemSkValue: skValue ?? undefined,
          itemSize,
          itemJson: JSON.stringify(item),
        } satisfies DynamoDBRowMeta,
      };
    });
  }

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "tables") {
      try {
        const listData = await runAwsJsonAsync<{ TableNames: string[] }>([
          "dynamodb",
          "list-tables",
          ...regionArgs,
        ]);

        const tableNames = listData.TableNames ?? [];

        // Describe all tables in parallel
        const tables = await Promise.all(
          tableNames.map((name) => getTableDescription(name)),
        );

        return tables
          .filter((t) => t !== null)
          .map((table) => {
            return {
              id: table.TableArn,
              cells: {
                name: textCell(table.TableName),
                status: textCell(table.TableStatus),
                items: textCell(String(table.ItemCount ?? 0)),
                billing: textCell(formatBillingMode(table)),
                gsis: textCell(String(table.GlobalSecondaryIndexes?.length ?? 0)),
              },
              meta: {
                type: "table",
                tableName: table.TableName,
                tableStatus: table.TableStatus,
                tableArn: table.TableArn,
                billing: formatBillingMode(table),
                gsiCount: table.GlobalSecondaryIndexes?.length ?? 0,
              } satisfies DynamoDBRowMeta,
            };
          });
      } catch (e) {
        debugLog("dynamodb", "getRows (tables) failed", e);
        return [];
      }
    }

    if (level.kind === "items") {
      const { tableName } = level;

      try {
        // Check cache
        const cached = itemsCache.get(tableName);
        if (cached) {
          return dynamoItemsToRows(cached.items, cached.table, tableName);
        }

        // Fetch table description to get key schema
        const table = await getTableDescription(tableName);
        if (!table) return [];

        // Scan items
        const scanData = await runAwsJsonAsync<{
          Items: DynamoDBItem[];
          Count: number;
          ScannedCount: number;
        }>([
          "dynamodb",
          "scan",
          "--table-name",
          tableName,
          "--limit",
          "50",
          ...regionArgs,
        ]);

        const items = scanData.Items ?? [];
        itemsCache.set(tableName, { items, table });
        return dynamoItemsToRows(items, table, tableName);
      } catch (e) {
        debugLog("dynamodb", `getRows (items) failed for ${tableName}`, e);
        return [];
      }
    }

    // item-fields level
    if (level.kind === "item-fields") {
      const { tableName, itemIndex } = level;
      const cached = itemsCache.get(tableName);
      if (!cached) return [];

      const item = cached.items[itemIndex];
      if (!item) return [];

      return Object.entries(item).map(([attrName, attrValue]) => {
        const displayValue = formatDynamoValue(attrValue);
        const type = getDynamoType(attrValue);

        return {
          id: attrName,
          cells: {
            attribute: textCell(attrName),
            value: textCell(displayValue),
            type: textCell(type),
          },
          meta: {
            type: "item-field",
            tableName,
            itemIndex,
            fieldName: attrName,
            fieldValue: displayValue,
            fieldType: type,
            fieldRawValue: unwrapDynamoValue(attrValue),
          } satisfies DynamoDBRowMeta,
        };
      });
    }

    return [];
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as DynamoDBRowMeta | undefined;

    if (level.kind === "tables") {
      if (!meta || meta.type !== "table") {
        return { action: "none" };
      }

      // Clear items cache when switching tables
      itemsCache.clear();

      const newStack = [...backStack, { level: level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "items",
        tableName: meta.tableName!,
      });
      return { action: "navigate" };
    }

    if (level.kind === "items") {
      if (!meta || meta.type !== "item") {
        return { action: "none" };
      }

      const newStack = [...backStack, { level: level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "item-fields",
        tableName: meta.tableName!,
        itemIndex: meta.itemIndex!,
      });
      return { action: "navigate" };
    }

    // item-fields level: leaf, no drill-down
    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "tables") return "dynamodb://";
    if (level.kind === "items") return `dynamodb://${level.tableName}`;
    return `dynamodb://${level.tableName}/items`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "tables") return "⚡ Tables";
    if (level.kind === "items") return `⚡ ${level.tableName}`;
    return `⚡ ${level.tableName}/items`;
  };

  // Compose capabilities
  const detailCapability = createDynamoDBDetailCapability(region, getLevel);
  const yankCapability = createDynamoDBYankCapability();

  return {
    id: "dynamodb",
    label: "DynamoDB",
    hudColor: SERVICE_COLORS.dynamodb,
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    reset() {
      setLevel({ kind: "tables" });
      setBackStack([]);
      tableDescriptionCache.clear();
      itemsCache.clear();
    },
    capabilities: {
      detail: detailCapability,
      yank: yankCapability,
    },
  };
}
