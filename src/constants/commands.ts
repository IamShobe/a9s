import { SERVICE_REGISTRY } from "../services.js";

const SERVICE_COMMANDS = Object.keys(SERVICE_REGISTRY);

export const AVAILABLE_COMMANDS = [
  ...SERVICE_COMMANDS,
  "regions",
  "profiles",
  "resources",
  "theme",
  "region",
  "profile",
  "use-region",
  "use-profile",
  "$default",
  "quit",
] as const;

export const COMMAND_MODE_HINT =
  ` Commands: ${SERVICE_COMMANDS.join(" ")} quit regions profiles resources theme  •  Enter run  •  Esc cancel`;
