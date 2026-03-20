import type {
  DynamoDBAttributeValue,
  DynamoDBItem,
  AwsDynamoDBTableDescription,
} from "./types.js";

/**
 * Unwrap a DynamoDB AttributeValue to its native JS value.
 * E.g., { S: "hello" } → "hello", { N: "42" } → "42", { BOOL: true } → true
 */
export function unwrapDynamoValue(attr: DynamoDBAttributeValue): unknown {
  const key = Object.keys(attr)[0] as keyof DynamoDBAttributeValue;
  const value = attr[key] as unknown;

  switch (key) {
    case "S":
      return value;
    case "N":
      return value;
    case "B":
      return value;
    case "SS":
      return value;
    case "NS":
      return value;
    case "BS":
      return value;
    case "M": {
      const mapVal = value as Record<string, DynamoDBAttributeValue>;
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(mapVal)) {
        obj[k] = unwrapDynamoValue(v);
      }
      return obj;
    }
    case "L": {
      const listVal = value as DynamoDBAttributeValue[];
      return listVal.map((v) => unwrapDynamoValue(v));
    }
    case "NULL":
      return null;
    case "BOOL":
      return value;
    default:
      return undefined;
  }
}

/**
 * Get the DynamoDB type descriptor for an attribute value.
 * Returns the single-letter type: S, N, B, SS, NS, BS, M, L, NULL, BOOL
 */
export function getDynamoType(attr: DynamoDBAttributeValue): string {
  const key = Object.keys(attr)[0];
  return key || "?";
}

/**
 * Format a DynamoDB value for display.
 * - For simple types (S, N, B, BOOL, NULL), return the value
 * - For collections (SS, NS, BS), return comma-separated or wrapped in []
 * - For maps/lists, return pretty JSON
 * - For large values (>3 lines), truncate to 2 header + ... + 1 footer
 * - For single/few line values, truncate at 50 chars with "..." suffix
 */
export function formatDynamoValue(attr: DynamoDBAttributeValue): string {
  const type = getDynamoType(attr);
  const raw = unwrapDynamoValue(attr);

  const key = Object.keys(attr)[0] as keyof DynamoDBAttributeValue;
  const value = attr[key];

  if (type === "NULL") return "null";
  if (type === "BOOL") return String(value);
  if (type === "N") return String(value);
  if (type === "S") {
    const str = String(value);
    // Escape newlines for display
    const escaped = str.replace(/\n/g, "\\n");
    if (escaped.length > 50) return escaped.slice(0, 47) + "...";
    return escaped;
  }
  if (type === "B") return `<binary: ${(value as string)?.length ?? 0} bytes>`;
  if (type === "SS") {
    return ((value as string[]) ?? []).join(", ");
  }
  if (type === "NS") {
    return ((value as string[]) ?? []).join(", ");
  }
  if (type === "BS") {
    return `<${((value as string[]) ?? []).length} binary values>`;
  }
  if (type === "M") {
    const json = JSON.stringify(raw, null, 2);
    return truncateLargeValue(json);
  }
  if (type === "L") {
    const json = JSON.stringify(raw, null, 2);
    return truncateLargeValue(json);
  }

  return String(raw);
}

function truncateLargeValue(str: string): string {
  const lines = str.split("\n");
  if (lines.length > 3) {
    return `${lines[0]}\n${lines[1]}\n...\n${lines[lines.length - 1]}`;
  }
  // Single or few lines
  const compact = str.replace(/\n/g, " ");
  if (compact.length > 50) return compact.slice(0, 47) + "...";
  return compact;
}

/**
 * Format a DynamoDB value for copying — no truncation.
 */
export function formatDynamoValueForCopy(attr: DynamoDBAttributeValue): string {
  const type = getDynamoType(attr);
  const raw = unwrapDynamoValue(attr);

  const key = Object.keys(attr)[0] as keyof DynamoDBAttributeValue;
  const value = attr[key];

  if (type === "NULL") return "null";
  if (type === "BOOL") return String(value);
  if (type === "N") return String(value);
  if (type === "S") return String(value);
  if (type === "B") return `<binary: ${(value as string)?.length ?? 0} bytes>`;
  if (type === "SS") return ((value as string[]) ?? []).join(", ");
  if (type === "NS") return ((value as string[]) ?? []).join(", ");
  if (type === "BS") return `<${((value as string[]) ?? []).length} binary values>`;
  if (type === "M" || type === "L") return JSON.stringify(raw, null, 2);

  return String(raw);
}

/**
 * Format billing mode: "On-Demand" or "Provisioned (R:X W:Y)"
 */
export function formatBillingMode(table: AwsDynamoDBTableDescription): string {
  const billing = table.BillingModeSummary?.BillingMode;
  if (billing === "PAY_PER_REQUEST") {
    return "On-Demand";
  }
  const r = table.ProvisionedThroughput?.ReadCapacityUnits ?? 0;
  const w = table.ProvisionedThroughput?.WriteCapacityUnits ?? 0;
  return `Provisioned (R:${r} W:${w})`;
}

/**
 * Format key schema: "PK: userId, SK: timestamp" or just "PK: id"
 */
export function formatKeySchema(table: AwsDynamoDBTableDescription): string {
  const keys = table.KeySchema ?? [];
  const hash = keys.find((k) => k.KeyType === "HASH");
  const range = keys.find((k) => k.KeyType === "RANGE");

  let result = "";
  if (hash) result += `PK: ${hash.AttributeName}`;
  if (range) result += (result ? ", " : "") + `SK: ${range.AttributeName}`;
  return result || "-";
}

/**
 * Extract primary key value from an item.
 * Returns a JSON string like '{"userId": "abc123"}' or '{"id": "x", "sk": "y"}'
 */
export function extractPrimaryKeyJson(item: DynamoDBItem, table: AwsDynamoDBTableDescription): string {
  const keys = table.KeySchema ?? [];
  const pkObj: Record<string, unknown> = {};

  for (const key of keys) {
    const attrName = key.AttributeName;
    const attr = item[attrName];
    if (attr) {
      pkObj[attrName] = unwrapDynamoValue(attr);
    }
  }

  return JSON.stringify(pkObj);
}

/**
 * Get the sort key value from an item for display.
 * Returns unwrapped value or undefined.
 */
export function extractSkValue(item: DynamoDBItem, table: AwsDynamoDBTableDescription): string | undefined {
  const rangeKey = table.KeySchema?.find((k) => k.KeyType === "RANGE");
  if (!rangeKey) return undefined;

  const attr = item[rangeKey.AttributeName];
  if (!attr) return undefined;

  return String(unwrapDynamoValue(attr));
}

/**
 * Get the partition key value from an item for display.
 * Returns unwrapped value or undefined.
 */
export function extractPkValue(item: DynamoDBItem, table: AwsDynamoDBTableDescription): string | undefined {
  const hashKey = table.KeySchema?.find((k) => k.KeyType === "HASH");
  if (!hashKey) return undefined;

  const attr = item[hashKey.AttributeName];
  if (!attr) return undefined;

  return String(unwrapDynamoValue(attr));
}
