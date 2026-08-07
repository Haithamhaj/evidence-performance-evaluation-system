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

const REQUIRED_INTEGRITY_CLASSES = [
  "auditChain",
  "foreignKeys",
  "closedEvaluations",
  "upwardResponses",
  "evidenceSources",
  "responsibilityWindows",
  "delegationWindows",
];

export async function verifyRestoredEngine(targetDirectory) {
  const target = resolve(targetDirectory);
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
  return {
    status: "VERIFIED",
    schemaVersion: state.sourceSchemaVersion,
    protectedIntegrityClasses: REQUIRED_INTEGRITY_CLASSES.length,
    objectCount: objects.length,
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const result = await verifyRestoredEngine(requireArgument(args, "target-dir"));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`restored engine verification failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
