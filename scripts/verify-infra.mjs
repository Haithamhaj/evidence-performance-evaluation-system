import console from "node:console";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

import {
  CreateBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const execFileAsync = promisify(execFile);
const composeFile = "infra/docker/compose.yml";
const environmentFile = ".env.local";
const persistenceBucket = "evaluation-infra-verification";
const persistenceKey = "persistence/marker.txt";
const persistenceValue = "local-infrastructure-persistence-v1";

const expectedImages = {
  postgres:
    "postgres:17.10-bookworm@sha256:4f736ae292687621d4dbe0d499ffd024a36bd2ee7d8ca6f2ccd4c800f047b394",
  redis:
    "redis:8.2.7-bookworm@sha256:d30960f73a599496d8b2802c97758bab6b1cd421fd06337f837779c47a57e1f3",
  minio:
    "minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e",
  keycloak:
    "quay.io/keycloak/keycloak:26.7.0@sha256:2eb3cd316835c990e69e26ade292ffa78f6fb0db7d5fc6377463c162e1979ac0",
};

await access(environmentFile).catch(() => {
  throw new Error("Missing .env.local. Copy .env.example to .env.local before verification.");
});
process.loadEnvFile(environmentFile);

function environment(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required local environment variable: ${name}`);
  }
  return value;
}

async function dockerCompose(arguments_, options = {}) {
  return execFileAsync(
    "docker",
    ["compose", "--env-file", environmentFile, "-f", composeFile, ...arguments_],
    { maxBuffer: 10 * 1024 * 1024, ...options },
  );
}

async function waitForHealthyContainer(service, containerId, timeoutMilliseconds = 300_000) {
  const deadline = Date.now() + timeoutMilliseconds;

  while (Date.now() < deadline) {
    const { stdout } = await execFileAsync(
      "docker",
      [
        "inspect",
        "--format",
        "{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|{{.Config.Image}}",
        containerId,
      ],
      { maxBuffer: 1024 * 1024 },
    );
    const [status, health, configuredImage] = stdout.trim().split("|");
    if (status === "running" && health === "healthy") {
      return configuredImage;
    }
    if (["dead", "exited", "removing"].includes(status)) {
      throw new Error(`Local service stopped before becoming healthy: ${service}`);
    }

    await delay(1_000);
  }

  throw new Error(`Timed out waiting for local service health: ${service}`);
}

async function verifyServices() {
  for (const [service, expectedImage] of Object.entries(expectedImages)) {
    const { stdout: containerIdOutput } = await dockerCompose(["ps", "-q", service]);
    const containerId = containerIdOutput.trim();
    if (!containerId) {
      throw new Error(`Local service is not running: ${service}`);
    }

    const configuredImage = await waitForHealthyContainer(service, containerId);
    if (configuredImage !== expectedImage) {
      throw new Error(`Local service is not using its approved immutable image: ${service}`);
    }
  }

  console.log("SERVICES OK: PostgreSQL, Redis, MinIO, and Keycloak are healthy on pinned images.");
}

async function databaseConnection(username, password, database) {
  return dockerCompose([
    "exec",
    "-T",
    "-e",
    `PGPASSWORD=${password}`,
    "postgres",
    "psql",
    "--no-password",
    "--host",
    "127.0.0.1",
    "--username",
    username,
    "--dbname",
    database,
    "--tuples-only",
    "--no-align",
    "--command",
    "SELECT 1",
  ]);
}

async function verifyDatabaseIsolation() {
  const identities = [
    {
      database: environment("APP_DB_NAME"),
      password: environment("APP_DB_PASSWORD"),
      username: environment("APP_DB_USERNAME"),
    },
    {
      database: environment("TEST_DB_NAME"),
      password: environment("TEST_DB_PASSWORD"),
      username: environment("TEST_DB_USERNAME"),
    },
    {
      database: "keycloak",
      password: environment("KEYCLOAK_DB_PASSWORD"),
      username: environment("KEYCLOAK_DB_USERNAME"),
    },
  ];

  for (const identity of identities) {
    const { stdout } = await databaseConnection(
      identity.username,
      identity.password,
      identity.database,
    );
    if (stdout.trim() !== "1") {
      throw new Error("A local database owner could not access its database.");
    }

    for (const otherIdentity of identities) {
      if (otherIdentity.database === identity.database) continue;
      try {
        await databaseConnection(identity.username, identity.password, otherIdentity.database);
      } catch {
        continue;
      }
      throw new Error("A local database user could access another service database.");
    }
  }

  console.log("POSTGRES OK: application, test, and Keycloak database access is isolated.");
}

async function verifyRedis() {
  const { stdout: pingOutput } = await dockerCompose(["exec", "-T", "redis", "redis-cli", "PING"]);
  if (pingOutput.trim() !== "PONG") {
    throw new Error("Redis did not return PONG.");
  }

  const { stdout: markerCreationOutput } = await dockerCompose([
    "exec",
    "-T",
    "redis",
    "redis-cli",
    "SET",
    "local-infra:persistence-marker",
    persistenceValue,
    "NX",
  ]);
  const { stdout: markerOutput } = await dockerCompose([
    "exec",
    "-T",
    "redis",
    "redis-cli",
    "GET",
    "local-infra:persistence-marker",
  ]);
  if (markerOutput.trim() !== persistenceValue) {
    throw new Error("Redis persistence marker could not be read.");
  }

  const markerState = markerCreationOutput.trim() === "OK" ? "created" : "retained";
  console.log(`REDIS OK: PONG received; persistence marker ${markerState}.`);
}

async function verifyMinio() {
  const endpoint = environment("S3_ENDPOINT");
  const healthResponse = await globalThis.fetch(`${endpoint}/minio/health/live`);
  if (healthResponse.status !== 200) {
    throw new Error(`MinIO liveness returned HTTP ${healthResponse.status}.`);
  }

  const client = new S3Client({
    credentials: {
      accessKeyId: environment("MINIO_ROOT_USER"),
      secretAccessKey: environment("MINIO_ROOT_PASSWORD"),
    },
    endpoint,
    forcePathStyle: true,
    region: environment("S3_REGION"),
  });

  let markerState = "retained";
  try {
    await client.send(new HeadObjectCommand({ Bucket: persistenceBucket, Key: persistenceKey }));
  } catch (error) {
    const statusCode = error?.$metadata?.httpStatusCode;
    if (statusCode !== 404 && error?.name !== "NoSuchKey" && error?.name !== "NoSuchBucket") {
      throw error;
    }
    if (error?.name === "NoSuchBucket" || statusCode === 404) {
      try {
        await client.send(new CreateBucketCommand({ Bucket: persistenceBucket }));
      } catch (createError) {
        if (createError?.name !== "BucketAlreadyOwnedByYou") throw createError;
      }
    }
    await client.send(
      new PutObjectCommand({
        Body: persistenceValue,
        Bucket: persistenceBucket,
        ContentType: "text/plain",
        Key: persistenceKey,
      }),
    );
    markerState = "created";
  } finally {
    client.destroy();
  }

  console.log(`MINIO OK: liveness is HTTP 200; persistence marker ${markerState}.`);
}

async function verifyOidc() {
  const expectedIssuer = environment("OIDC_ISSUER");
  const response = await globalThis.fetch(`${expectedIssuer}/.well-known/openid-configuration`);
  if (!response.ok) {
    throw new Error(`OIDC discovery returned HTTP ${response.status}.`);
  }
  const discovery = await response.json();
  if (discovery.issuer !== expectedIssuer) {
    throw new Error("OIDC discovery returned an unexpected issuer.");
  }
  console.log("OIDC OK: evaluation realm discovery returned the expected issuer.");
}

await verifyServices();
await verifyDatabaseIsolation();
await verifyRedis();
await verifyMinio();
await verifyOidc();
console.log("INFRASTRUCTURE VERIFIED");
