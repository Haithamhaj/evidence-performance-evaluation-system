import { createReadStream } from "node:fs";
import { connect } from "node:net";

import { AppError } from "@evaluation/contracts";

export type ClamAvConfig = Readonly<{
  host: string;
  port: number;
  timeoutMilliseconds: number;
}>;
type ScannerPort = import("./model.js").MalwareScanner;

export class ClamAvScanner implements ScannerPort {
  private readonly config: ClamAvConfig;

  constructor(config: ClamAvConfig) {
    if (
      config.host.trim().length === 0 ||
      !Number.isInteger(config.port) || config.port < 1 || config.port > 65_535 ||
      !Number.isInteger(config.timeoutMilliseconds) || config.timeoutMilliseconds < 1
    ) throw new Error("ClamAV configuration is invalid");
    this.config = config;
  }

  async scan(path: string): Promise<"clean"> {
    let socket: import("node:net").Socket | undefined;
    try {
      socket = await openSocket(this.config);
      socket.write("zINSTREAM\0");
      for await (const chunk of createReadStream(path, { highWaterMark: 64 * 1024 })) {
        const bytes = chunk as Buffer;
        const length = Buffer.allocUnsafe(4);
        length.writeUInt32BE(bytes.length);
        if (!socket.write(length)) await drain(socket);
        if (!socket.write(bytes)) await drain(socket);
      }
      const end = Buffer.alloc(4);
      const replyPromise = readReply(socket, this.config.timeoutMilliseconds);
      socket.end(end);
      const reply = await replyPromise;
      if (reply !== "stream: OK\0") throw safetyRejected();
      return "clean";
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw safetyRejected();
    } finally {
      socket?.destroy();
    }
  }
}

function openSocket(config: ClamAvConfig): Promise<import("node:net").Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: config.host, port: config.port });
    socket.setTimeout(config.timeoutMilliseconds);
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
    socket.once("timeout", () => reject(new Error("scanner timeout")));
  });
}

function drain(socket: import("node:net").Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once("drain", resolve);
    socket.once("error", reject);
  });
}

function readReply(socket: import("node:net").Socket, timeoutMilliseconds: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const timeout = setTimeout(() => reject(new Error("scanner timeout")), timeoutMilliseconds);
    socket.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 4_096) {
        clearTimeout(timeout);
        reject(new Error("scanner reply too large"));
        return;
      }
      chunks.push(chunk);
      if (chunk.includes(0)) {
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks).toString("utf8"));
      }
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    socket.once("close", () => {
      if (chunks.length === 0) {
        clearTimeout(timeout);
        reject(new Error("scanner closed without response"));
      }
    });
  });
}

function safetyRejected() {
  return new AppError("UPLOAD_SAFETY_REJECTED", "errors.documents.uploadSafetyRejected", 400);
}
