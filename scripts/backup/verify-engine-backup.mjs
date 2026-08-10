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
  verifyManifestSignature,
} from "./backup-lib.mjs";

function validateManifest(manifest) {
  const required = [
    "schemaVersion",
    "environment",
    "startedAt",
    "completedAt",
    "recoveryPoint",
    "databaseSha256",
    "objectInventorySha256",
    "configInventorySha256",
    "protectedIntegritySha256",
    "encryptedBundleSha256",
    "inventories",
    "encryption",
    "toolVersions",
    "verification",
    "bundleFile",
    "signature",
  ];
  if (manifest.schemaVersion !== 1 || required.some((key) => manifest[key] === undefined)) {
    throw new Error("backup manifest does not match schema version 1");
  }
  if (manifest.encryption?.algorithm !== "AES-256-GCM")
    throw new Error("unsupported encryption algorithm");
}

export async function verifyEngineBackup(options) {
  const manifestBytes = await readFile(options.manifestPath);
  const manifest = parseJson(manifestBytes, "backup manifest");
  validateManifest(manifest);
  const key = await readEncryptionKey(options.keyFile);
  const { signature, ...unsignedManifest } = manifest;
  if (!verifyManifestSignature(unsignedManifest, signature, key))
    throw new Error("manifest signature mismatch");

  const now = new Date(options.now ?? Date.now());
  const recoveryPoint = new Date(manifest.recoveryPoint);
  const ageMs = now.getTime() - recoveryPoint.getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) throw new Error("invalid backup recovery point");
  if (ageMs > options.maxAgeHours * 60 * 60 * 1000)
    throw new Error("backup exceeds maximum allowed age");

  const bundlePath = resolve(dirname(options.manifestPath), manifest.bundleFile);
  const encrypted = await readFile(bundlePath);
  if (sha256(encrypted) !== manifest.encryptedBundleSha256)
    throw new Error("encrypted bundle hash mismatch");
  const payload = decryptBundle(
    encrypted,
    key,
    Buffer.from(manifest.encryption.initializationVector, "base64"),
    Buffer.from(manifest.encryption.authenticationTag, "base64"),
  );
  const decoded = parseJson(payload, "decrypted backup bundle");
  const database = Buffer.from(decoded.databaseBase64, "base64");
  const objectBytes = Buffer.from(canonicalJson(decoded.objectInventory));
  const configBytes = Buffer.from(canonicalJson(decoded.configInventory));
  const integrityBytes = Buffer.from(canonicalJson(decoded.sourceIntegrity));
  if (sha256(database) !== manifest.databaseSha256) throw new Error("database dump hash mismatch");
  if (sha256(objectBytes) !== manifest.objectInventorySha256)
    throw new Error("object inventory hash mismatch");
  if (sha256(configBytes) !== manifest.configInventorySha256)
    throw new Error("config inventory hash mismatch");
  if (sha256(integrityBytes) !== manifest.protectedIntegritySha256)
    throw new Error("protected integrity hash mismatch");
  if (decoded.objectInventory.length !== manifest.inventories.objectCount)
    throw new Error("object inventory count mismatch");

  return {
    status: "VERIFIED",
    schemaVersion: 1,
    recoveryPoint: manifest.recoveryPoint,
    bundlePath,
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const maxAgeHours = Number(requireArgument(args, "max-age-hours"));
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0)
    throw new Error("max age must be positive");
  const result = await verifyEngineBackup({
    manifestPath: requireArgument(args, "manifest"),
    keyFile: requireArgument(args, "key-file"),
    maxAgeHours,
    now: args.get("now"),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`backup verification failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
