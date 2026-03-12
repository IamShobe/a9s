import { SERVICE_REGISTRY } from "../services.js";

const SERVICE_COMMANDS = Object.keys(SERVICE_REGISTRY);

export const AVAILABLE_COMMANDS = [
  ...SERVICE_COMMANDS,
  "regions",
  "profiles",
  "resources",
  "theme",
  "b",
  "region",
  "profile",
  "use-region",
  "use-profile",
  "watch",
  "unwatch",
  "tag",
  "untag",
  "$default",
  "quit",
] as const;

export const COMMAND_MODE_HINT =
  ` Commands: ${SERVICE_COMMANDS.join(" ")} quit regions profiles resources theme watch unwatch tag untag  •  Enter run  •  Esc cancel`;
