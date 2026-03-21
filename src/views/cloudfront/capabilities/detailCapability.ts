import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync } from "../../../utils/aws.js";
import type {
  AwsCFDistributionDetail,
  AwsCFInvalidationDetail,
  CloudFrontLevel,
  CloudFrontRowMeta,
} from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

export function createCloudFrontDetailCapability(
  getLevel?: () => CloudFrontLevel,
): DetailCapability {
  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as CloudFrontRowMeta | undefined;
    if (!meta) return [];

    const level = getLevel?.();

    if (level?.kind === "distributions" && meta.type === "distribution") {
      try {
        const data = await runAwsJsonAsync<AwsCFDistributionDetail>([
          "cloudfront",
          "get-distribution",
          "--id",
          meta.distributionId,
        ]);
        const dist = data.Distribution;
        const cfg = dist.DistributionConfig;
        const aliases = cfg.Aliases?.Items?.join(", ") || "-";
        const origins = cfg.Origins.Items.map((o) => o.DomainName).join(", ");
        return [
          { label: "ID", value: dist.Id },
          { label: "ARN", value: dist.ARN },
          { label: "Status", value: dist.Status },
          { label: "Domain Name", value: dist.DomainName },
          { label: "Comment", value: cfg.Comment || "-" },
          { label: "Enabled", value: cfg.Enabled ? "Yes" : "No" },
          { label: "Aliases (CNAMEs)", value: aliases },
          { label: "Origins", value: origins },
          { label: "Price Class", value: cfg.PriceClass },
          { label: "HTTP Version", value: cfg.HttpVersion || "-" },
          { label: "IPv6 Enabled", value: cfg.IsIPV6Enabled ? "Yes" : "No" },
          { label: "Viewer Protocol", value: cfg.DefaultCacheBehavior?.ViewerProtocolPolicy || "-" },
          { label: "Web ACL ID", value: cfg.WebACLId || "-" },
        ];
      } catch (e) {
        debugLog("cloudfront", "getDetails (distribution) failed", e);
        return [];
      }
    }

    if (level?.kind === "invalidations" && meta.type === "invalidation") {
      try {
        const data = await runAwsJsonAsync<AwsCFInvalidationDetail>([
          "cloudfront",
          "get-invalidation",
          "--distribution-id",
          level.distributionId,
          "--id",
          meta.invalidationId,
        ]);
        const inv = data.Invalidation;
        const paths = inv.InvalidationBatch.Paths.Items.join(", ");
        return [
          { label: "ID", value: inv.Id },
          { label: "Status", value: inv.Status },
          { label: "Created At", value: inv.CreateTime },
          { label: "Paths", value: paths },
          { label: "Path Count", value: String(inv.InvalidationBatch.Paths.Quantity) },
          { label: "Caller Reference", value: inv.InvalidationBatch.CallerReference },
          { label: "Distribution ID", value: level.distributionId },
        ];
      } catch (e) {
        debugLog("cloudfront", "getDetails (invalidation) failed", e);
        return [];
      }
    }

    return [];
  };

  return { getDetails };
}
