export const AVAILABLE_COMMANDS = [
  "s3",
  "route53",
  "dynamodb",
  "iam",
  "regions",
  "profiles",
  "resources",
  "region",
  "profile",
  "use-region",
  "use-profile",
  "$default",
  "quit",
] as const;

export const COMMAND_MODE_HINT =
  " Commands: s3 route53 dynamodb iam quit regions profiles resources  •  Enter run  •  Esc cancel";

