import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../../adapters/capabilities/ActionCapability.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import { toErrorMessage } from "../../../utils/errorHelpers.js";
import type { StepFunctionsLevel, SFNRowMeta } from "../types.js";

export function createSFNActionCapability(
  region?: string,
  getLevel?: () => StepFunctionsLevel,
): ActionCapability {
  const regionArgs = buildRegionArgs(region);

  const getKeybindings = (): AdapterKeyBinding[] => [
    {
      trigger: { type: "key", char: "s" },
      actionId: "start-execution",
      label: "Start execution",
      shortLabel: "start",
      scope: "navigate",
      adapterId: "stepfunctions",
    },
    {
      trigger: { type: "key", char: "X" },
      actionId: "stop-execution",
      label: "Stop running execution",
      shortLabel: "stop exec",
      scope: "navigate",
      adapterId: "stepfunctions",
    },
  ];

  const executeAction = async (actionId: string, context: ActionContext): Promise<ActionEffect> => {
    const level = getLevel?.();
    const meta = context.row?.meta as SFNRowMeta | undefined;

    if (actionId === "start-execution") {
      if (level?.kind !== "state-machines") return { type: "none" };
      if (!meta || meta.type !== "state-machine") {
        return { type: "error", message: "Select a state machine to start an execution" };
      }
      return {
        type: "prompt",
        label: `Input JSON for ${meta.stateMachineName} (empty for {}):`,
        defaultValue: "{}",
        nextActionId: "start-execution:confirmed",
      };
    }

    if (actionId === "start-execution:confirmed") {
      if (!meta || meta.type !== "state-machine") return { type: "error", message: "No state machine selected" };
      const input = ((context.data?.path as string | undefined) ?? "").trim() || "{}";
      try {
        await runAwsJsonAsync<unknown>([
          "stepfunctions",
          "start-execution",
          "--state-machine-arn",
          meta.stateMachineArn,
          "--input",
          input,
          ...regionArgs,
        ]);
        return {
          type: "multi",
          effects: [
            { type: "feedback", message: `Started execution of ${meta.stateMachineName}` },
            { type: "refresh" },
          ],
        };
      } catch (err) {
        return { type: "error", message: `Start failed: ${toErrorMessage(err)}` };
      }
    }

    if (actionId === "stop-execution") {
      if (level?.kind !== "executions") return { type: "none" };
      if (!meta || meta.type !== "execution") {
        return { type: "error", message: "Select an execution to stop" };
      }
      if (meta.status !== "RUNNING") {
        return { type: "error", message: `Execution is already ${meta.status}` };
      }
      return {
        type: "confirm",
        message: `Stop execution ${meta.executionArn.split(":").pop() ?? meta.executionArn}?`,
        nextActionId: "stop-execution:confirmed",
      };
    }

    if (actionId === "stop-execution:confirmed") {
      if (!meta || meta.type !== "execution") return { type: "error", message: "No execution selected" };
      try {
        await runAwsJsonAsync<unknown>([
          "stepfunctions",
          "stop-execution",
          "--execution-arn",
          meta.executionArn,
          ...regionArgs,
        ]);
        return {
          type: "multi",
          effects: [
            { type: "feedback", message: "Execution stopped" },
            { type: "refresh" },
          ],
        };
      } catch (err) {
        return { type: "error", message: `Stop failed: ${toErrorMessage(err)}` };
      }
    }

    return { type: "none" };
  };

  return { getKeybindings, executeAction };
}
