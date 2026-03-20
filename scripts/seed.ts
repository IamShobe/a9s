import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  ListBucketsCommand,
} from "@aws-sdk/client-s3";
import pl from "nodejs-polars";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

const client = new S3Client({
  endpoint: "http://localhost:4566",
  forcePathStyle: true,
  region: "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

const BUCKETS = [
  "my-app-logs",
  "data-warehouse",
  "static-assets",
  "backups-prod",
  "ml-datasets",
  "user-uploads",
  "audit-trail",
  "terraform-state",
  "build-artifacts",
  "media-storage",
];

const OBJECT_TEMPLATES = [
  "logs/{year}/{month}/app.log",
  "logs/{year}/{month}/error.log",
  "data/users.json",
  "data/products.json",
  "data/{year}/export.csv",
  "config/settings.yaml",
  "config/secrets.json.enc",
  "reports/{year}/{month}/summary.pdf",
  "images/avatars/{id}.png",
  "images/banners/hero.jpg",
  "scripts/deploy.sh",
  "scripts/migrate.py",
  "archive/{year}/backup.tar.gz",
  "tmp/processing/{id}.tmp",
  "public/index.html",
  "public/styles.css",
  "public/bundle.js",
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function renderTemplate(template: string): string {
  return template
    .replace("{year}", String(randomInt(2022, 2024)))
    .replace("{month}", String(randomInt(1, 12)).padStart(2, "0"))
    .replace("{id}", Math.random().toString(36).slice(2, 10));
}

async function ensureBucket(name: string) {
  try {
    await client.send(new CreateBucketCommand({ Bucket: name }));
    console.log(`  Created bucket: ${name}`);
  } catch (e: unknown) {
    const err = e as { name?: string };
    if (err.name === "BucketAlreadyOwnedByYou" || err.name === "BucketAlreadyExists") {
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
        ContentType: "text/plain",
      }),
    );
    process.stdout.write(".");
  }
  if (count > 0) console.log(` ${count} objects`);
  else console.log(" (empty)");
}

async function checkLocalStack() {
  try {
    await client.send(new ListBucketsCommand({}));
  } catch {
    console.error(
      "Cannot connect to LocalStack at http://localhost:4566\n" +
        "Run: pnpm localstack:up\n" +
        "Wait a few seconds for it to start, then retry.",
    );
    process.exit(1);
  }
}

async function runAws(args: string[], timeoutMs = 10000): Promise<string> {
  const env = {
    ...process.env,
    AWS_ACCESS_KEY_ID: "test",
    AWS_SECRET_ACCESS_KEY: "test",
    AWS_DEFAULT_REGION: "us-east-1",
  };
  const { stdout } = await execFileAsync(
    "aws",
    ["--endpoint-url", "http://localhost:4566", ...args],
    {
      env,
      timeout: timeoutMs,
    },
  );
  return stdout;
}

async function ensureManagedPolicy(
  policyName: string,
  policyDocument: Record<string, unknown>,
): Promise<string> {
  const listOut = await runAws([
    "iam",
    "list-policies",
    "--scope",
    "Local",
    "--query",
    `Policies[?PolicyName=='${policyName}'].Arn | [0]`,
    "--output",
    "text",
  ]);
  const existingArn = listOut.trim();
  if (existingArn && existingArn !== "None") {
    console.log(`  Managed policy already exists: ${policyName}`);
    return existingArn;
  }

  const createOut = await runAws([
    "iam",
    "create-policy",
    "--policy-name",
    policyName,
    "--policy-document",
    JSON.stringify(policyDocument),
    "--output",
    "json",
  ]);
  const parsed = JSON.parse(createOut) as { Policy?: { Arn?: string } };
  const arn = parsed.Policy?.Arn;
  if (!arn) throw new Error(`Failed creating managed policy ${policyName}`);
  console.log(`  Created managed policy: ${policyName}`);
  return arn;
}

async function ensureRole(roleName: string, trustPolicy: Record<string, unknown>) {
  const existing = await runAws([
    "iam",
    "get-role",
    "--role-name",
    roleName,
    "--query",
    "Role.RoleName",
    "--output",
    "text",
  ]).catch(() => "");

  if (existing.trim() === roleName) {
    console.log(`  Role already exists: ${roleName}`);
    return;
  }

  await runAws([
    "iam",
    "create-role",
    "--role-name",
    roleName,
    "--assume-role-policy-document",
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
    "iam",
    "put-role-policy",
    "--role-name",
    roleName,
    "--policy-name",
    policyName,
    "--policy-document",
    JSON.stringify(policyDocument),
  ]);
  console.log(`  Put inline policy ${policyName} on ${roleName}`);
}

async function ensureAttachedRolePolicy(roleName: string, policyArn: string) {
  const attached = await runAws([
    "iam",
    "list-attached-role-policies",
    "--role-name",
    roleName,
    "--query",
    `AttachedPolicies[?PolicyArn=='${policyArn}'].PolicyArn | [0]`,
    "--output",
    "text",
  ]);

  if (attached.trim() === policyArn) {
    console.log(`  Managed policy already attached to ${roleName}`);
    return;
  }

  await runAws(["iam", "attach-role-policy", "--role-name", roleName, "--policy-arn", policyArn]);
  console.log(`  Attached managed policy to ${roleName}`);
}

async function seedDynamoDB() {
  console.log("\nSeeding DynamoDB:");

  const tables = [
    {
      name: "Users",
      pkName: "userId",
      skName: "timestamp",
      items: [
        { userId: "user-001", timestamp: "2024-01-15T10:00:00Z", email: "alice@example.com", role: "admin" },
        { userId: "user-002", timestamp: "2024-01-16T14:30:00Z", email: "bob@example.com", role: "user" },
        { userId: "user-003", timestamp: "2024-01-17T09:45:00Z", email: "charlie@example.com", role: "user" },
      ],
    },
    {
      name: "Orders",
      pkName: "orderId",
      items: [
        { orderId: "order-001", status: "completed", total: "99.99", items: "3" },
        { orderId: "order-002", status: "pending", total: "149.50", items: "5" },
        { orderId: "order-003", status: "shipped", total: "299.00", items: "1" },
      ],
    },
  ];

  for (const table of tables) {
    // Try to create table
    try {
      const keySchema = [{ AttributeName: table.pkName, KeyType: "HASH" }];
      const attrDefs = [{ AttributeName: table.pkName, AttributeType: "S" }];

      if (table.skName) {
        keySchema.push({ AttributeName: table.skName, KeyType: "RANGE" });
        attrDefs.push({ AttributeName: table.skName, AttributeType: "S" });
      }

      await runAws(
        [
          "dynamodb",
          "create-table",
          "--table-name",
          table.name,
          "--key-schema",
          JSON.stringify(keySchema),
          "--attribute-definitions",
          JSON.stringify(attrDefs),
          "--billing-mode",
          "PAY_PER_REQUEST",
          "--output",
          "json",
        ],
        15000,
      );
      console.log(`  Created table: ${table.name}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err.message?.includes("already exists")) {
        console.log(`  Table already exists: ${table.name}`);
      } else {
        throw e;
      }
    }

    // Add items to the table (whether newly created or existing)
    let addedCount = 0;
    for (const item of table.items) {
      const itemObj: Record<string, { S: string }> = {};
      for (const [k, v] of Object.entries(item)) {
        itemObj[k] = { S: String(v) };
      }

      try {
        await runAws(
          [
            "dynamodb",
            "put-item",
            "--table-name",
            table.name,
            "--item",
            JSON.stringify(itemObj),
          ],
          10000,
        );
        addedCount++;
      } catch (e: unknown) {
        console.log(`    Warning: could not add item: ${(e as Error).message}`);
      }
    }
    console.log(`    Added ${addedCount}/${table.items.length} items`);
  }
}

async function seedRoute53() {
  console.log("\nSeeding Route53:");

  const zones = [
    { name: "example.com.", isPrivate: false },
    { name: "internal.local.", isPrivate: true },
    { name: "staging.test.", isPrivate: false },
  ];

  for (const zone of zones) {
    try {
      // First check if zone already exists
      const listOut = await runAws(
        [
          "route53",
          "list-hosted-zones",
          "--output",
          "json",
        ],
        10000,
      ).catch(() => "");

      let zoneId: string | undefined;
      if (listOut) {
        try {
          const listParsed = JSON.parse(listOut) as {
            HostedZones?: Array<{ Id: string; Name: string }>;
          };
          const existingZone = listParsed.HostedZones?.find((z) => z.Name === zone.name);
          if (existingZone) {
            zoneId = existingZone.Id;
            console.log(`  Hosted zone already exists: ${zone.name}`);
          }
        } catch (e) {
          // Ignore parse errors
          console.log(`  List zones error: ${(e as Error).message}`);
        }
      }

      // If not found, create it
      if (!zoneId) {
        const createOut = await runAws(
          [
            "route53",
            "create-hosted-zone",
            "--name",
            zone.name,
            "--caller-reference",
            `zone-${Date.now()}-${Math.random()}`,
            "--hosted-zone-config",
            JSON.stringify({ PrivateZone: zone.isPrivate, Comment: `Test zone for ${zone.name}` }),
            "--output",
            "json",
          ],
          10000,
        );
        const parsed = JSON.parse(createOut) as { HostedZone?: { Id?: string } };
        zoneId = parsed.HostedZone?.Id;
        if (!zoneId) throw new Error(`Failed creating hosted zone ${zone.name}`);
        console.log(`  Created hosted zone: ${zone.name} (${zoneId})`);
      }

      // Add some DNS records to the zone
      const records = [
        { name: `www.${zone.name}`, type: "A", value: "192.0.2.1" },
        { name: `api.${zone.name}`, type: "A", value: "192.0.2.2" },
        { name: `mail.${zone.name}`, type: "A", value: "192.0.2.3" },
        { name: zone.name, type: "MX", value: "10 mail.example.com." },
      ];

      for (const record of records) {
        try {
          await runAws(
            [
              "route53",
              "change-resource-record-sets",
              "--hosted-zone-id",
              zoneId,
              "--change-batch",
              JSON.stringify({
                Changes: [
                  {
                    Action: "UPSERT",
                    ResourceRecordSet: {
                      Name: record.name,
                      Type: record.type,
                      TTL: 300,
                      ResourceRecords: [{ Value: record.value }],
                    },
                  },
                ],
              }),
            ],
            10000,
          );
          console.log(`    Ensured record: ${record.name} (${record.type})`);
        } catch (e: unknown) {
          const err = e as { message?: string };
          console.log(`    Warning adding record ${record.name}: ${err.message ?? String(e)}`);
        }
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.error(`  Error seeding zone ${zone.name}: ${err.message ?? String(e)}`);
    }
  }
}

async function seedSecretsManager() {
  console.log("\nSeeding Secrets Manager:");

  const secrets = [
    { name: "app/db-password", value: "s3cr3tP@ssword123" },
    { name: "app/api-key", value: "sk-test-abc123xyz" },
    { name: "app/jwt-secret", value: "super-secret-jwt-key-do-not-share" },
    { name: "infra/config", value: JSON.stringify({ host: "localhost", port: 5432, db: "app" }) },
    {
      name: "prod/tls-cert",
      value: "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
    },
    { name: "monitoring/grafana-api-key", value: "glsa_test123456" },
  ];

  for (const secret of secrets) {
    try {
      await runAws([
        "secretsmanager",
        "create-secret",
        "--name",
        secret.name,
        "--secret-string",
        secret.value,
      ]);
      console.log(`  Created secret: ${secret.name}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err.message?.includes("ResourceExistsException")) {
        console.log(`  Secret already exists: ${secret.name}`);
      } else {
        throw e;
      }
    }
  }
}

async function seedIam() {
  console.log("\nSeeding IAM:");

  const trustPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "ec2.amazonaws.com" },
        Action: "sts:AssumeRole",
      },
    ],
  };

  const appReadPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "ReadSomeBuckets",
        Effect: "Allow",
        Action: ["s3:GetObject", "s3:ListBucket"],
        Resource: [
          "arn:aws:s3:::media-storage",
          "arn:aws:s3:::media-storage/*",
          "arn:aws:s3:::static-assets",
          "arn:aws:s3:::static-assets/*",
        ],
      },
    ],
  };

  const auditPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "AuditReadOnly",
        Effect: "Allow",
        Action: ["s3:GetObject", "s3:ListBucket"],
        Resource: ["arn:aws:s3:::audit-trail", "arn:aws:s3:::audit-trail/*"],
      },
    ],
  };

  const inlineDeployPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "WriteBuildArtifacts",
        Effect: "Allow",
        Action: ["s3:PutObject", "s3:DeleteObject", "s3:GetObject"],
        Resource: ["arn:aws:s3:::build-artifacts/*"],
      },
    ],
  };

  const readPolicyArn = await ensureManagedPolicy("A9SAppReadPolicy", appReadPolicy);
  const auditPolicyArn = await ensureManagedPolicy("A9SAuditPolicy", auditPolicy);

  await ensureRole("A9SAppRole", trustPolicy);
  await ensureRole("A9SReadOnlyRole", trustPolicy);

  await ensureInlineRolePolicy("A9SAppRole", "A9SInlineDeployPolicy", inlineDeployPolicy);
  await ensureAttachedRolePolicy("A9SAppRole", readPolicyArn);
  await ensureAttachedRolePolicy("A9SReadOnlyRole", auditPolicyArn);
}

