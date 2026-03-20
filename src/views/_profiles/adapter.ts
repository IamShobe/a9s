import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult } from "../../types.js";
import { textCell } from "../../types.js";
import type { AwsProfileOption } from "../../hooks/useAwsProfiles.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { singlePartKey } from "../../utils/bookmarks.js";

export function createProfileAdapter(availableProfiles: AwsProfileOption[]): ServiceAdapter {
  return {
    id: "_profiles",
    label: "Profiles",
    hudColor: SERVICE_COLORS._profiles ?? { bg: "magenta", fg: "white" },

    getColumns(): ColumnDef[] {
      return [
        { key: "profile", label: "Profile" },
        { key: "description", label: "Description" },
      ];
    },

    async getRows(): Promise<TableRow[]> {
      return availableProfiles.map((p) => ({
        id: p.name,
        cells: {
          profile: textCell(p.name),
          description: textCell(p.description),
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
      return "profiles";
    },
    getBookmarkKey(row: TableRow) {
      return singlePartKey("Profile", row);
    },
  };
}
