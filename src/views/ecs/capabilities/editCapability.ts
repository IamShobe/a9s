import type { EditCapability } from "../../../adapters/capabilities/EditCapability.js";
import type { TableRow, SelectResult } from "../../../types.js";
import { readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsEcsService, ECSLevel, ECSRowMeta } from "../types.js";

export function createECSEditCapability(
  region?: string,
  getLevel?: () => ECSLevel,
): EditCapability {
  const regionArgs = buildRegionArgs(region);

  const onEdit = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel?.();
    const meta = row.meta as ECSRowMeta | undefined;

    if (!meta || level?.kind !== "services" || meta.type !== "service") {
      return { action: "none" };
    }

    const data = await runAwsJsonAsync<{ services: AwsEcsService[] }>([
      "ecs",
      "describe-services",
      "--cluster",
      level.clusterArn,
      "--services",
      meta.serviceArn,
      ...regionArgs,
    ]);
    const svc = data.services?.[0];
    if (!svc) throw new Error("Service not found");

    const editData = {
      desiredCount: svc.desiredCount ?? 0,
      taskDefinition: svc.taskDefinition ?? "",
    };

    const safeName = meta.serviceName.replace(/[^a-z0-9_-]/gi, "_");
    const filePath = join(tmpdir(), `a9s_ecs_service_${safeName}.json`);
    await writeFile(filePath, JSON.stringify(editData, null, 2), { mode: 0o600 });

    return {
      action: "edit",
      filePath,
      metadata: {
        clusterArn: level.clusterArn,
        serviceArn: meta.serviceArn,
        serviceName: meta.serviceName,
      },
    };
  };

  const uploadFile = async (filePath: string, metadata: Record<string, unknown>): Promise<void> => {
    const clusterArn = metadata.clusterArn as string | undefined;
    const serviceName = metadata.serviceName as string | undefined;
    const serviceArn = metadata.serviceArn as string | undefined;
    if (!clusterArn || !serviceName) throw new Error("Missing cluster/service in metadata");

    const configJson = await readFile(filePath, "utf-8");
    let config: { desiredCount?: number; taskDefinition?: string };
    try {
      config = JSON.parse(configJson) as { desiredCount?: number; taskDefinition?: string };
    } catch {
      throw new Error("Invalid JSON in service config file");
    }

    const args = [
      "ecs",
      "update-service",
      "--cluster",
      clusterArn,
      "--service",
      serviceArn ?? serviceName,
    ];

    if (config.desiredCount != null) {
      args.push("--desired-count", String(config.desiredCount));
    }
    if (config.taskDefinition) {
      args.push("--task-definition", config.taskDefinition);
    }

    await runAwsJsonAsync<unknown>([...args, ...regionArgs]);
  };

  return { onEdit, uploadFile };
}
