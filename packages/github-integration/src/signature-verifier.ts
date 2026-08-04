import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifies GitHub's sha256 HMAC without parsing or retaining the request body. */
export function verifyGitHubSignature(
  rawBody: Uint8Array,
  signature: string | undefined,
  secret: string,
): boolean {
  if (secret.trim().length === 0 || signature === undefined) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const supplied = Buffer.from(signature, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return supplied.length === expectedBytes.length && timingSafeEqual(supplied, expectedBytes);
}
