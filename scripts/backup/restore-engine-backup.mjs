#!/usr/bin/env node
import { Buffer } from "node:buffer";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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

function requireExactOption(options, name, expected) {
  if (options[name] !== expected) throw new Error(`${name} must be ${expected}`);
}

async function prepareTarget(targetDirectory) {
  const target = resolve(targetDirectory);
  const repository = resolve(".");
  if (target === repository || target.startsWith(`${repository}/`)) {
    throw new Error("restore target must be outside the repository");
  }
  await mkdir(target, { recursive: true, mode: 0o700 });
  if ((await readdir(target)).length > 0) throw new Error("restore target must be empty");
  return target;
}

export async function restoreEngineBackup(options) {
  if (options.environment !== "local-isolated") {
    throw new Error("direct human approval required for shared or production restore");
  }
  if (!options.approvalReference) throw new Error("local restore approval reference required");
  if (!options.safetyBackupReference) throw new Error("fresh safety backup reference required");
  requireExactOption(options, "maintenanceMode", "enabled");
  requireExactOption(options, "connectors", "disabled");
  requireExactOption(options, "queueReplay", "disabled");

  await verifyEngineBackup({
    manifestPath: options.manifestPath,
    keyFile: options.keyFile,
    maxAgeHours: options.maxAgeHours,
    now: options.now,
  });
  const manifest = parseJson(await readFile(options.manifestPath), "backup manifest");
  const encrypted = await readFile(resolve(dirname(options.manifestPath), manifest.bundleFile));
  const key = await readEncryptionKey(options.keyFile);
  const decoded = parseJson(
    decryptBundle(
      encrypted,
      key,
      Buffer.from(manifest.encryption.initializationVector, "base64"),
      Buffer.from(manifest.encryption.authenticationTag, "base64"),
    ),
    "decrypted backup bundle",
  );
  if (Number(decoded.configInventory?.schemaVersion) !== options.expectedSchemaVersion) {
    throw new Error("migration compatibility check failed");
  }

  const target = await prepareTarget(options.targetDirectory);
  const database = Buffer.from(decoded.databaseBase64, "base64");
  const objectBytes = Buffer.from(canonicalJson(decoded.objectInventory));
  const configBytes = Buffer.from(canonicalJson(decoded.configInventory));
  await Promise.all([
    writeFile(`${target}/database.dump`, database, { mode: 0o600 }),
    writeFile(`${target}/object-inventory.json`, objectBytes, { mode: 0o600 }),
    writeFile(`${target}/config-inventory.json`, configBytes, { mode: 0o600 }),
  ]);

  const state = {
    schemaVersion: 1,
    environment: "local-isolated",
    restoredAt: options.now ?? new Date().toISOString(),
    sourceRecoveryPoint: manifest.recoveryPoint,
    sourceSchemaVersion: decoded.configInventory.schemaVersion,
    expected: {
      databaseSha256: manifest.databaseSha256,
      objectInventorySha256: manifest.objectInventorySha256,
      configInventorySha256: manifest.configInventorySha256,
      integrityInventory: decoded.configInventory.integrityInventory ?? {},
    },
    controls: {
      maintenanceMode: "enabled",
      connectors: "disabled",
      queueReplay: "disabled",
      approvalReference: options.approvalReference,
      safetyBackupReference: options.safetyBackupReference,
    },
    observed: {
      databaseSha256: sha256(database),
      objectInventorySha256: sha256(objectBytes),
      configInventorySha256: sha256(configBytes),
    },
  };
  await writeFile(`${target}/restore-state.json`, `${JSON.stringify(state, null, 2)}\n`, {
    mode: 0o600,
  });
  return { status: "RESTORED_ISOLATED", targetDirectory: target };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const environment = requireArgument(args, "environment");
  if (environment !== "local-isolated") {
    throw new Error("direct human approval required for shared or production restore");
  }
  const expectedSchemaVersion = Number(requireArgument(args, "expected-schema-version"));
  const maxAgeHours = Number(requireArgument(args, "max-age-hours"));
  if (!Number.isInteger(expectedSchemaVersion) || expectedSchemaVersion < 1) {
    throw new Error("expected schema version must be a positive integer");
  }
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0)
    throw new Error("max age must be positive");
  const result = await restoreEngineBackup({
    environment,
    manifestPath: requireArgument(args, "manifest"),
    keyFile: requireArgument(args, "key-file"),
    targetDirectory: requireArgument(args, "target-dir"),
    approvalReference: requireArgument(args, "approval-reference"),
    maintenanceMode: requireArgument(args, "maintenance-mode"),
    safetyBackupReference: requireArgument(args, "safety-backup-reference"),
    connectors: requireArgument(args, "connectors"),
    queueReplay: requireArgument(args, "queue-replay"),
    expectedSchemaVersion,
    maxAgeHours,
    now: args.get("now"),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`restore failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
