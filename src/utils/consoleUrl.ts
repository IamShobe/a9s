/**
 * Opens an AWS console URL using the current CLI credentials via the federation endpoint.
 * Falls back to opening the plain URL if federation fails.
 */
import open from "open";
import { runAwsJsonAsync } from "./aws.js";
import { debugLog } from "./debugLogger.js";

interface AwsCredentials {
  AccessKeyId: string;
  SecretAccessKey: string;
  SessionToken?: string;
}

interface FederationTokenResponse {
  SigninToken: string;
}

async function getCliCredentials(profile?: string): Promise<AwsCredentials | null> {
  try {
    const args = ["configure", "export-credentials", "--format", "process"];
    if (profile && profile !== "$default") args.push("--profile", profile);
    const creds = await runAwsJsonAsync<AwsCredentials>(args);
    if (creds.AccessKeyId && creds.SecretAccessKey) return creds;
    return null;
  } catch {
    return null;
  }
}

async function getFederationSigninToken(creds: AwsCredentials): Promise<string | null> {
  try {
    const session = JSON.stringify({
      sessionId: creds.AccessKeyId,
      sessionKey: creds.SecretAccessKey,
      sessionToken: creds.SessionToken ?? "",
    });
    const url =
      `https://signin.aws.amazon.com/federation?Action=getSigninToken` +
      `&SessionDuration=3600&Session=${encodeURIComponent(session)}`;

    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = (await resp.json()) as FederationTokenResponse;
    return data.SigninToken ?? null;
  } catch {
    return null;
  }
}

export async function openConsoleUrl(
  destinationUrl: string,
  profile?: string,
): Promise<void> {
  try {
    const creds = await getCliCredentials(profile);
    if (creds) {
      const signinToken = await getFederationSigninToken(creds);
      if (signinToken) {
        const federatedUrl =
          `https://signin.aws.amazon.com/federation?Action=login` +
          `&Issuer=a9s&Destination=${encodeURIComponent(destinationUrl)}` +
          `&SigninToken=${encodeURIComponent(signinToken)}`;
        await open(federatedUrl);
        return;
      }
    }
  } catch (e) {
    debugLog("consoleUrl", "federation failed, falling back to plain URL", e);
  }
  // Fallback: open plain URL
  await open(destinationUrl);
}
