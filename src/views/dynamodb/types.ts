export interface AwsDynamoDBTableDescription {
  TableName: string;
  TableArn: string;
  TableStatus: "CREATING" | "DELETING" | "UPDATING" | "ACTIVE";
  ItemCount: number;
  TableSizeBytes: number;
  BillingModeSummary?: {
    BillingMode: "PROVISIONED" | "PAY_PER_REQUEST";
    LastUpdateToPayPerRequestDateTime?: string;
  };
  ProvisionedThroughput?: {
    ReadCapacityUnits: number;
    WriteCapacityUnits: number;
  };
  KeySchema: Array<{
    AttributeName: string;
    KeyType: "HASH" | "RANGE";
  }>;
  AttributeDefinitions: Array<{
    AttributeName: string;
    AttributeType: string;
  }>;
  GlobalSecondaryIndexes?: Array<{
    IndexName: string;
    KeySchema: Array<{
      AttributeName: string;
      KeyType: "HASH" | "RANGE";
    }>;
  }>;
  LocalSecondaryIndexes?: Array<{
    IndexName: string;
  }>;
  CreationDateTime?: string;
}

export type DynamoDBAttributeValue =
  | { S: string }
  | { N: string }
  | { B: string }
  | { SS: string[] }
  | { NS: string[] }
  | { BS: string[] }
  | { M: Record<string, DynamoDBAttributeValue> }
  | { L: DynamoDBAttributeValue[] }
  | { NULL: boolean }
  | { BOOL: boolean };

export interface DynamoDBItem {
  [key: string]: DynamoDBAttributeValue;
}

export type DynamoDBLevel =
  | { kind: "tables" }
  | { kind: "items"; tableName: string }
  | { kind: "item-fields"; tableName: string; itemIndex: number };

export interface DynamoDBRowMeta extends Record<string, unknown> {
  type: "table" | "item" | "item-field";
  tableName?: string;
  tableStatus?: string;
  tableArn?: string;
  billing?: string;
  gsiCount?: number;
  itemIndex?: number;
  itemPkValue?: string | undefined;
  itemSkValue?: string | undefined;
  itemSize?: number;
  itemJson?: string; // Serialized item for display/yank
  fieldName?: string;
  fieldValue?: string; // Serialized display value
  fieldType?: string;
  fieldRawValue?: unknown; // Raw DynamoDB value for yank
}
