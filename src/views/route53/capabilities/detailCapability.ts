import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsHostedZone, Route53Level, Route53RowMeta } from "../types.js";

export function createRoute53DetailCapability(
  region?: string,
  getLevel?: () => Route53Level,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as Route53RowMeta | undefined;
    if (!meta) {
      return [];
    }

    const level = getLevel?.();

    // Zone level
    if (level?.kind === "zones" && meta.type === "zone") {
      const fullZoneId = meta.zoneId!.startsWith("/hostedzone/")
        ? meta.zoneId!
        : `/hostedzone/${meta.zoneId!}`;

      const data = await runAwsJsonAsync<AwsHostedZone>([
        "route53",
        "get-hosted-zone",
        "--id",
        fullZoneId,
        ...regionArgs,
      ]);

      const fields: DetailField[] = [
        { label: "Zone Name", value: data.Name ?? "-" },
        { label: "Zone ID (Full)", value: data.Id ?? "-" },
        { label: "Zone ID (Short)", value: meta.zoneId! },
        { label: "Record Count", value: String(data.ResourceRecordSetCount ?? 0) },
        {
          label: "Type",
          value: meta.isPrivate ? "Private" : "Public",
        },
        { label: "Caller Reference", value: data.CallerReference ?? "-" },
      ];

      return fields;
    }

    // Record level
    if (level?.kind === "records" && meta.type === "record") {
      const fields: DetailField[] = [
        { label: "Record Name", value: meta.recordName ?? "-" },
        { label: "Record Type", value: meta.recordType ?? "-" },
        { label: "TTL", value: meta.recordAliasTarget ? "(Alias - no TTL)" : String(meta.recordTtl ?? "-") },
      ];

      if (meta.recordValues && meta.recordValues.length > 0) {
        fields.push({
          label: "Values",
          value: meta.recordValues.join("\n"),
        });
      }

      if (meta.recordAliasTarget) {
        fields.push({
          label: "Alias Target",
          value: meta.recordAliasTarget.DNSName,
        });
        fields.push({
          label: "Hosted Zone ID",
          value: meta.recordAliasTarget.HostedZoneId,
        });
      }

      return fields;
    }

    return [];
  };

  return { getDetails };
}
