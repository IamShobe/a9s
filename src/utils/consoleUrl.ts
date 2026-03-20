/**
 * Opens an AWS console URL using the current CLI credentials via the federation endpoint.
 * Federation tokens are cached for 55 minutes to avoid redundant network calls.
 * Falls back to opening the plain URL if federation fails.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import { spawn } from "child_process";
import open from "open";
import { runAwsJsonAsync } from "./aws.js";
import { debugLog } from "./debugLogger.js";

const A9S_BROWSER_PREFIX = "a9s-browser-";

function createIsolatedProfileDir(): string {
  const dir = join(tmpdir(), `${A9S_BROWSER_PREFIX}${randomBytes(4).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const CHROME_PATHS_DARWIN = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const CHROME_PATHS_LINUX = [
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
];

function findChromeBinary(): string | null {
  if (process.platform === "darwin") {
    for (const p of CHROME_PATHS_DARWIN) {
      if (existsSync(p)) return p;
    }
    return null;
  }
  // On Linux, rely on PATH — spawn will fail if not found
  return CHROME_PATHS_LINUX[0];
}

function openInIsolatedChrome(url: string): boolean {
  const chromeBin = findChromeBinary();
  if (!chromeBin) return false;

  try {
    const profileDir = createIsolatedProfileDir();
    const child = spawn(chromeBin, [
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      url,
    ], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return true;
  } catch (e) {
    debugLog("consoleUrl", "isolated Chrome launch failed, falling back to open()", e);
    return false;
  }
}

export function cleanupStaleBrowserProfiles(): void {
  try {
    const tmp = tmpdir();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const entry of readdirSync(tmp)) {
      if (!entry.startsWith(A9S_BROWSER_PREFIX)) continue;
      const full = join(tmp, entry);
      try {
        if (statSync(full).mtimeMs < cutoff) {
          rmSync(full, { recursive: true, force: true });
        }
      } catch { /* ignore per-entry errors */ }
    }
  } catch { /* ignore */ }
}

interface AwsCredentials {
  AccessKeyId: string;
  SecretAccessKey: string;
  SessionToken?: string;
}

interface FederationTokenResponse {
  SigninToken: string;
}

// Cache keyed by profile; tokens are valid for 3600s, we evict at 55 min to be safe.
const TOKEN_TTL_MS = 55 * 60 * 1000;
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

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
    const cacheKey = profile ?? "$default";
    const cached = tokenCache.get(cacheKey);
    let signinToken: string | null = cached && cached.expiresAt > Date.now() ? cached.token : null;

    if (!signinToken) {
      const creds = await getCliCredentials(profile);
      if (creds) {
        signinToken = await getFederationSigninToken(creds);
        if (signinToken) {
          tokenCache.set(cacheKey, { token: signinToken, expiresAt: Date.now() + TOKEN_TTL_MS });
        }
      }
    }

    if (signinToken) {
      const federatedUrl =
        `https://signin.aws.amazon.com/federation?Action=login` +
        `&Issuer=a9s&Destination=${encodeURIComponent(destinationUrl)}` +
        `&SigninToken=${encodeURIComponent(signinToken)}`;
      if (openInIsolatedChrome(federatedUrl)) return;
      await open(federatedUrl);
      return;
    }
  } catch (e) {
    debugLog("consoleUrl", "federation failed, falling back to plain URL", e);
  }
  if (openInIsolatedChrome(destinationUrl)) return;
  await open(destinationUrl);
}
