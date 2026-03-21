import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import type { BookmarkKeyPart } from "../../utils/bookmarks.js";
import { statusCell } from "../../utils/statusColors.js";
import { runAwsJsonAsync, resolveRegion } from "../../utils/aws.js";
import { createStackState } from "../../utils/createStackState.js";
import type { AwsCFDistributionSummary, AwsCFInvalidationSummary, CloudFrontLevel, CloudFrontRowMeta } from "./types.js";
import { createCloudFrontDetailCapability } from "./capabilities/detailCapability.js";
import { createCloudFrontYankCapability } from "./capabilities/yankCapability.js";
import { createCloudFrontActionCapability } from "./capabilities/actionCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";

interface CloudFrontNavFrame extends NavFrame {
  level: CloudFrontLevel;
}

export function createCloudFrontServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  // CloudFront is a global service; CLI calls don't need --region
  const { getLevel, setLevel, getBackStack, setBackStack, canGoBack, goBack, pushUiLevel, reset } =
    createStackState<CloudFrontLevel, CloudFrontNavFrame>({ kind: "distributions" });

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "distributions") {
      return [
        { key: "id", label: "ID", width: 16 },
        { key: "domain", label: "Domain Name" },
        { key: "status", label: "Status", width: 12 },
        { key: "enabled", label: "Enabled", width: 9 },
        { key: "origins", label: "Origins", width: 8 },
        { key: "priceClass", label: "Price Class", width: 16 },
        { key: "comment", label: "Comment" },
      ];
    }
    // invalidations level
    return [
      { key: "id", label: "ID", width: 16 },
      { key: "status", label: "Status", width: 14 },
      { key: "createdAt", label: "Created At", width: 22, heatmap: { type: "date" } },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "distributions") {
      try {
        const data = await runAwsJsonAsync<{ DistributionList?: { Items?: AwsCFDistributionSummary[] } }>([
          "cloudfront",
          "list-distributions",
        ]);
        const items = data.DistributionList?.Items ?? [];
        return items.map((dist) => ({
          id: dist.Id,
          cells: {
            id: textCell(dist.Id),
            domain: textCell(dist.DomainName),
            status: statusCell(dist.Status),
            enabled: textCell(dist.Enabled ? "Yes" : "No"),
            origins: textCell(String(dist.Origins.Quantity)),
            priceClass: textCell(dist.PriceClass.replace("PriceClass_", "PC ")),
            comment: textCell(dist.Comment || "-"),
          },
          meta: {
            type: "distribution",
            distributionId: dist.Id,
            domainName: dist.DomainName,
            arn: dist.ARN,
            status: dist.Status,
            enabled: dist.Enabled,
            comment: dist.Comment,
            priceClass: dist.PriceClass,
          } satisfies CloudFrontRowMeta,
        }));
      } catch (e) {
        debugLog("cloudfront", "getRows (distributions) failed", e);
        return [];
      }
    }

    // invalidations level
    const { distributionId } = level;
    try {
      const data = await runAwsJsonAsync<{ InvalidationList?: { Items?: AwsCFInvalidationSummary[] } }>([
        "cloudfront",
        "list-invalidations",
        "--distribution-id",
        distributionId,
      ]);
      const items = data.InvalidationList?.Items ?? [];
      return items.map((inv) => ({
        id: inv.Id,
        cells: {
          id: textCell(inv.Id),
          status: statusCell(inv.Status),
          createdAt: textCell(inv.CreateTime),
        },
        meta: {
          type: "invalidation",
          invalidationId: inv.Id,
          distributionId,
          status: inv.Status,
          createdAt: inv.CreateTime,
        } satisfies CloudFrontRowMeta,
      }));
    } catch (e) {
      debugLog("cloudfront", "getRows (invalidations) failed", e);
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as CloudFrontRowMeta | undefined;

    if (level.kind === "distributions") {
      if (!meta || meta.type !== "distribution") return { action: "none" };

      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({ kind: "invalidations", distributionId: meta.distributionId, domainName: meta.domainName });
      return { action: "navigate" };
    }

    // invalidations level: leaf
    return { action: "none" };
  };

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "distributions") return "cloudfront://";
    return `cloudfront://${level.domainName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "distributions") return "☁️  CloudFront Distributions";
    return `☁️  ${level.domainName}`;
  };

  const getBrowserUrl = (row: TableRow): string | null => {
    const meta = row.meta as CloudFrontRowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "distribution") {
      return `https://us-east-1.console.aws.amazon.com/cloudfront/v4/home#/distributions/${meta.distributionId}`;
    }
    const level = getLevel();
    if (level.kind === "invalidations") {
      return `https://us-east-1.console.aws.amazon.com/cloudfront/v4/home#/distributions/${level.distributionId}`;
    }
    return null;
  };

  const detailCapability = createCloudFrontDetailCapability(getLevel);
  const yankCapability = createCloudFrontYankCapability();
  const actionCapability = createCloudFrontActionCapability(getLevel);

  return {
    id: "cloudfront",
    label: "CloudFront",
    hudColor: SERVICE_COLORS.cloudfront ?? { bg: "yellow", fg: "black" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    pushUiLevel,
    getPath,
    getContextLabel,
    getBrowserUrl,
    reset,
    getBookmarkKey(row: TableRow): BookmarkKeyPart[] {
      const level = getLevel();
      const meta = row.meta as CloudFrontRowMeta | undefined;
      if (level.kind === "distributions") {
        const domainName = meta?.type === "distribution" ? meta.domainName : row.id;
        return [{ label: "Distribution", displayName: domainName, id: row.id }];
      }
      return [
        { label: "Distribution", displayName: level.domainName, id: level.distributionId },
        { label: "Invalidation", displayName: row.id, id: row.id },
      ];
    },
    restoreFromKey(key: BookmarkKeyPart[]): void {
      if (key.length === 1) {
        setBackStack([]);
        setLevel({ kind: "distributions" });
      } else if (key.length >= 2) {
        const distributionId = key[0]!.id ?? key[0]!.displayName;
        const domainName = key[0]!.displayName;
        setBackStack([{ level: { kind: "distributions" }, selectedIndex: 0 }]);
        setLevel({ kind: "invalidations", distributionId, domainName });
      }
    },
    capabilities: {
      detail: detailCapability,
      yank: yankCapability,
      actions: actionCapability,
    },
  };
}
