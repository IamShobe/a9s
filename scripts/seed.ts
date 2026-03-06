import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  ListBucketsCommand,
} from "@aws-sdk/client-s3";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

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

  console.log("\nDone! LocalStack seeded with test data.");
  console.log("Run: pnpm dev:local");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
