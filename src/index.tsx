import React from "react";
import { getDefaultStore } from "jotai";
import { Command, Option } from "@commander-js/extra-typings";
import { App } from "./App.js";
import { SERVICE_REGISTRY, type AwsServiceId } from "./services.js";
import { withFullscreen } from "./utils/withFullscreen.js";
import { ThemeProvider } from "./contexts/ThemeContext.js";
import { cleanupStaleBrowserProfiles } from "./utils/consoleUrl.js";
import { currentlySelectedServiceAtom } from "./state/atoms.js";
import { seedAdapterRoot } from "./hooks/useAdapterStack.js";

const SERVICE_IDS = Object.keys(SERVICE_REGISTRY) as AwsServiceId[];

const program = new Command()
  .name("a9s")
  .description("k9s-style AWS navigator")
  .version("0.1.0")
  .addOption(
    new Option("-s, --service <service>", "AWS service to browse")
      .choices(SERVICE_IDS),
  )
  .addOption(
    new Option(
      "--endpoint-url <url>",
      "Custom endpoint URL (e.g. http://localhost:4566 for LocalStack)",
    ).env("AWS_ENDPOINT_URL"),
  );

program.parse();

// opts() return type is fully inferred from addOption() calls via extra-typings
const options = program.opts();

// Seed initial state before React renders — _resources is always the root
if (options.service) {
  getDefaultStore().set(currentlySelectedServiceAtom, options.service);
  seedAdapterRoot({ adapterId: "_resources", filterText: "", selectedIndex: 0 });
}

// Best-effort cleanup of stale isolated browser profile dirs (non-blocking)
cleanupStaleBrowserProfiles();

void (async () => {
  const { instance, cleanup } = withFullscreen(
    <ThemeProvider>
      <App endpointUrl={options.endpointUrl} />
    </ThemeProvider>,
  );

  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  await instance.waitUntilExit();
  cleanup();
})();
