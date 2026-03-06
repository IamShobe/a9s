import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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

async function runAws(args: string[]): Promise<string> {
  const env = {
    ...process.env,
    AWS_ACCESS_KEY_ID: 'test',
    AWS_SECRET_ACCESS_KEY: 'test',
    AWS_DEFAULT_REGION: 'us-east-1',
  };
  const { stdout } = await execFileAsync('aws', ['--endpoint-url', 'http://localhost:4566', ...args], {
    env,
    timeout: 5000,
  });
  return stdout;
}

async function ensureManagedPolicy(
  policyName: string,
  policyDocument: Record<string, unknown>,
): Promise<string> {
  const listOut = await runAws([
    'iam',
    'list-policies',
    '--scope',
    'Local',
    '--query',
    `Policies[?PolicyName=='${policyName}'].Arn | [0]`,
    '--output',
    'text',
  ]);
  const existingArn = listOut.trim();
  if (existingArn && existingArn !== 'None') {
    console.log(`  Managed policy already exists: ${policyName}`);
    return existingArn;
  }

  const createOut = await runAws([
    'iam',
    'create-policy',
    '--policy-name',
    policyName,
    '--policy-document',
    JSON.stringify(policyDocument),
    '--output',
    'json',
  ]);
  const parsed = JSON.parse(createOut) as { Policy?: { Arn?: string } };
  const arn = parsed.Policy?.Arn;
  if (!arn) throw new Error(`Failed creating managed policy ${policyName}`);
  console.log(`  Created managed policy: ${policyName}`);
  return arn;
}

async function ensureRole(roleName: string, trustPolicy: Record<string, unknown>) {
  const existing = await runAws([
    'iam',
    'get-role',
    '--role-name',
    roleName,
    '--query',
    'Role.RoleName',
    '--output',
    'text',
  ]).catch(() => '');

  if (existing.trim() === roleName) {
    console.log(`  Role already exists: ${roleName}`);
    return;
  }

  await runAws([
    'iam',
    'create-role',
    '--role-name',
    roleName,
    '--assume-role-policy-document',
    JSON.stringify(trustPolicy),
  ]);
  console.log(`  Created role: ${roleName}`);
}

async function ensureInlineRolePolicy(
  roleName: string,
  policyName: string,
  policyDocument: Record<string, unknown>,
) {
  await runAws([
    'iam',
    'put-role-policy',
    '--role-name',
    roleName,
    '--policy-name',
    policyName,
    '--policy-document',
    JSON.stringify(policyDocument),
  ]);
  console.log(`  Put inline policy ${policyName} on ${roleName}`);
}

async function ensureAttachedRolePolicy(roleName: string, policyArn: string) {
  const attached = await runAws([
    'iam',
    'list-attached-role-policies',
    '--role-name',
    roleName,
    '--query',
    `AttachedPolicies[?PolicyArn=='${policyArn}'].PolicyArn | [0]`,
    '--output',
    'text',
  ]);

  if (attached.trim() === policyArn) {
    console.log(`  Managed policy already attached to ${roleName}`);
    return;
  }

  await runAws([
    'iam',
    'attach-role-policy',
    '--role-name',
    roleName,
    '--policy-arn',
    policyArn,
  ]);
  console.log(`  Attached managed policy to ${roleName}`);
}

async function seedIam() {
  console.log('\nSeeding IAM:');

  const trustPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 'ec2.amazonaws.com' },
        Action: 'sts:AssumeRole',
      },
    ],
  };

  const appReadPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'ReadSomeBuckets',
        Effect: 'Allow',
        Action: ['s3:GetObject', 's3:ListBucket'],
        Resource: [
          'arn:aws:s3:::media-storage',
          'arn:aws:s3:::media-storage/*',
          'arn:aws:s3:::static-assets',
          'arn:aws:s3:::static-assets/*',
        ],
      },
    ],
  };

  const auditPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AuditReadOnly',
        Effect: 'Allow',
        Action: ['s3:GetObject', 's3:ListBucket'],
        Resource: ['arn:aws:s3:::audit-trail', 'arn:aws:s3:::audit-trail/*'],
      },
    ],
  };

  const inlineDeployPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'WriteBuildArtifacts',
        Effect: 'Allow',
        Action: ['s3:PutObject', 's3:DeleteObject', 's3:GetObject'],
        Resource: ['arn:aws:s3:::build-artifacts/*'],
      },
    ],
  };

  const readPolicyArn = await ensureManagedPolicy('A9SAppReadPolicy', appReadPolicy);
  const auditPolicyArn = await ensureManagedPolicy('A9SAuditPolicy', auditPolicy);

  await ensureRole('A9SAppRole', trustPolicy);
  await ensureRole('A9SReadOnlyRole', trustPolicy);

  await ensureInlineRolePolicy('A9SAppRole', 'A9SInlineDeployPolicy', inlineDeployPolicy);
  await ensureAttachedRolePolicy('A9SAppRole', readPolicyArn);
  await ensureAttachedRolePolicy('A9SReadOnlyRole', auditPolicyArn);
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

  await seedIam();

  console.log('\nDone! LocalStack seeded with test data.');
  console.log('Run: pnpm dev:local');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
