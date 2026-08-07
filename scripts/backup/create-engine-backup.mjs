#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  canonicalJson,
  encryptBundle,
  parseArguments,
  parseJson,
  readEncryptionKey,
  requireArgument,
  sha256,
  signManifest,
} from "./backup-lib.mjs";

async function ensureSafeTarget(targetDirectory) {
  const resolved = resolve(targetDirectory);
  if (resolved === resolve(".") || resolved.startsWith(`${resolve(".")}/`)) {
    throw new Error("backup target must be outside the repository");
  }
  try {
    const targetStat = await stat(resolved);
    if (!targetStat.isDirectory()) throw new Error("backup target must be a directory");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await mkdir(resolved, { recursive: true, mode: 0o700 });
  return resolved;
}

export async function createEngineBackup(options) {
  const startedAt = options.createdAt ?? new Date().toISOString();
  const targetDirectory = await ensureSafeTarget(options.targetDirectory);
  const [database, objectInventoryBytes, configInventoryBytes, key] = await Promise.all([
    readFile(options.databaseDump),
    readFile(options.objectInventory),
    readFile(options.configInventory),
    readEncryptionKey(options.keyFile),
  ]);
  const objectInventory = parseJson(objectInventoryBytes, "object inventory");
  const configInventory = parseJson(configInventoryBytes, "config inventory");
  if (!Array.isArray(objectInventory)) throw new Error("object inventory must be an array");
  const canonicalObjectInventory = Buffer.from(canonicalJson(objectInventory));
  const canonicalConfigInventory = Buffer.from(canonicalJson(configInventory));

  const payload = Buffer.from(
    canonicalJson({
      schemaVersion: 1,
      databaseBase64: database.toString("base64"),
      objectInventory,
      configInventory,
    }),
  );
  const iv = randomBytes(12);
  const { encrypted, authenticationTag } = encryptBundle(payload, key, iv);
  const bundlePath = `${targetDirectory}/engine-backup.enc`;
  await writeFile(bundlePath, encrypted, { mode: 0o600 });

  const unsignedManifest = {
    schemaVersion: 1,
    environment: "local-isolated",
    startedAt,
    completedAt: startedAt,
    recoveryPoint: startedAt,
    databaseSha256: sha256(database),
    objectInventorySha256: sha256(canonicalObjectInventory),
    configInventorySha256: sha256(canonicalConfigInventory),
    encryptedBundleSha256: sha256(encrypted),
    inventories: {
      objectCount: objectInventory.length,
      configSchemaVersion: configInventory.schemaVersion ?? null,
    },
    encryption: {
      algorithm: "AES-256-GCM",
      keyReference: options.keyReference,
      initializationVector: iv.toString("base64"),
      authenticationTag: authenticationTag.toString("base64"),
    },
    toolVersions: { node: process.versions.node, backupTool: 1 },
    verification: { status: "PENDING_INDEPENDENT_VERIFICATION" },
    bundleFile: "engine-backup.enc",
  };
  const manifest = { ...unsignedManifest, signature: signManifest(unsignedManifest, key) };
  const manifestPath = `${targetDirectory}/manifest.json`;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return { manifestPath, bundlePath };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const result = await createEngineBackup({
    targetDirectory: requireArgument(args, "target-dir"),
    databaseDump: requireArgument(args, "database-dump"),
    objectInventory: requireArgument(args, "object-inventory"),
    configInventory: requireArgument(args, "config-inventory"),
    keyFile: requireArgument(args, "key-file"),
    keyReference: requireArgument(args, "key-reference"),
    createdAt: args.get("created-at"),
  });
  process.stdout.write(
    `${JSON.stringify({ status: "CREATED", manifestPath: result.manifestPath })}\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`backup creation failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
