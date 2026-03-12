import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../../adapters/capabilities/ActionCapability.js";
import { buildRegionArgs } from "../../../utils/aws.js";
import { toErrorMessage } from "../../../utils/errorHelpers.js";
import type { LambdaLevel, LambdaRowMeta } from "../types.js";

const execFileAsync = promisify(execFile);

export function createLambdaActionCapability(
  region?: string,
  getLevel?: () => LambdaLevel,
): ActionCapability {
  const regionArgs = buildRegionArgs(region);

  const getKeybindings = (): AdapterKeyBinding[] => [
    {
      trigger: { type: "key", char: "i" },
      actionId: "invoke",
      label: "Invoke function",
      shortLabel: "invoke",
      scope: "navigate",
      adapterId: "lambda",
    },
  ];

  const executeAction = async (actionId: string, context: ActionContext): Promise<ActionEffect> => {
    const level = getLevel?.();
    if (level?.kind !== "functions") return { type: "none" };

    const meta = context.row?.meta as LambdaRowMeta | undefined;
    if (!meta || meta.type !== "function") {
      return { type: "error", message: "Select a function to invoke" };
    }

    if (actionId === "invoke") {
      return {
        type: "prompt",
        label: "Payload (JSON):",
        defaultValue: "{}",
        nextActionId: "invoke:submit",
      };
    }

    if (actionId === "invoke:submit") {
      const payload = (context.data?.path as string | undefined) ?? "{}";
      const responseFile = join(tmpdir(), `a9s_lambda_${Date.now()}.json`);

      try {
        const { stdout } = await execFileAsync(
          "aws",
          [
            "lambda",
            "invoke",
            "--function-name",
            meta.functionName,
            "--payload",
            payload,
            "--cli-binary-format",
            "raw-in-base64-out",
            responseFile,
            "--output",
            "json",
            ...regionArgs,
          ],
          { timeout: 30_000, env: process.env },
        );

        const invokeResult = JSON.parse(stdout) as { StatusCode?: number; FunctionError?: string };
        const statusCode = invokeResult.StatusCode ?? "?";
        const responseBody = await readFile(responseFile, "utf-8");
        const snippet = responseBody.length > 200 ? responseBody.slice(0, 200) + "..." : responseBody;

        if (invokeResult.FunctionError) {
          return {
            type: "feedback",
            message: `Invoke error (${statusCode}): ${snippet}`,
          };
        }

        return {
          type: "feedback",
          message: `Invoked ${meta.functionName} → ${statusCode}: ${snippet}`,
        };
      } catch (err) {
        return { type: "error", message: `Invoke failed: ${toErrorMessage(err)}` };
      } finally {
        await unlink(responseFile).catch(() => {});
      }
    }

    return { type: "none" };
  };

  return { getKeybindings, executeAction };
}
