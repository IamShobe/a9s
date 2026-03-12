import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { StepFunctionsLevel, SFNRowMeta } from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

interface AwsSFNStateMachineDetail {
  stateMachineArn: string;
  name: string;
  status?: string;
  type?: string;
  creationDate?: string;
  roleArn?: string;
  loggingConfiguration?: { level?: string };
}

interface AwsSFNExecutionDetail {
  executionArn: string;
  stateMachineArn: string;
  name: string;
  status: string;
  startDate?: string;
  stopDate?: string;
  input?: string;
  error?: string;
  cause?: string;
}

export function createSFNDetailCapability(
  region?: string,
  getLevel?: () => StepFunctionsLevel,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as SFNRowMeta | undefined;
    if (!meta) return [];
    const level = getLevel?.();

    if (level?.kind === "state-machines" && meta.type === "state-machine") {
      try {
        const data = await runAwsJsonAsync<AwsSFNStateMachineDetail>([
          "stepfunctions",
          "describe-state-machine",
          "--state-machine-arn",
          meta.stateMachineArn,
          ...regionArgs,
        ]);
        return [
          { label: "Name", value: data.name },
          { label: "ARN", value: data.stateMachineArn },
          { label: "Type", value: data.type ?? "-" },
          { label: "Status", value: data.status ?? "-" },
          { label: "Role ARN", value: data.roleArn ?? "-" },
          { label: "Log Level", value: data.loggingConfiguration?.level ?? "OFF" },
          { label: "Created", value: data.creationDate ? data.creationDate.slice(0, 19) : "-" },
        ];
      } catch (e) {
        debugLog("stepfunctions", "getDetails (state-machine) failed", e);
        return [];
      }
    }

    if (level?.kind === "executions" && meta.type === "execution") {
      try {
        const data = await runAwsJsonAsync<AwsSFNExecutionDetail>([
          "stepfunctions",
          "describe-execution",
          "--execution-arn",
          meta.executionArn,
          ...regionArgs,
        ]);
        const fields: DetailField[] = [
          { label: "Name", value: data.name },
          { label: "Execution ARN", value: data.executionArn },
          { label: "State Machine ARN", value: data.stateMachineArn },
          { label: "Status", value: data.status },
          { label: "Started", value: data.startDate ? data.startDate.slice(0, 19) : "-" },
          { label: "Stopped", value: data.stopDate ? data.stopDate.slice(0, 19) : "-" },
        ];
        if (data.error) {
          fields.push({ label: "Error", value: data.error });
          fields.push({ label: "Cause", value: data.cause ?? "-" });
        }
        if (data.input) {
          fields.push({ label: "Input", value: data.input.slice(0, 200) + (data.input.length > 200 ? "…" : "") });
        }
        return fields;
      } catch (e) {
        debugLog("stepfunctions", "getDetails (execution) failed", e);
        return [];
      }
    }

    return [];
  };

  return { getDetails };
}
