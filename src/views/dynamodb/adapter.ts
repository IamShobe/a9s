import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult } from "../../types.js";
import { textCell } from "../../types.js";

export function createDynamoDBServiceAdapter(): ServiceAdapter {
  const getColumns = (): ColumnDef[] => [{ key: "name", label: "Name" }];

  const getRows = async (): Promise<TableRow[]> => {
    return [{ id: "stub", cells: { name: textCell("DynamoDB not yet implemented") }, meta: {} }];
  };

  const onSelect = async (_row: TableRow): Promise<SelectResult> => {
    return { action: "none" };
  };

  return {
    id: "dynamodb",
    label: "DynamoDB",
    hudColor: { bg: "green", fg: "white" },
    getColumns,
    getRows,
    onSelect,
    canGoBack: () => false,
    goBack: () => {},
    getPath: () => "/",
    getContextLabel: () => "⚡ Tables",
  };
}
