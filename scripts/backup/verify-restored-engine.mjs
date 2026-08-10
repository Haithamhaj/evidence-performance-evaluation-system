#!/usr/bin/env node
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  canonicalJson,
  parseArguments,
  parseJson,
  requireArgument,
  sha256,
} from "./backup-lib.mjs";
import { parseLocalDatabaseUrl, readProtectedIntegrity } from "./postgres-tools.mjs";

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
    if (value !== state.expected?.[key]) throw new Error(`${key} integrity mismatch`);
  }
  const integrity = state.expected?.integrityInventory;
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
  const restoredIntegrity = await readProtectedIntegrity(
    options.targetDatabaseUrl,
    options.postgresContainer,
  );
  if (
    sha256(Buffer.from(canonicalJson(restoredIntegrity))) !==
      state.expected.protectedIntegritySha256 ||
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
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`restored engine verification failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
