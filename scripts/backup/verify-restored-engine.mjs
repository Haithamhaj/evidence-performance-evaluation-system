#!/usr/bin/env node
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  canonicalJson,
  decryptBundle,
  parseArguments,
  parseJson,
  readEncryptionKey,
  requireArgument,
  sha256,
} from "./backup-lib.mjs";
import { verifyEngineBackup } from "./verify-engine-backup.mjs";
import {
  assertRepositoryPostgresContainer,
  parseLocalDatabaseUrl,
  readProtectedIntegrity,
} from "./postgres-tools.mjs";

const REQUIRED_INTEGRITY_CLASSES = [
  "auditEvents",
  "foreignKeys",
  "closedEvaluations",
  "upwardResponses",
  "evidenceSources",
  "responsibilityWindows",
  "delegationWindows",
];

export async function verifyRestoredEngine(options) {
  const target = resolve(options.targetDirectory);
  await verifyEngineBackup({
    manifestPath: options.manifestPath,
    keyFile: options.keyFile,
    maxAgeHours: options.maxAgeHours,
    now: options.now,
  });
  const manifest = parseJson(await readFile(options.manifestPath), "backup manifest");
  const encrypted = await readFile(resolve(dirname(options.manifestPath), manifest.bundleFile));
  const key = await readEncryptionKey(options.keyFile);
  const sourceBundle = parseJson(
    decryptBundle(
      encrypted,
      key,
      Buffer.from(manifest.encryption.initializationVector, "base64"),
      Buffer.from(manifest.encryption.authenticationTag, "base64"),
    ),
    "decrypted backup bundle",
  );
  const [stateBytes, database, objectsBytes, configBytes] = await Promise.all([
    readFile(`${target}/restore-state.json`),
    readFile(`${target}/database.dump`),
    readFile(`${target}/object-inventory.json`),
    readFile(`${target}/config-inventory.json`),
  ]);
  const state = parseJson(stateBytes, "restore state");
  const objects = parseJson(objectsBytes, "restored object inventory");
  const config = parseJson(configBytes, "restored config inventory");
  if (state.environment !== "local-isolated") throw new Error("restored target is not isolated");
  if (state.controls?.connectors !== "disabled" || state.controls?.queueReplay !== "disabled") {
    throw new Error("connector and replay isolation failed");
  }
  const observed = {
    databaseSha256: sha256(database),
    objectInventorySha256: sha256(Buffer.from(canonicalJson(objects))),
    configInventorySha256: sha256(Buffer.from(canonicalJson(config))),
  };
  for (const [key, value] of Object.entries(observed)) {
    if (value !== manifest[key]) throw new Error(`${key} integrity mismatch`);
  }
  if (
    canonicalJson(objects) !== canonicalJson(sourceBundle.objectInventory) ||
    canonicalJson(config) !== canonicalJson(sourceBundle.configInventory)
  ) {
    throw new Error("restored inventories differ from the signed backup");
  }
  const integrity = sourceBundle.sourceIntegrity;
  if (
    !integrity ||
    REQUIRED_INTEGRITY_CLASSES.some(
      (key) => !Number.isInteger(integrity[key]) || integrity[key] < 0,
    )
  ) {
    throw new Error("protected integrity inventory incomplete");
  }
  const targetDatabase = parseLocalDatabaseUrl(options.targetDatabaseUrl, {
    requireIsolatedPrefix: true,
  });
  if (targetDatabase.databaseName !== state.observed?.restoredDatabaseName) {
    throw new Error("restored database identity mismatch");
  }
  await assertRepositoryPostgresContainer(options.postgresContainer, options.targetDatabaseUrl);
  const restoredIntegrity = await readProtectedIntegrity(
    options.targetDatabaseUrl,
    options.postgresContainer,
  );
  if (
    sha256(Buffer.from(canonicalJson(restoredIntegrity))) !== manifest.protectedIntegritySha256 ||
    canonicalJson(restoredIntegrity) !== canonicalJson(integrity)
  ) {
    throw new Error("restored protected history differs from the source database");
  }
  if (
    restoredIntegrity.unvalidatedForeignKeys !== 0 ||
    !restoredIntegrity.auditAppendOnly ||
    !restoredIntegrity.closedEvaluationAppendOnly ||
    !restoredIntegrity.upwardResponseAppendOnly ||
    !restoredIntegrity.evidenceAppendOnly
  ) {
    throw new Error("restored database integrity controls are incomplete");
  }
  for (const item of objects) {
    const content = await readFile(resolve(target, "objects", item.key));
    if (sha256(content) !== item.sha256) throw new Error("restored object checksum mismatch");
  }
  return {
    status: "VERIFIED",
    databaseRestored: true,
    schemaVersion: state.sourceSchemaVersion,
    protectedIntegrityClasses: REQUIRED_INTEGRITY_CLASSES.length,
    objectCount: objects.length,
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const result = await verifyRestoredEngine({
    targetDirectory: requireArgument(args, "target-dir"),
    targetDatabaseUrl: requireArgument(args, "target-database-url"),
    postgresContainer: requireArgument(args, "postgres-container"),
    manifestPath: requireArgument(args, "manifest"),
    keyFile: requireArgument(args, "key-file"),
    maxAgeHours: Number(requireArgument(args, "max-age-hours")),
    now: args.get("now"),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`restored engine verification failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
