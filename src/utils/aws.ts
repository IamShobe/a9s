import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Run an AWS CLI command asynchronously. Returns stdout or null on error/timeout.
 */
export async function runAwsCli(args: string[], timeoutMs = 2000): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("aws", args, {
      timeout: timeoutMs,
      env: process.env,
    });
    return stdout;
  } catch {
    return null;
  }
}

/**
 * Run an AWS CLI command synchronously and parse JSON output. Throws on error.
 */
export function runAwsJson<T>(args: string[]): T {
  try {
    const output = execFileSync("aws", [...args, "--output", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(output) as T;
  } catch (error) {
    const message = (error as Error).message;
    const isIamDisabled =
      message.includes("Service 'iam' is not enabled") ||
      message.includes("when calling the ListRoles operation");
    if (isIamDisabled && Boolean(process.env.AWS_ENDPOINT_URL)) {
      throw new Error(
        "IAM is not enabled in LocalStack. Add iam to SERVICES (for example: SERVICES=s3,iam,sts) and restart LocalStack.",
      );
    }
    throw error;
  }
}
