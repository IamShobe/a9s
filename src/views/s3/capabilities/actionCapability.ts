import type { S3Client } from "@aws-sdk/client-s3";

import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../../adapters/capabilities/ActionCapability.js";
import { downloadObjectToPath } from "../fetcher.js";
import { toParentPrefix } from "../utils.js";
import type { S3Level } from "../adapter.js";

export function createS3ActionCapability(
  client: S3Client,
  getLevel: () => S3Level,
  getBackStack: () => Array<{ level: S3Level; selectedIndex: number }>,
  setBackStack: (stack: Array<{ level: S3Level; selectedIndex: number }>) => void,
  setLevel: (level: S3Level) => void,
): ActionCapability {
  const getKeybindings = (): AdapterKeyBinding[] => [
    {
      trigger: { type: "key", char: "f" },
      actionId: "fetch",
      label: "Fetch / download selected file",
      scope: "navigate",
    },
    {
      trigger: { type: "chord", keys: ["g", "p"] },
      actionId: "jump-to-path",
      label: "Go to path jump prompt",
      scope: "navigate",
    },
  ];

  const executeAction = async (
    actionId: string,
    context: ActionContext,
  ): Promise<ActionEffect> => {
    const level = getLevel();

    if (actionId === "fetch") {
      // Start fetch flow: prompt for path
      if (!context.row) return { type: "error", message: "No row selected" };
      if (level.kind !== "objects") {
        return { type: "error", message: "Fetch is only available in object view" };
      }
      const type = context.row.meta?.type as string;
      if (type !== "object") {
        return { type: "error", message: "Fetch is only available for objects" };
      }
      return {
        type: "prompt",
        label: "Fetch to:",
        defaultValue: "",
        nextActionId: "fetch:submit",
      };
    }

    if (actionId === "fetch:submit") {
      // User entered a path; try to download
      if (!context.row || !context.data?.path) {
        return { type: "error", message: "Invalid path" };
      }
      if (level.kind !== "objects") {
        return { type: "error", message: "Fetch is only available in object view" };
      }

      const destinationPath = context.data.path as string;
      try {
        const finalPath = await downloadObjectToPath(
          client,
          level.bucket,
          context.row.meta?.key as string,
          destinationPath,
          false, // no overwrite check yet
        );
        return {
          type: "feedback",
          message: `Downloaded to ${finalPath}`,
        };
      } catch (err) {
        const error = err as any;
        // Check for file exists error
        if (error.code === "EEXIST") {
          return {
            type: "confirm",
            message: `File exists. Overwrite ${destinationPath}?`,
            nextActionId: "fetch:overwrite",
            data: { path: destinationPath },
          };
        }
        return {
          type: "error",
          message: `Fetch failed: ${error.message ?? String(error)}`,
        };
      }
    }

    if (actionId === "fetch:overwrite") {
      // User confirmed overwrite
      if (!context.row || !context.data?.path) {
        return { type: "error", message: "Invalid path" };
      }
      if (level.kind !== "objects") {
        return { type: "error", message: "Fetch is only available in object view" };
      }

      const destinationPath = context.data.path as string;
      try {
        const finalPath = await downloadObjectToPath(
          client,
          level.bucket,
          context.row.meta?.key as string,
          destinationPath,
          true, // overwrite
        );
        return {
          type: "feedback",
          message: `Downloaded to ${finalPath}`,
        };
      } catch (err) {
        const error = err as any;
        return {
          type: "error",
          message: `Fetch failed: ${error.message ?? String(error)}`,
        };
      }
    }

    if (actionId === "jump-to-path") {
      // Start jump flow: prompt for target
      return {
        type: "prompt",
        label: "Jump to (s3://bucket/key or /key):",
        defaultValue: "",
        nextActionId: "jump-to-path:submit",
      };
    }

    if (actionId === "jump-to-path:submit") {
      // User entered a jump target
      if (!context.data?.path) {
        return { type: "error", message: "Invalid jump target" };
      }

      const raw = (context.data.path as string).trim();
      if (!raw) return { type: "error", message: "Jump target is empty" };

      const current = level;
      let nextBucket = "";
      let nextPrefix = "";

      if (raw.startsWith("s3://")) {
        const withoutScheme = raw.slice("s3://".length);
        const slashIdx = withoutScheme.indexOf("/");
        if (slashIdx === -1) {
          nextBucket = withoutScheme;
          nextPrefix = "";
        } else {
          nextBucket = withoutScheme.slice(0, slashIdx);
          const keySpec = withoutScheme.slice(slashIdx + 1);
          nextPrefix = toParentPrefix(keySpec);
        }
        if (!nextBucket) return { type: "error", message: "Invalid S3 URI: missing bucket" };
      } else {
        if (level.kind !== "objects") {
          return {
            type: "error",
            message: 'From bucket list, jump must use "s3://bucket/..."',
          };
        }
        nextBucket = level.bucket;
        const localSpec = raw.startsWith("/") ? raw.slice(1) : raw;
        nextPrefix = toParentPrefix(localSpec);
      }

      const backStack = getBackStack();
      // Actually perform the navigation by updating the level
      setBackStack([...backStack, { level: current, selectedIndex: 0 }]);
      setLevel({ kind: "objects", bucket: nextBucket, prefix: nextPrefix });
      return {
        type: "feedback",
        message: `Jumped to s3://${nextBucket}/${nextPrefix}`,
      };
    }

    return { type: "error", message: `Unknown action: ${actionId}` };
  };

  return {
    getKeybindings,
    executeAction,
  };
}