async function makeLambdaZip(code: string): Promise<string> {
  const workDir = join(tmpdir(), `a9s_lambda_seed_${Date.now()}`);
  await mkdir(workDir, { recursive: true });
  const handlerPath = join(workDir, "index.js");
  const zipPath = join(workDir, "handler.zip");
  await writeFile(handlerPath, code);
  await execFileAsync("zip", ["-j", zipPath, handlerPath]);
  return zipPath;
}

async function seedLambda() {
  console.log("\nSeeding Lambda:");

  const lambdaRole = "arn:aws:iam::000000000000:role/lambda-role";

  const functions = [
    {
      name: "api-handler",
      description: "Main API handler",
      env: { LOG_LEVEL: "info", STAGE: "local", DB_HOST: "localhost" },
      code: `exports.handler = async (event) => ({ statusCode: 200, body: JSON.stringify({ message: "ok", event }) });`,
    },
    {
      name: "data-processor",
      description: "Batch data processor",
      env: { BATCH_SIZE: "100", QUEUE_URL: "https://sqs.us-east-1.amazonaws.com/000000000000/jobs" },
      code: `exports.handler = async (event) => { console.log("Processing", event); return { processed: true }; };`,
    },
    {
      name: "auth-validator",
      description: "JWT token validator",
      env: { JWT_SECRET: "localstack-test-secret", TOKEN_EXPIRY: "3600" },
      code: `exports.handler = async (event) => { const token = event.token || ""; return { valid: token.length > 0 }; };`,
    },
  ];

  for (const fn of functions) {
    let zipPath: string | undefined;
    try {
      zipPath = await makeLambdaZip(fn.code);
      await runAws(
        [
          "lambda",
          "create-function",
          "--function-name",
          fn.name,
          "--runtime",
          "nodejs20.x",
          "--role",
          lambdaRole,
          "--handler",
          "index.handler",
          "--description",
          fn.description,
          "--zip-file",
          `fileb://${zipPath}`,
          "--environment",
          JSON.stringify({ Variables: fn.env }),
          "--output",
          "json",
        ],
        15000,
      );
      console.log(`  Created function: ${fn.name}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (
        err.message?.includes("already exists") ||
        err.message?.includes("ResourceConflictException")
      ) {
        console.log(`  Function already exists: ${fn.name}`);
      } else {
        console.log(`  Warning creating ${fn.name}: ${err.message ?? String(e)}`);
      }
    } finally {
      if (zipPath) await rm(join(zipPath, ".."), { recursive: true, force: true });
    }
  }
}

async function seedECS() {
  console.log("\nSeeding ECS:");

  // Create cluster
  try {
    await runAws(["ecs", "create-cluster", "--cluster-name", "local-cluster", "--output", "json"], 10000);
    console.log("  Created cluster: local-cluster");
  } catch (e: unknown) {
    const err = e as { message?: string };
    if (err.message?.includes("ClusterAlreadyExistsException")) {
      console.log("  Cluster already exists: local-cluster");
    } else {
      console.log(`  Warning creating cluster: ${err.message ?? String(e)}`);
    }
  }

  // Register task definitions
  const taskDefs = [
    {
      family: "web-app",
      containers: [{ name: "web", image: "nginx:latest", cpu: 256, memory: 512 }],
    },
    {
      family: "worker",
      containers: [{ name: "worker", image: "alpine:latest", cpu: 128, memory: 256 }],
    },
  ];

  for (const td of taskDefs) {
    try {
      await runAws(
        [
          "ecs",
          "register-task-definition",
          "--family",
          td.family,
          "--container-definitions",
          JSON.stringify(td.containers),
          "--cpu",
          String(td.containers[0]!.cpu),
          "--memory",
          String(td.containers[0]!.memory),
          "--network-mode",
          "bridge",
          "--output",
          "json",
        ],
        10000,
      );
      console.log(`  Registered task definition: ${td.family}`);
    } catch (e: unknown) {
      console.log(`  Warning registering task def ${td.family}: ${(e as Error).message}`);
    }
  }

  // Create services
  const services = [
    { name: "web-service", taskDef: "web-app", count: 2 },
    { name: "worker-service", taskDef: "worker", count: 1 },
  ];

  for (const svc of services) {
    try {
      await runAws(
        [
          "ecs",
          "create-service",
          "--cluster",
          "local-cluster",
          "--service-name",
          svc.name,
          "--task-definition",
          svc.taskDef,
          "--desired-count",
          String(svc.count),
          "--output",
          "json",
        ],
        10000,
      );
      console.log(`  Created service: ${svc.name}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (
        err.message?.includes("ServiceAlreadyExists") ||
        err.message?.includes("already exists")
      ) {
        console.log(`  Service already exists: ${svc.name}`);
      } else {
        console.log(`  Warning creating service ${svc.name}: ${err.message ?? String(e)}`);
      }
    }
  }
}

async function seedCloudWatchLogs() {
  console.log("\nSeeding CloudWatch Logs:");

  const logGroups = [
    { name: "/app/api-handler", retention: 7 },
    { name: "/app/data-processor", retention: 14 },
    { name: "/aws/lambda/api-handler", retention: 30 },
  ];

  for (const group of logGroups) {
    // Create log group
    try {
      await runAws(
        ["logs", "create-log-group", "--log-group-name", group.name, "--output", "json"],
        10000,
      );
      console.log(`  Created log group: ${group.name}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err.message?.includes("already exists") || err.message?.includes("ResourceAlreadyExists")) {
        console.log(`  Log group already exists: ${group.name}`);
      } else {
        console.log(`  Warning creating log group ${group.name}: ${err.message ?? String(e)}`);
      }
    }

    // Set retention
    try {
      await runAws(
        [
          "logs",
          "put-retention-policy",
          "--log-group-name",
          group.name,
          "--retention-in-days",
          String(group.retention),
        ],
        10000,
      );
    } catch {
      // ignore
    }

    // Create log streams and add events
    const streams = [`${new Date().toISOString().slice(0, 10)}/stream-1`, `${new Date().toISOString().slice(0, 10)}/stream-2`];
    for (const streamName of streams) {
      try {
        await runAws(
          [
            "logs",
            "create-log-stream",
            "--log-group-name",
            group.name,
            "--log-stream-name",
            streamName,
          ],
          10000,
        );

        // Add sample log events
        const now = Date.now();
        const events = [
          { timestamp: now - 60000, message: `[INFO] Service started` },
          { timestamp: now - 30000, message: `[INFO] Processing request id=abc123 path=/api/data` },
          { timestamp: now - 15000, message: `[DEBUG] DB query took 42ms` },
          { timestamp: now - 5000, message: `[INFO] Request completed status=200 duration=58ms` },
          { timestamp: now, message: `[INFO] Health check OK` },
        ];

        await runAws(
          [
            "logs",
            "put-log-events",
            "--log-group-name",
            group.name,
            "--log-stream-name",
            streamName,
            "--log-events",
            JSON.stringify(events),
          ],
          10000,
        );
        console.log(`    Created stream with events: ${streamName}`);
      } catch (e: unknown) {
        console.log(`    Warning with stream ${streamName}: ${(e as Error).message}`);
      }
    }
  }
}

async function seedEBS() {
  console.log("\nSeeding EBS:");

  const volumes = [
    {
      size: 50,
      az: "us-east-1a",
      type: "gp3",
      tags: [
        { Key: "Name", Value: "prod-app-data" },
        { Key: "Env", Value: "prod" },
        { Key: "Service", Value: "api" },
      ],
    },
    {
      size: 20,
      az: "us-east-1b",
      type: "gp3",
      tags: [
        { Key: "Name", Value: "dev-database" },
        { Key: "Env", Value: "dev" },
        { Key: "Service", Value: "postgres" },
      ],
    },
    {
      size: 100,
      az: "us-east-1a",
      type: "st1",
      tags: [
        { Key: "Name", Value: "backup-archive" },
        { Key: "Env", Value: "prod" },
        { Key: "Purpose", Value: "backup" },
      ],
    },
  ];

  const createdVolumeIds: string[] = [];

  for (const vol of volumes) {
    const name = vol.tags.find((t) => t.Key === "Name")?.Value ?? "unnamed";
    try {
      const out = await runAws(
        [
          "ec2",
          "create-volume",
          "--size",
          String(vol.size),
          "--availability-zone",
          vol.az,
          "--volume-type",
          vol.type,
          "--tag-specifications",
          JSON.stringify([{ ResourceType: "volume", Tags: vol.tags }]),
          "--output",
          "json",
        ],
        10000,
      );
      const result = JSON.parse(out) as { VolumeId: string };
      createdVolumeIds.push(result.VolumeId);
      console.log(`  Created volume: ${name} (${result.VolumeId}, ${vol.size} GiB ${vol.type})`);
    } catch (e: unknown) {
      console.log(`  Warning creating volume ${name}: ${(e as Error).message}`);
    }
  }

  // Create a snapshot of the first volume
  if (createdVolumeIds[0]) {
    try {
      const out = await runAws(
        [
          "ec2",
          "create-snapshot",
          "--volume-id",
          createdVolumeIds[0],
          "--description",
          "Daily backup - prod-app-data",
          "--tag-specifications",
          JSON.stringify([{
            ResourceType: "snapshot",
            Tags: [{ Key: "Name", Value: "prod-app-data-snap" }, { Key: "Env", Value: "prod" }],
          }]),
          "--output",
          "json",
        ],
        10000,
      );
      const snap = JSON.parse(out) as { SnapshotId: string };
      console.log(`  Created snapshot: ${snap.SnapshotId} for ${createdVolumeIds[0]}`);
    } catch (e: unknown) {
      console.log(`  Warning creating snapshot: ${(e as Error).message}`);
    }
  }
}

async function getDefaultVpcInfo(): Promise<{ vpcId: string; subnetIds: string[] } | null> {
  try {
    const vpcOut = await runAws(
      [
        "ec2",
        "describe-vpcs",
        "--filters",
        "Name=isDefault,Values=true",
        "--query",
        "Vpcs[0].VpcId",
        "--output",
        "text",
      ],
      10000,
    );
    const vpcId = vpcOut.trim();
    if (!vpcId || vpcId === "None") return null;

    const subnetOut = await runAws(
      [
        "ec2",
        "describe-subnets",
        "--filters",
        `Name=vpc-id,Values=${vpcId}`,
        "--query",
        "Subnets[*].SubnetId",
        "--output",
        "json",
      ],
      10000,
    );
    const subnetIds = JSON.parse(subnetOut) as string[];
    return { vpcId, subnetIds };
  } catch {
    return null;
  }
}

async function seedELB() {
  console.log("\nSeeding ELB/ALB/NLB:");

  const vpc = await getDefaultVpcInfo();
  if (!vpc || vpc.subnetIds.length < 2) {
    console.log("  Skipping ELB seed: need at least 2 subnets in the default VPC");
    return;
  }

  const { vpcId, subnetIds } = vpc;
  const subnet1 = subnetIds[0]!;
  const subnet2 = subnetIds[1]!;

  console.log(`  Using VPC: ${vpcId}, subnets: ${subnet1}, ${subnet2}`);

  // Create security group for ALB
  let sgId = "";
  try {
    const sgOut = await runAws(
      [
        "ec2",
        "create-security-group",
        "--group-name",
        "local-alb-sg",
        "--description",
        "Local ALB Security Group",
        "--vpc-id",
        vpcId,
        "--output",
        "json",
      ],
      10000,
    );
    sgId = (JSON.parse(sgOut) as { GroupId: string }).GroupId;
    console.log(`  Created security group: ${sgId}`);

    // Allow inbound 80 and 443
    for (const port of [80, 443]) {
      await runAws(
        [
          "ec2",
          "authorize-security-group-ingress",
          "--group-id",
          sgId,
          "--protocol",
          "tcp",
          "--port",
          String(port),
          "--cidr",
          "0.0.0.0/0",
        ],
        10000,
      ).catch(() => {}); // ignore if rule already exists
    }
  } catch (e: unknown) {
    const err = e as { message?: string };
    if (err.message?.includes("already exists") || err.message?.includes("InvalidGroup.Duplicate")) {
      // Get existing SG
      try {
        const listOut = await runAws(
          [
            "ec2",
            "describe-security-groups",
            "--filters",
            "Name=group-name,Values=local-alb-sg",
            `Name=vpc-id,Values=${vpcId}`,
            "--query",
            "SecurityGroups[0].GroupId",
            "--output",
            "text",
          ],
          10000,
        );
        sgId = listOut.trim();
        console.log(`  Security group already exists: ${sgId}`);
      } catch {
        console.log("  Warning: could not get existing security group");
      }
    } else {
      console.log(`  Warning creating security group: ${err.message ?? String(e)}`);
    }
  }

  // Create ALB
  let albArn = "";
  try {
    const albArgs = [
      "elbv2",
      "create-load-balancer",
      "--name",
      "local-alb",
      "--type",
      "application",
      "--scheme",
      "internet-facing",
      "--subnets",
      subnet1,
      subnet2,
      "--output",
      "json",
    ];
    if (sgId) albArgs.splice(albArgs.indexOf("--output"), 0, "--security-groups", sgId);

    const albOut = await runAws(albArgs, 15000);
    const alb = (JSON.parse(albOut) as { LoadBalancers: Array<{ LoadBalancerArn: string }> })
      .LoadBalancers?.[0];
    albArn = alb?.LoadBalancerArn ?? "";
    console.log(`  Created ALB: local-alb (${albArn.slice(-20)}...)`);
  } catch (e: unknown) {
    const err = e as { message?: string };
    if (err.message?.includes("already exists") || err.message?.includes("DuplicateLoadBalancer")) {
      console.log("  ALB already exists: local-alb");
      try {
        const listOut = await runAws(
          ["elbv2", "describe-load-balancers", "--names", "local-alb", "--output", "json"],
          10000,
        );
        albArn =
          (JSON.parse(listOut) as { LoadBalancers: Array<{ LoadBalancerArn: string }> })
            .LoadBalancers?.[0]?.LoadBalancerArn ?? "";
      } catch {
        /* ignore */
      }
    } else {
      console.log(`  Warning creating ALB: ${err.message ?? String(e)}`);
    }
  }

  // Create NLB
  try {
    await runAws(
      [
        "elbv2",
        "create-load-balancer",
        "--name",
        "local-nlb",
        "--type",
        "network",
        "--scheme",
        "internet-facing",
        "--subnets",
        subnet1,
        "--output",
        "json",
      ],
      15000,
    );
    console.log("  Created NLB: local-nlb");
  } catch (e: unknown) {
    const err = e as { message?: string };
    if (err.message?.includes("already exists") || err.message?.includes("DuplicateLoadBalancer")) {
      console.log("  NLB already exists: local-nlb");
    } else {
      console.log(`  Warning creating NLB: ${err.message ?? String(e)}`);
    }
  }

  // Create target groups and attach to ALB
  const targetGroups = [
    { name: "web-tg", protocol: "HTTP", port: 80 },
    { name: "api-tg", protocol: "HTTP", port: 8080 },
  ];

  for (const tg of targetGroups) {
    let tgArn = "";
    try {
      const tgOut = await runAws(
        [
          "elbv2",
          "create-target-group",
          "--name",
          tg.name,
          "--protocol",
          tg.protocol,
          "--port",
          String(tg.port),
          "--vpc-id",
          vpcId,
          "--target-type",
          "ip",
          "--health-check-path",
          "/health",
          "--output",
          "json",
        ],
        10000,
      );
      tgArn =
        (JSON.parse(tgOut) as { TargetGroups: Array<{ TargetGroupArn: string }> })
          .TargetGroups?.[0]?.TargetGroupArn ?? "";
      console.log(`  Created target group: ${tg.name} (${tg.protocol}:${tg.port})`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err.message?.includes("already exists") || err.message?.includes("DuplicateTargetGroup")) {
        console.log(`  Target group already exists: ${tg.name}`);
        try {
          const listOut = await runAws(
            ["elbv2", "describe-target-groups", "--names", tg.name, "--output", "json"],
            10000,
          );
          tgArn =
            (JSON.parse(listOut) as { TargetGroups: Array<{ TargetGroupArn: string }> })
              .TargetGroups?.[0]?.TargetGroupArn ?? "";
        } catch {
          /* ignore */
        }
      } else {
        console.log(`  Warning creating target group ${tg.name}: ${err.message ?? String(e)}`);
      }
    }

    // Register a dummy IP target so the health view shows something
    if (tgArn) {
      try {
        await runAws(
          [
            "elbv2",
            "register-targets",
            "--target-group-arn",
            tgArn,
            "--targets",
            `Id=10.0.0.${tg.port === 80 ? "10" : "11"},Port=${tg.port}`,
            "--output",
            "json",
          ],
          10000,
        );
        console.log(`    Registered target for ${tg.name}`);
      } catch {
        /* ignore - target registration errors are non-critical */
      }
    }

    // Create listener on ALB pointing to first TG
    if (albArn && tgArn && tg.port === 80) {
      try {
        await runAws(
          [
            "elbv2",
            "create-listener",
            "--load-balancer-arn",
            albArn,
            "--protocol",
            "HTTP",
            "--port",
            "80",
            "--default-actions",
            JSON.stringify([{ Type: "forward", TargetGroupArn: tgArn }]),
            "--output",
            "json",
          ],
          10000,
        );
        console.log("    Created HTTP:80 listener on local-alb");
      } catch {
        /* ignore duplicate listeners */
      }
    }
  }
}

async function seedSQS() {
  console.log("\nSeeding SQS:");

  const queues = [
    {
      name: "app-jobs",
      isFifo: false,
      messages: [
        '{"type":"process","jobId":"job-001","payload":{"userId":"user-001"}}',
        '{"type":"process","jobId":"job-002","payload":{"userId":"user-002"}}',
        '{"type":"notify","jobId":"job-003","email":"alice@example.com"}',
        '{"type":"process","jobId":"job-004","payload":{"batch":true}}',
        '{"type":"cleanup","jobId":"job-005"}',
      ],
    },
    {
      name: "events.fifo",
      isFifo: true,
      messages: [
        '{"event":"user.created","userId":"user-101","timestamp":"2024-01-15T10:00:00Z"}',
        '{"event":"order.placed","orderId":"order-201","amount":99.99}',
        '{"event":"payment.processed","orderId":"order-201","status":"success"}',
      ],
    },
    {
      name: "app-jobs-dlq",
      isFifo: false,
      messages: [
        '{"type":"process","jobId":"job-failed-001","error":"timeout","retries":3}',
        '{"type":"notify","jobId":"job-failed-002","error":"invalid_email"}',
      ],
    },
  ];

  for (const queue of queues) {
    let queueUrl = "";
    try {
      const createArgs = [
        "sqs",
        "create-queue",
        "--queue-name",
        queue.name,
        "--output",
        "json",
      ];
      if (queue.isFifo) {
        createArgs.splice(createArgs.indexOf("--output"), 0, "--attributes", "FifoQueue=true");
      }
      const out = await runAws(createArgs, 10000);
      queueUrl = (JSON.parse(out) as { QueueUrl: string }).QueueUrl;
      console.log(`  Created queue: ${queue.name} (${queueUrl})`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err.message?.includes("already exists") || err.message?.includes("QueueAlreadyExists")) {
        console.log(`  Queue already exists: ${queue.name}`);
        try {
          const getOut = await runAws(["sqs", "get-queue-url", "--queue-name", queue.name, "--output", "json"], 10000);
          queueUrl = (JSON.parse(getOut) as { QueueUrl: string }).QueueUrl;
        } catch {
          console.log(`    Warning: could not get URL for ${queue.name}`);
        }
      } else {
        console.log(`  Warning creating queue ${queue.name}: ${err.message ?? String(e)}`);
      }
    }

    if (!queueUrl) continue;

    let sentCount = 0;
    for (const body of queue.messages) {
      try {
        const sendArgs = [
          "sqs",
          "send-message",
          "--queue-url",
          queueUrl,
          "--message-body",
          body,
          "--output",
          "json",
        ];
        if (queue.isFifo) {
          sendArgs.splice(sendArgs.indexOf("--output"), 0,
            "--message-group-id", "default",
            "--message-deduplication-id", `dedup-${Date.now()}-${sentCount}`,
          );
        }
        await runAws(sendArgs, 10000);
        sentCount++;
      } catch (e: unknown) {
        console.log(`    Warning sending message to ${queue.name}: ${(e as Error).message}`);
      }
    }
    console.log(`    Sent ${sentCount}/${queue.messages.length} messages`);
  }
}

async function seedCloudFormation() {
  console.log("\nSeeding CloudFormation:");

  const stacks = [
    {
      name: "local-web-stack",
      template: {
        AWSTemplateFormatVersion: "2010-09-09",
        Description: "Local test web application stack",
        Resources: {
          WebBucket: {
            Type: "AWS::S3::Bucket",
            Properties: { BucketName: "local-web-assets" },
          },
          AppLogGroup: {
            Type: "AWS::Logs::LogGroup",
            Properties: { LogGroupName: "/local/web-app", RetentionInDays: 7 },
          },
        },
        Outputs: {
          BucketName: {
            Value: { Ref: "WebBucket" },
            Description: "Web assets bucket name",
          },
        },
      },
    },
    {
      name: "local-data-stack",
      template: {
        AWSTemplateFormatVersion: "2010-09-09",
        Description: "Local test data processing stack",
        Resources: {
          JobQueue: {
            Type: "AWS::SQS::Queue",
            Properties: { QueueName: "cfn-job-queue" },
          },
          DataLogGroup: {
            Type: "AWS::Logs::LogGroup",
            Properties: { LogGroupName: "/local/data-processor", RetentionInDays: 14 },
          },
        },
      },
    },
  ];

  for (const stack of stacks) {
    try {
      // Check if stack already exists
      const describeOut = await runAws(
        ["cloudformation", "describe-stacks", "--stack-name", stack.name, "--output", "json"],
        10000,
      ).catch(() => "");

      if (describeOut && describeOut.includes(stack.name)) {
        console.log(`  Stack already exists: ${stack.name}`);
        continue;
      }

      await runAws(
        [
          "cloudformation",
          "create-stack",
          "--stack-name",
          stack.name,
          "--template-body",
          JSON.stringify(stack.template),
          "--output",
          "json",
        ],
        15000,
      );
      console.log(`  Created stack: ${stack.name}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err.message?.includes("already exists") || err.message?.includes("AlreadyExistsException")) {
        console.log(`  Stack already exists: ${stack.name}`);
      } else {
        console.log(`  Warning creating stack ${stack.name}: ${err.message ?? String(e)}`);
      }
    }
  }
}

async function seedSNS() {
  console.log("\nSeeding SNS:");

  const topics = [
    { name: "app-notifications", displayName: "App Notifications" },
    { name: "order-events", displayName: "Order Events" },
    { name: "alerts", displayName: "Monitoring Alerts" },
  ];

  for (const topic of topics) {
    let topicArn = "";
    try {
      const out = await runAws(
        [
          "sns",
          "create-topic",
          "--name",
          topic.name,
          "--attributes",
          `DisplayName=${topic.displayName}`,
          "--output",
          "json",
        ],
        10000,
      );
      topicArn = (JSON.parse(out) as { TopicArn: string }).TopicArn;
      console.log(`  Created topic: ${topic.name} (${topicArn})`);
    } catch (e: unknown) {
      // SNS create-topic is idempotent, but get ARN anyway
      try {
        const listOut = await runAws(
          ["sns", "list-topics", "--output", "json"],
          10000,
        );
        const parsed = JSON.parse(listOut) as { Topics: Array<{ TopicArn: string }> };
        topicArn = parsed.Topics.find((t) => t.TopicArn.endsWith(`:${topic.name}`))?.TopicArn ?? "";
        if (topicArn) console.log(`  Topic already exists: ${topic.name}`);
        else console.log(`  Warning with topic ${topic.name}: ${(e as Error).message}`);
      } catch {
        console.log(`  Warning with topic ${topic.name}: ${(e as Error).message}`);
      }
    }

    // Subscribe an SQS queue (email subs won't confirm in LocalStack, use sqs)
    if (topicArn && topic.name === "app-notifications") {
      try {
        const queueOut = await runAws(
          ["sqs", "get-queue-url", "--queue-name", "app-jobs", "--output", "json"],
          10000,
        ).catch(() => "");
        if (queueOut) {
          const queueUrl = (JSON.parse(queueOut) as { QueueUrl: string }).QueueUrl;
          // Get queue ARN
          const attrOut = await runAws(
            [
              "sqs",
              "get-queue-attributes",
              "--queue-url",
              queueUrl,
              "--attribute-names",
              "QueueArn",
              "--output",
              "json",
            ],
            10000,
          );
          const queueArn = (JSON.parse(attrOut) as { Attributes: { QueueArn: string } }).Attributes.QueueArn;
          await runAws(
            ["sns", "subscribe", "--topic-arn", topicArn, "--protocol", "sqs", "--notification-endpoint", queueArn, "--output", "json"],
            10000,
          );
          console.log(`    Subscribed app-jobs SQS queue to ${topic.name}`);
        }
      } catch {
        // ignore subscription errors
      }
    }
  }
}

async function seedSSM() {
  console.log("\nSeeding SSM Parameter Store:");

  const parameters = [
    { name: "/app/config/log-level", value: "info", type: "String", description: "Application log level" },
    { name: "/app/config/max-connections", value: "100", type: "String", description: "Max DB connections" },
    { name: "/app/config/feature-flags", value: "dark-mode,beta-api", type: "StringList", description: "Feature flags" },
    { name: "/app/secrets/db-password", value: "localstack-db-pass-123", type: "SecureString", description: "Database password" },
    { name: "/app/secrets/api-key", value: "sk-local-test-key-abc123", type: "SecureString", description: "External API key" },
    { name: "/infra/vpc/id", value: "vpc-local-001", type: "String", description: "Main VPC ID" },
    { name: "/infra/ecs/cluster-name", value: "local-cluster", type: "String", description: "ECS cluster name" },
  ];

  for (const param of parameters) {
    try {
      await runAws(
        [
          "ssm",
          "put-parameter",
          "--name",
          param.name,
          "--value",
          param.value,
          "--type",
          param.type,
          "--description",
          param.description,
          "--overwrite",
          "--output",
          "json",
        ],
        10000,
      );
      console.log(`  Put parameter: ${param.name} (${param.type})`);
    } catch (e: unknown) {
      console.log(`  Warning with parameter ${param.name}: ${(e as Error).message}`);
    }
  }
}

async function seedECR() {
  console.log("\nSeeding ECR:");

  const repositories = [
    { name: "api-handler", description: "Main API service image" },
    { name: "data-processor", description: "Batch data processor image" },
    { name: "frontend", description: "React frontend image" },
    { name: "base-node", description: "Base Node.js image" },
  ];

  for (const repo of repositories) {
    try {
      const out = await runAws(
        [
          "ecr",
          "create-repository",
          "--repository-name",
          repo.name,
          "--output",
          "json",
        ],
        10000,
      );
      const result = JSON.parse(out) as { repository: { repositoryUri: string } };
      console.log(`  Created repository: ${repo.name} (${result.repository.repositoryUri})`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err.message?.includes("already exists") || err.message?.includes("RepositoryAlreadyExistsException")) {
        console.log(`  Repository already exists: ${repo.name}`);
      } else {
        console.log(`  Warning creating repository ${repo.name}: ${err.message ?? String(e)}`);
      }
    }
  }
}

async function seedStepFunctions() {
  console.log("\nSeeding Step Functions:");

  const lambdaRole = "arn:aws:iam::000000000000:role/sfn-role";

  // Ensure a role exists for Step Functions
  const sfnTrustPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "states.amazonaws.com" },
        Action: "sts:AssumeRole",
      },
    ],
  };
  await ensureRole("sfn-role", sfnTrustPolicy).catch(() => {});

  const stateMachines = [
    {
      name: "order-processing",
      definition: {
        Comment: "Process customer orders",
        StartAt: "ValidateOrder",
        States: {
          ValidateOrder: { Type: "Pass", Next: "ProcessPayment" },
          ProcessPayment: { Type: "Pass", Next: "SendConfirmation" },
          SendConfirmation: { Type: "Pass", End: true },
        },
      },
    },
    {
      name: "data-pipeline",
      definition: {
        Comment: "ETL data pipeline",
        StartAt: "Extract",
        States: {
          Extract: { Type: "Pass", Next: "Transform" },
          Transform: { Type: "Pass", Next: "Load" },
          Load: { Type: "Pass", End: true },
        },
      },
    },
    {
      name: "image-resizer",
      definition: {
        Comment: "Resize uploaded images to multiple sizes",
        StartAt: "DownloadImage",
        States: {
          DownloadImage: { Type: "Pass", Next: "Resize" },
          Resize: { Type: "Pass", End: true },
        },
      },
    },
  ];

  const createdArns: Record<string, string> = {};

  for (const sm of stateMachines) {
    try {
      // Check if already exists
      const listOut = await runAws(
        ["stepfunctions", "list-state-machines", "--output", "json"],
        10000,
      );
      const existing = (JSON.parse(listOut) as { stateMachines: Array<{ name: string; stateMachineArn: string }> })
        .stateMachines.find((m) => m.name === sm.name);

      if (existing) {
        console.log(`  State machine already exists: ${sm.name}`);
        createdArns[sm.name] = existing.stateMachineArn;
        continue;
      }

      const out = await runAws(
        [
          "stepfunctions",
          "create-state-machine",
          "--name",
          sm.name,
          "--definition",
          JSON.stringify(sm.definition),
          "--role-arn",
          lambdaRole,
          "--output",
          "json",
        ],
        15000,
      );
      const result = JSON.parse(out) as { stateMachineArn: string };
      createdArns[sm.name] = result.stateMachineArn;
      console.log(`  Created state machine: ${sm.name} (${result.stateMachineArn})`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err.message?.includes("already exists") || err.message?.includes("StateMachineAlreadyExists")) {
        console.log(`  State machine already exists: ${sm.name}`);
      } else {
        console.log(`  Warning creating state machine ${sm.name}: ${err.message ?? String(e)}`);
      }
    }
  }

  // Start a few executions on each state machine
  for (const [smName, smArn] of Object.entries(createdArns)) {
    const executions = [
      { name: `exec-${smName}-001`, input: '{"run":1}' },
      { name: `exec-${smName}-002`, input: '{"run":2}' },
    ];
    for (const exec of executions) {
      try {
        await runAws(
          [
            "stepfunctions",
            "start-execution",
            "--state-machine-arn",
            smArn,
            "--name",
            exec.name,
            "--input",
            exec.input,
            "--output",
            "json",
          ],
          10000,
        );
        console.log(`    Started execution: ${exec.name}`);
      } catch (e: unknown) {
        const err = e as { message?: string };
        if (err.message?.includes("already exists") || err.message?.includes("ExecutionAlreadyExists")) {
          console.log(`    Execution already exists: ${exec.name}`);
        } else {
          console.log(`    Warning starting execution ${exec.name}: ${err.message ?? String(e)}`);
        }
      }
    }
  }
}

