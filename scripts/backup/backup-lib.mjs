import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { readFile } from "node:fs/promises";

export function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined)
      throw new Error("arguments must be --key value pairs");
    values.set(key.slice(2), value);
  }
  return values;
}

export function requireArgument(argumentsMap, name) {
  const value = argumentsMap.get(name);
  if (!value) throw new Error(`missing required argument --${name}`);
  return value;
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function readEncryptionKey(path) {
  const key = await readFile(path);
  if (key.length !== 32) throw new Error("backup key handle must resolve to exactly 32 bytes");
  return key;
}

export function encryptBundle(plaintext, key, iv) {
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { encrypted, authenticationTag: cipher.getAuthTag() };
}

export function decryptBundle(encrypted, key, iv, authenticationTag) {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authenticationTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function signManifest(manifest, key) {
  return createHmac("sha256", key).update(canonicalJson(manifest)).digest("hex");
}

export function verifyManifestSignature(manifest, signature, key) {
  const expected = Buffer.from(signManifest(manifest, key), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function parseJson(buffer, label) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new Error(`${label} must contain valid JSON`);
  }
}
