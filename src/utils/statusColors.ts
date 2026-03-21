import type { Cell } from "../types.js";

/** Map lowercase status values to terminal color names. */
const DIRECT_STATUS_COLORS: Record<string, string> = {
  // Green: healthy / running
  running: "green",
  available: "green",
  active: "green",
  "in-use": "green",
  healthy: "green",
  complete: "green",

  // Yellow: transitional
  pending: "yellow",
  stopping: "yellow",
  starting: "cyan",
  creating: "yellow",
  modifying: "yellow",
  rebooting: "yellow",
  "backing-up": "yellow",
  provisioning: "yellow",
  deleting: "yellow",
  draining: "yellow",
  "shutting-down": "yellow",
  snapshotting: "yellow",

  // Red: error / failure / stopped
  stopped: "red",
  failed: "red",
  error: "red",
  terminating: "red",
  unhealthy: "red",
  impaired: "red",
  "insufficient-data": "red",

  // CloudFront distribution statuses
  deployed: "green",
  inprogress: "yellow",

  // SNS subscription states
  confirmed: "green",
  pendingconfirmation: "yellow",
  deleted: "gray",

  // Gray: terminal / inactive
  terminated: "gray",
  inactive: "gray",
  "not-found": "gray",
  unused: "gray",
};

/**
 * Return a color for a status string, or undefined if none applies.
 * Handles plain AWS statuses (running, stopped, …) and CloudFormation
 * ALL_CAPS_WITH_UNDERSCORES statuses.
 */
export function getStatusColor(status: string): string | undefined {
  if (!status || status === "-") return undefined;

  // Direct match (case-insensitive)
  const lower = status.toLowerCase();
  const direct = DIRECT_STATUS_COLORS[lower];
  if (direct) return direct;

  // CloudFormation / uppercase compound statuses
  if (status.includes("_")) {
    const upper = status.toUpperCase();
    if (upper === "DELETE_COMPLETE") return "gray";
    if (upper.endsWith("_COMPLETE")) return "green";
    if (upper.endsWith("_IN_PROGRESS") || upper.endsWith("_PENDING")) return "yellow";
    if (upper.endsWith("_FAILED") || upper.includes("ROLLBACK")) return "red";
  }

  return undefined;
}

/** Build a Cell with automatic status coloring. */
export function statusCell(value: string): Cell {
  const color = getStatusColor(value);
  return color ? { displayName: value, type: "text", color } : { displayName: value, type: "text" };
}
