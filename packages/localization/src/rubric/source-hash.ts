import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export function sha256Content(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function sha256File(filePath: string): Promise<string> {
  return sha256Content(await readFile(filePath));
}
