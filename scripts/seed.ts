import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';

const client = new S3Client({
  endpoint: 'http://localhost:4566',
  forcePathStyle: true,
  region: 'us-east-1',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});

const BUCKETS = [
  'my-app-logs',
  'data-warehouse',
  'static-assets',
  'backups-prod',
  'ml-datasets',
  'user-uploads',
  'audit-trail',
  'terraform-state',
  'build-artifacts',
  'media-storage',
];

const OBJECT_TEMPLATES = [
  'logs/{year}/{month}/app.log',
  'logs/{year}/{month}/error.log',
  'data/users.json',
  'data/products.json',
  'data/{year}/export.csv',
  'config/settings.yaml',
  'config/secrets.json.enc',
  'reports/{year}/{month}/summary.pdf',
  'images/avatars/{id}.png',
  'images/banners/hero.jpg',
  'scripts/deploy.sh',
  'scripts/migrate.py',
  'archive/{year}/backup.tar.gz',
  'tmp/processing/{id}.tmp',
  'public/index.html',
  'public/styles.css',
  'public/bundle.js',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function renderTemplate(template: string): string {
  return template
    .replace('{year}', String(randomInt(2022, 2024)))
    .replace('{month}', String(randomInt(1, 12)).padStart(2, '0'))
    .replace('{id}', Math.random().toString(36).slice(2, 10));
}

async function ensureBucket(name: string) {
  try {
    await client.send(new CreateBucketCommand({ Bucket: name }));
    console.log(`  Created bucket: ${name}`);
  } catch (e: unknown) {
    const err = e as { name?: string };
    if (err.name === 'BucketAlreadyOwnedByYou' || err.name === 'BucketAlreadyExists') {
      console.log(`  Bucket already exists: ${name}`);
    } else {
      throw e;
    }
  }
}

async function seedBucket(bucket: string) {
  const count = randomInt(0, 30);
  const templates = [...OBJECT_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, count);
  for (const tpl of templates) {
    const key = renderTemplate(tpl);
    const content = `Seeded content for ${key} in ${bucket}\n`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: content,
        ContentType: 'text/plain',
      })
    );
    process.stdout.write('.');
  }
  if (count > 0) console.log(` ${count} objects`);
  else console.log(' (empty)');
}

async function checkLocalStack() {
  try {
    await client.send(new ListBucketsCommand({}));
  } catch {
    console.error(
      'Cannot connect to LocalStack at http://localhost:4566\n' +
        'Run: pnpm localstack:up\n' +
        'Wait a few seconds for it to start, then retry.'
    );
    process.exit(1);
  }
}

async function main() {
  console.log('Checking LocalStack connection...');
  await checkLocalStack();
  console.log('Connected!\n');

  for (const bucket of BUCKETS) {
    console.log(`Seeding ${bucket}:`);
    await ensureBucket(bucket);
    process.stdout.write('  Objects: ');
    await seedBucket(bucket);
  }

  console.log('\nDone! LocalStack seeded with test data.');
  console.log('Run: pnpm dev:local');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