async function seedVPC() {
  console.log("\nSeeding VPC:");

  // Create a custom VPC (default VPC already exists in LocalStack)
  let vpcId = "";
  try {
    const out = await runAws(
      [
        "ec2",
        "create-vpc",
        "--cidr-block",
        "10.1.0.0/16",
        "--tag-specifications",
        JSON.stringify([{
          ResourceType: "vpc",
          Tags: [{ Key: "Name", Value: "prod-vpc" }, { Key: "Env", Value: "prod" }],
        }]),
        "--output",
        "json",
      ],
      10000,
    );
    vpcId = (JSON.parse(out) as { Vpc: { VpcId: string } }).Vpc.VpcId;
    console.log(`  Created VPC: prod-vpc (${vpcId})`);
  } catch (e: unknown) {
    console.log(`  Warning creating VPC: ${(e as Error).message}`);
  }

  if (!vpcId) return;

  // Create subnets in the VPC
  const subnets = [
    { cidr: "10.1.1.0/24", az: "us-east-1a", name: "prod-public-1a" },
    { cidr: "10.1.2.0/24", az: "us-east-1b", name: "prod-public-1b" },
    { cidr: "10.1.10.0/24", az: "us-east-1a", name: "prod-private-1a" },
    { cidr: "10.1.11.0/24", az: "us-east-1b", name: "prod-private-1b" },
  ];

  for (const subnet of subnets) {
    try {
      await runAws(
        [
          "ec2",
          "create-subnet",
          "--vpc-id",
          vpcId,
          "--cidr-block",
          subnet.cidr,
          "--availability-zone",
          subnet.az,
          "--tag-specifications",
          JSON.stringify([{
            ResourceType: "subnet",
            Tags: [{ Key: "Name", Value: subnet.name }],
          }]),
          "--output",
          "json",
        ],
        10000,
      );
      console.log(`  Created subnet: ${subnet.name} (${subnet.cidr})`);
    } catch (e: unknown) {
      console.log(`  Warning creating subnet ${subnet.name}: ${(e as Error).message}`);
    }
  }

  // Create security groups
  const securityGroups = [
    {
      name: "prod-web-sg",
      description: "Web tier security group",
      rules: [
        { protocol: "tcp", port: 80, cidr: "0.0.0.0/0" },
        { protocol: "tcp", port: 443, cidr: "0.0.0.0/0" },
      ],
    },
    {
      name: "prod-app-sg",
      description: "Application tier security group",
      rules: [
        { protocol: "tcp", port: 8080, cidr: "10.1.0.0/16" },
      ],
    },
    {
      name: "prod-db-sg",
      description: "Database tier security group",
      rules: [
        { protocol: "tcp", port: 5432, cidr: "10.1.0.0/16" },
      ],
    },
  ];

  for (const sg of securityGroups) {
    try {
      const out = await runAws(
        [
          "ec2",
          "create-security-group",
          "--group-name",
          sg.name,
          "--description",
          sg.description,
          "--vpc-id",
          vpcId,
          "--tag-specifications",
          JSON.stringify([{
            ResourceType: "security-group",
            Tags: [{ Key: "Name", Value: sg.name }],
          }]),
          "--output",
          "json",
        ],
        10000,
      );
      const sgId = (JSON.parse(out) as { GroupId: string }).GroupId;
      console.log(`  Created security group: ${sg.name} (${sgId})`);

      for (const rule of sg.rules) {
        await runAws(
          [
            "ec2",
            "authorize-security-group-ingress",
            "--group-id",
            sgId,
            "--protocol",
            rule.protocol,
            "--port",
            String(rule.port),
            "--cidr",
            rule.cidr,
          ],
          10000,
        ).catch(() => {});
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (!err.message?.includes("already exists") && !err.message?.includes("InvalidGroup.Duplicate")) {
        console.log(`  Warning creating security group ${sg.name}: ${err.message ?? String(e)}`);
      } else {
        console.log(`  Security group already exists: ${sg.name}`);
      }
    }
  }
}

async function seedEventBridge() {
  console.log("\nSeeding EventBridge:");

  // Create a custom event bus
  try {
    await runAws(["events", "create-event-bus", "--name", "my-app-events"]);
    console.log("  Created event bus: my-app-events");
  } catch (e: unknown) {
    const msg = (e as { message?: string }).message ?? "";
    if (!msg.includes("already exists")) throw e;
    console.log("  Event bus already exists: my-app-events");
  }

  const rules = [
    {
      bus: "default",
      name: "daily-cleanup",
      schedule: "cron(0 2 * * ? *)",
      description: "Triggers daily cleanup Lambda at 2am UTC",
      state: "ENABLED",
    },
    {
      bus: "default",
      name: "hourly-metrics",
      schedule: "rate(1 hour)",
      description: "Sends hourly metrics to CloudWatch",
      state: "ENABLED",
    },
    {
      bus: "default",
      name: "user-signup-handler",
      pattern: JSON.stringify({ source: ["my-app"], "detail-type": ["UserSignup"] }),
      description: "Handles user signup events from the app",
      state: "ENABLED",
    },
    {
      bus: "default",
      name: "legacy-job-runner",
      schedule: "rate(5 minutes)",
      description: "Legacy background job — pending deprecation",
      state: "DISABLED",
    },
    {
      bus: "my-app-events",
      name: "order-processor",
      pattern: JSON.stringify({ source: ["my-app.orders"], "detail-type": ["OrderPlaced"] }),
      description: "Processes new order events",
      state: "ENABLED",
    },
    {
      bus: "my-app-events",
      name: "payment-notifier",
      pattern: JSON.stringify({ source: ["my-app.payments"], "detail-type": ["PaymentCompleted"] }),
      description: "Sends payment confirmation notifications",
      state: "ENABLED",
    },
  ];

  for (const rule of rules) {
    try {
      const args = [
        "events", "put-rule",
        "--name", rule.name,
        "--event-bus-name", rule.bus,
        "--state", rule.state,
        "--description", rule.description,
      ];
      if (rule.schedule) args.push("--schedule-expression", rule.schedule);
      if (rule.pattern) args.push("--event-pattern", rule.pattern);
      await runAws(args);
      console.log(`  Created rule: ${rule.bus}/${rule.name}`);
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message ?? "";
      if (!msg.includes("already exists")) throw e;
      console.log(`  Rule already exists: ${rule.bus}/${rule.name}`);
    }
  }
}

async function seedPreviewFiles() {
  console.log("\nSeeding preview test files (CSV/Parquet):");

  const PREVIEW_BUCKET = "ml-datasets";

  // --- CSV files ---
  const csvFiles = [
    {
      key: "preview/users.csv",
      content: [
        "user_id,name,email,age,country,plan,monthly_spend",
        "1,Alice Johnson,alice@example.com,32,US,pro,149.99",
        "2,Bob Smith,bob@example.com,45,UK,starter,29.99",
        "3,Charlie Brown,charlie@example.com,28,CA,pro,149.99",
        "4,Diana Prince,diana@example.com,36,AU,enterprise,499.00",
        "5,Eve Adams,eve@example.com,24,US,starter,29.99",
        "6,Frank Castle,frank@example.com,41,DE,pro,149.99",
        "7,Grace Hopper,grace@example.com,89,US,enterprise,499.00",
        "8,Hank Pym,hank@example.com,53,US,starter,29.99",
        "9,Iris West,iris@example.com,31,US,pro,149.99",
        "10,Jack Frost,jack@example.com,27,NO,starter,29.99",
      ].join("\n"),
    },
    {
      key: "preview/products.csv",
      content: [
        "product_id,name,category,price,stock,sku,rating",
        "P001,Widget Alpha,Electronics,19.99,250,SKU-WA001,4.5",
        "P002,Gadget Beta,Electronics,34.99,80,SKU-GB002,3.8",
        "P003,Thingamajig Gamma,Hardware,8.50,500,SKU-TG003,4.9",
        "P004,Doohickey Delta,Hardware,12.00,320,SKU-DD004,4.1",
        "P005,Gizmo Epsilon,Electronics,99.99,15,SKU-GE005,4.7",
        "P006,Contraption Zeta,Software,249.00,999,SKU-CZ006,4.3",
        "P007,Apparatus Eta,Software,59.99,999,SKU-AE007,3.9",
        "P008,Device Theta,Hardware,74.50,42,SKU-DT008,4.6",
      ].join("\n"),
    },
    {
      key: "preview/orders.csv",
      content: [
        "order_id,user_id,product_id,quantity,unit_price,total,status,created_at",
        "ORD-001,1,P001,2,19.99,39.98,completed,2024-01-15T10:00:00Z",
        "ORD-002,2,P005,1,99.99,99.99,shipped,2024-01-16T14:30:00Z",
        "ORD-003,3,P003,10,8.50,85.00,completed,2024-01-17T09:00:00Z",
        "ORD-004,1,P006,1,249.00,249.00,pending,2024-01-18T11:45:00Z",
        "ORD-005,4,P002,3,34.99,104.97,completed,2024-01-19T16:00:00Z",
        "ORD-006,5,P004,5,12.00,60.00,cancelled,2024-01-20T08:30:00Z",
        "ORD-007,6,P007,2,59.99,119.98,shipped,2024-01-21T13:15:00Z",
        "ORD-008,7,P008,1,74.50,74.50,completed,2024-01-22T10:00:00Z",
        "ORD-009,2,P001,4,19.99,79.96,completed,2024-01-23T15:00:00Z",
        "ORD-010,3,P006,2,249.00,498.00,pending,2024-01-24T12:00:00Z",
      ].join("\n"),
    },
  ];

  for (const file of csvFiles) {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: PREVIEW_BUCKET,
          Key: file.key,
          Body: file.content,
          ContentType: "text/csv",
        }),
      );
      console.log(`  Uploaded CSV: ${file.key}`);
    } catch (e: unknown) {
      console.log(`  Warning uploading ${file.key}: ${(e as Error).message}`);
    }
  }

  // --- Parquet files (generated via nodejs-polars) ---
  const pick = <T>(arr: T[], i: number): T => arr[i % arr.length]!;

  // employees_wide.parquet — 30 columns, 100 rows
  const n = 100;
  const depts = ["Engineering", "Marketing", "Sales", "HR", "Finance", "Legal", "Product", "Design"];
  const roles = ["Senior", "Staff", "Principal", "Junior", "Lead", "Manager", "Director", "IC"];
  const levels = ["L3", "L4", "L5", "L6", "L7", "L8"];
  const cities = ["New York", "San Francisco", "London", "Berlin", "Tokyo", "Sydney", "Toronto", "Paris"];
  const countries = ["US", "UK", "DE", "JP", "AU", "CA", "FR", "SG"];
  const timezones = ["America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Tokyo", "Australia/Sydney"];
  const costCenters = ["CC-ENG", "CC-MKTG", "CC-SALES", "CC-G&A", "CC-PROD"];
  const equipmentTiers = ["Standard", "Premium", "Executive"];

  const empDf = pl.DataFrame({
    employee_id:       Array.from({length: n}, (_, i) => i + 1001),
    name:              Array.from({length: n}, (_, i) => `Employee ${i + 1}`),
    email:             Array.from({length: n}, (_, i) => `emp${i + 1}@acme.com`),
    department:        Array.from({length: n}, (_, i) => pick(depts, i)),
    team:              Array.from({length: n}, (_, i) => `team-${(i % 8) + 1}`),
    role:              Array.from({length: n}, (_, i) => pick(roles, i)),
    level:             Array.from({length: n}, (_, i) => pick(levels, i)),
    salary:            Array.from({length: n}, (_, i) => 60000 + (i % 10) * 10000 + (i % 5) * 5000),
    bonus_pct:         Array.from({length: n}, (_, i) => 5 + (i % 20)),
    years_at_company:  Array.from({length: n}, (_, i) => (i % 15) + 1),
    vacation_days:     Array.from({length: n}, (_, i) => 15 + (i % 10)),
    sick_days_ytd:     Array.from({length: n}, (_, i) => i % 8),
    active:            Array.from({length: n}, (_, i) => i % 10 !== 0),
    hire_date:         Array.from({length: n}, (_, i) => `202${i % 4}-${String((i % 12) + 1).padStart(2, "0")}-01`),
    birth_date:        Array.from({length: n}, (_, i) => `${1970 + (i % 30)}-${String((i % 12) + 1).padStart(2, "0")}-15`),
    office:            Array.from({length: n}, (_, i) => `Office-${(i % 5) + 1}`),
    city:              Array.from({length: n}, (_, i) => pick(cities, i)),
    country:           Array.from({length: n}, (_, i) => pick(countries, i)),
    timezone:          Array.from({length: n}, (_, i) => pick(timezones, i)),
    phone:             Array.from({length: n}, (_, i) => `+1-555-${String(1000 + i).padStart(4, "0")}`),
    github_username:   Array.from({length: n}, (_, i) => `emp${i + 1}`),
    slack_handle:      Array.from({length: n}, (_, i) => `@emp${i + 1}`),
    performance_score: Array.from({length: n}, (_, i) => parseFloat((3.0 + (i % 20) * 0.1).toFixed(1))),
    projects_count:    Array.from({length: n}, (_, i) => (i % 8) + 1),
    certifications:    Array.from({length: n}, (_, i) => i % 5),
    last_review_date:  Array.from({length: n}, (_, i) => `2025-${String((i % 12) + 1).padStart(2, "0")}-01`),
    next_review_date:  Array.from({length: n}, (_, i) => `2026-${String((i % 12) + 1).padStart(2, "0")}-01`),
    cost_center:       Array.from({length: n}, (_, i) => pick(costCenters, i)),
    equipment_tier:    Array.from({length: n}, (_, i) => pick(equipmentTiers, i)),
    notes:             Array.from({length: n}, (_, i) => i % 3 === 0 ? `Note for emp ${i + 1}` : ""),
  });

  // metrics.parquet — 30 columns, 500 rows
  const m = 500;
  const metrics = ["cpu_usage", "memory_usage", "disk_io", "network_in", "network_out"];
  const regions = ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"];
  const envs = ["prod", "staging", "dev"];
  const datacenters = ["dc-1", "dc-2", "dc-3", "dc-4"];
  const oses = ["linux", "windows", "macos"];
  const clusters = ["k8s-prod", "k8s-staging", "ecs-prod", "ecs-staging"];

  const metricDf = pl.DataFrame({
    timestamp:        Array.from({length: m}, (_, i) => `2024-01-01T${String(i % 24).padStart(2,"0")}:00:00Z`),
    metric:           Array.from({length: m}, (_, i) => pick(metrics, i)),
    value:            Array.from({length: m}, (_, i) => parseFloat((Math.abs(Math.sin(i * 0.1) * 100)).toFixed(2))),
    host:             Array.from({length: m}, (_, i) => `server-${String((i % 10) + 1).padStart(2, "0")}`),
    region:           Array.from({length: m}, (_, i) => pick(regions, i)),
    environment:      Array.from({length: m}, (_, i) => pick(envs, i)),
    datacenter:       Array.from({length: m}, (_, i) => pick(datacenters, i)),
    os:               Array.from({length: m}, (_, i) => pick(oses, i)),
    cluster:          Array.from({length: m}, (_, i) => pick(clusters, i)),
    instance_type:    Array.from({length: m}, (_, i) => `t3.${["micro","small","medium","large"][i % 4]}`),
    cpu_cores:        Array.from({length: m}, (_, i) => [1, 2, 4, 8, 16][i % 5]!),
    ram_gb:           Array.from({length: m}, (_, i) => [1, 2, 4, 8, 16, 32][i % 6]!),
    disk_gb:          Array.from({length: m}, (_, i) => [20, 50, 100, 200, 500][i % 5]!),
    p50_ms:           Array.from({length: m}, (_, i) => parseFloat((5 + (i % 50) * 0.5).toFixed(1))),
    p95_ms:           Array.from({length: m}, (_, i) => parseFloat((20 + (i % 100) * 0.8).toFixed(1))),
    p99_ms:           Array.from({length: m}, (_, i) => parseFloat((50 + (i % 200) * 1.2).toFixed(1))),
    requests_per_sec: Array.from({length: m}, (_, i) => (i % 1000) + 1),
    error_rate:       Array.from({length: m}, (_, i) => parseFloat(((i % 10) * 0.01).toFixed(3))),
    bytes_in:         Array.from({length: m}, (_, i) => (i % 10000) * 1024),
    bytes_out:        Array.from({length: m}, (_, i) => (i % 8000) * 512),
    connections:      Array.from({length: m}, (_, i) => (i % 500) + 10),
    queue_depth:      Array.from({length: m}, (_, i) => i % 100),
    cache_hit_rate:   Array.from({length: m}, (_, i) => parseFloat((0.5 + (i % 50) * 0.01).toFixed(2))),
    uptime_seconds:   Array.from({length: m}, (_, i) => i * 3600),
    restart_count:    Array.from({length: m}, (_, i) => i % 5),
    alert_level:      Array.from({length: m}, (_, i) => ["ok","warn","critical"][i % 3]!),
    scrape_interval:  Array.from({length: m}, (_, i) => [10, 15, 30, 60][i % 4]!),
    retention_days:   Array.from({length: m}, (_, i) => [7, 14, 30, 90][i % 4]!),
    job_id:           Array.from({length: m}, (_, i) => `job-${String(i + 1).padStart(4, "0")}`),
    service:          Array.from({length: m}, (_, i) => `svc-${String((i % 20) + 1).padStart(2, "0")}`),
  });

  const parquetUploads = [
    { key: "preview/employees_wide.parquet", df: empDf },
    { key: "preview/metrics.parquet", df: metricDf },
  ];

  for (const upload of parquetUploads) {
    const tmpPath = join(tmpdir(), `a9s_seed_${Date.now()}_${upload.key.replace(/\//g, "_")}`);
    try {
      upload.df.writeParquet(tmpPath);
      const parquetBytes = await readFile(tmpPath);
      await client.send(
        new PutObjectCommand({
          Bucket: PREVIEW_BUCKET,
          Key: upload.key,
          Body: parquetBytes,
          ContentType: "application/octet-stream",
        }),
      );
      console.log(`  Uploaded Parquet: ${upload.key} (${upload.df.shape.height} rows × ${upload.df.shape.width} cols)`);
    } catch (e: unknown) {
      console.log(`  Warning uploading ${upload.key}: ${(e as Error).message}`);
    }
  }
}

