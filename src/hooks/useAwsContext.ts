import { useEffect, useState } from "react";
import { runAwsCli } from "../utils/aws.js";

interface AwsContext {
  accountName: string;
  accountId: string;
  awsProfile: string;
  currentIdentity: string;
  region: string;
}

const DEFAULT_REGION =
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";

export function useAwsContext(endpointUrl?: string, selectedRegion?: string, selectedProfile?: string): AwsContext {
  const explicitProfile =
    selectedProfile && selectedProfile !== "$default"
      ? selectedProfile
      : undefined;
  const envProfile = selectedProfile ?? process.env.AWS_PROFILE ?? "default";
  const resolvedRegion = selectedRegion ?? DEFAULT_REGION;
  const [context, setContext] = useState<AwsContext>({
    accountName: "Resolving",
    accountId: "------------",
    awsProfile: envProfile,
    currentIdentity: "resolving",
    region: resolvedRegion,
  });

  useEffect(() => {
    let alive = true;

    void (async () => {
      if (endpointUrl) {
        const profile = explicitProfile ?? process.env.AWS_PROFILE ?? "local";
        if (!alive) return;
        setContext({
          accountName: `LocalStack (${profile})`,
          accountId: process.env.AWS_ACCOUNT_ID ?? "000000000000",
          awsProfile: selectedProfile ?? profile,
          currentIdentity: process.env.AWS_ACCESS_KEY_ID ?? profile,
          region: resolvedRegion,
        });
        return;
      }

      const profile = explicitProfile ?? process.env.AWS_PROFILE ?? "default";
      const [stsOut, aliasOut] = await Promise.all([
        runAwsCli(
          ["sts", "get-caller-identity", "--output", "json"],
          1500,
        ),
        runAwsCli(
          ["iam", "list-account-aliases", "--output", "json"],
          1500,
        ),
      ]);

      let accountId = "";
      let userId = "";
      let arn = "";
      if (stsOut) {
        try {
          const parsed = JSON.parse(stsOut) as {
            Account?: string;
            UserId?: string;
            Arn?: string;
          };
          accountId = parsed.Account ?? "";
          userId = parsed.UserId ?? "";
          arn = parsed.Arn ?? "";
        } catch {
          // ignore parse issues, fallback below
        }
      }

      let alias = "";
      if (aliasOut) {
        try {
          const parsed = JSON.parse(aliasOut) as { AccountAliases?: string[] };
          alias = parsed.AccountAliases?.[0] ?? "";
        } catch {
          // ignore parse issues, fallback below
        }
      }

      const identity =
        alias || profile || (accountId ? "AWS Account" : "Unknown Account");
      const currentIdentity =
        arn || userId || profile || "unknown";
      if (!alive) return;
      setContext({
        accountName: identity,
        accountId: accountId || "------------",
        awsProfile: selectedProfile ?? profile,
        currentIdentity,
        region: resolvedRegion,
      });
    })();

    return () => {
      alive = false;
    };
  }, [endpointUrl, explicitProfile, resolvedRegion, selectedProfile]);

  return context;
}
