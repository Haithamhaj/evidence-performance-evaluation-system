import { createServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ClamAvScanner } from "./clamav-scanner.js";

const servers: import("node:net").Server[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function source(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "clamav-scanner-"));
  directories.push(directory);
  const file = path.join(directory, "source.txt");
  await writeFile(file, "safe test content");
  return file;
}

async function scanner(reply: string | null, timeoutMilliseconds = 200): Promise<ClamAvScanner> {
  const server = createServer((socket) => {
    const chunks: Buffer[] = [];
    socket.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    socket.on("end", () => {
      const request = Buffer.concat(chunks);
      const command = Buffer.from("zINSTREAM\0");
      if (!request.subarray(0, command.length).equals(command)) {
        socket.end("stream: protocol ERROR\0");
        return;
      }
      if (reply !== null) socket.end(reply);
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("test server missing port");
  return new ClamAvScanner({ host: "127.0.0.1", port: address.port, timeoutMilliseconds });
}

describe("ClamAvScanner", () => {
  it("accepts only the clean INSTREAM response", async () => {
    await expect((await scanner("stream: OK\0")).scan(await source())).resolves.toBe("clean");
  });

  it.each([
    "stream: Eicar-Test-Signature FOUND\0",
    "stream: size limit exceeded ERROR\0",
    "unrecognized response\0",
  ])("fails closed for scanner response %s", async (reply) => {
    await expect((await scanner(reply)).scan(await source())).rejects.toMatchObject({
      code: "UPLOAD_SAFETY_REJECTED",
    });
  });

  it("fails closed when the scanner times out", async () => {
    await expect((await scanner(null, 20)).scan(await source())).rejects.toMatchObject({
      code: "UPLOAD_SAFETY_REJECTED",
    });
  });
});
