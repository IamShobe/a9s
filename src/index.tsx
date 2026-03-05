import React from 'react';
import { Command, Option } from '@commander-js/extra-typings';
import { App } from './App.js';
import { SERVICE_REGISTRY, type ServiceId } from './services.js';
import { withFullscreen } from './utils/withFullscreen.js';

const SERVICE_IDS = Object.keys(SERVICE_REGISTRY) as ServiceId[];

const program = new Command()
  .name('a9s')
  .description('k9s-style AWS navigator')
  .version('0.1.0')
  .addOption(
    new Option('-s, --service <service>', 'AWS service to browse')
      .choices(SERVICE_IDS)
      .default('s3' satisfies ServiceId)
  )
  .addOption(
    new Option(
      '--endpoint-url <url>',
      'Custom endpoint URL (e.g. http://localhost:4566 for LocalStack)'
    ).env('AWS_ENDPOINT_URL')
  );

program.parse();

// opts() return type is fully inferred from addOption() calls via extra-typings
const options = program.opts();

void (async () => {
  const { instance, cleanup } = withFullscreen(
    <App
      initialService={options.service}
      endpointUrl={options.endpointUrl}
    />
  );

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  await instance.waitUntilExit();
  cleanup();
})();
