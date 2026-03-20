import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult } from "../../types.js";
import { textCell } from "../../types.js";
import type { AwsRegionOption } from "../../hooks/useAwsRegions.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { singlePartKey } from "../../utils/bookmarks.js";

export function createRegionAdapter(availableRegions: AwsRegionOption[]): ServiceAdapter {
  return {
    id: "_regions",
    label: "Regions",
    hudColor: SERVICE_COLORS._regions ?? { bg: "blue", fg: "white" },

    getColumns(): ColumnDef[] {
      return [
        { key: "region", label: "Region" },
        { key: "description", label: "Description" },
      ];
    },

    async getRows(): Promise<TableRow[]> {
      return availableRegions.map((r) => ({
        id: r.name,
        cells: {
          region: textCell(r.name),
          description: textCell(r.description),
        },
        meta: {},
      }));
    },

    async onSelect(_row: TableRow): Promise<SelectResult> {
      return { action: "none" };
    },

    canGoBack(): boolean {
      return true;
    },

    goBack(): undefined {
      return undefined;
    },

    pushUiLevel(_filterText: string, _selectedIndex: number): void {
      // Flat adapter — never called
    },

    getPath(): string {
      return "regions";
    },
    getBookmarkKey(row: TableRow) {
      return singlePartKey("Region", row);
    },
  };
}