async function main() {
  console.log("Checking LocalStack connection...");
  await checkLocalStack();
  console.log("Connected!\n");

  for (const bucket of BUCKETS) {
    console.log(`Seeding ${bucket}:`);
    await ensureBucket(bucket);
    process.stdout.write("  Objects: ");
    await seedBucket(bucket);
  }

  try {
    await seedDynamoDB();
  } catch (e) {
    console.error(`\nDynamoDB seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedRoute53();
  } catch (e) {
    console.error(`\nRoute53 seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedIam();
  } catch (e) {
    console.error(`\nIAM seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedSecretsManager();
  } catch (e) {
    console.error(`\nSecrets Manager seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedLambda();
  } catch (e) {
    console.error(`\nLambda seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedECS();
  } catch (e) {
    console.error(`\nECS seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedCloudWatchLogs();
  } catch (e) {
    console.error(`\nCloudWatch Logs seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedEBS();
  } catch (e) {
    console.error(`\nEBS seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedELB();
  } catch (e) {
    console.error(`\nELB seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedSQS();
  } catch (e) {
    console.error(`\nSQS seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedCloudFormation();
  } catch (e) {
    console.error(`\nCloudFormation seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedSNS();
  } catch (e) {
    console.error(`\nSNS seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedSSM();
  } catch (e) {
    console.error(`\nSSM seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedECR();
  } catch (e) {
    console.error(`\nECR seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedStepFunctions();
  } catch (e) {
    console.error(`\nStep Functions seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedVPC();
  } catch (e) {
    console.error(`\nVPC seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedEventBridge();
  } catch (e) {
    console.error(`\nEventBridge seeding failed: ${(e as Error).message}`);
  }

  try {
    await seedPreviewFiles();
  } catch (e) {
    console.error(`\nPreview files seeding failed: ${(e as Error).message}`);
  }

  // RDS: skipped — LocalStack Community does not support RDS (Pro only).

  console.log("\nDone! LocalStack seeded with test data.");
  console.log("Run: pnpm dev:local");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
