import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  AppError,
  PrivateCaptureUploadMetadataSchema,
  PrivateCaptureUploadSchema,
} from "@evaluation/contracts";
import { z } from "zod";

import { inspectFile } from "./file-inspection.js";

type Database = import("./model.js").DocumentDatabase;
type Transaction = import("./model.js").DocumentTransaction;
type Storage = import("./model.js").PrivateObjectStorage;
type Scanner = import("./model.js").MalwareScanner;
type Policy = import("./model.js").UploadPolicy;
type Audit = import("./model.js").DocumentAuditWriter;

const ActorSchema = z.object({ userId: z.string().uuid(), active: z.boolean() }).strict();
const StageCommandSchema = z
  .object({
    actor: ActorSchema,
    correlationId: z.string().uuid(),
    metadata: PrivateCaptureUploadMetadataSchema,
  })
  .strict();
const ReadCommandSchema = z
  .object({
    actor: ActorSchema,
    correlationId: z.string().uuid(),
    privateCaptureUploadId: z.string().uuid(),
  })
  .strict();

export class PrivateCaptureUploadService {
  constructor(
    private readonly database: Database,
    private readonly storage: Storage,
    private readonly scanner: Scanner,
    private readonly policy: Policy,
    private readonly audit: Audit,
    private readonly options: Readonly<{
      temporaryRoot?: string;
      randomId?: () => string;
      now?: () => Date;
    }> = {},
  ) {}

  async stage(command: unknown, stream: NodeJS.ReadableStream) {
    const parsed = StageCommandSchema.parse(command);
    assertActive(parsed.actor);
    const directory = await mkdtemp(
      path.join(this.options.temporaryRoot ?? tmpdir(), "private-capture-"),
    );
    const stagedPath = path.join(directory, "source");
    let objectKey: string | undefined;
    try {
      const mediaClass = mediaClassFor(parsed.metadata.filename);
      const staged = await stageStream(stream, stagedPath, this.policy.maxBytesByClass[mediaClass]);
      const inspected = await inspectFile({
        path: stagedPath,
        filename: parsed.metadata.filename,
        declaredMime: parsed.metadata.declaredMime,
        policy: this.policy,
      });
      await this.scanner.scan(stagedPath);
      objectKey = [
        "private-captures",
        parsed.actor.userId,
        (this.options.randomId ?? randomUUID)(),
      ].join("/");
      await this.storage.put({
        key: objectKey,
        path: stagedPath,
        contentType: inspected.detectedMime,
        byteSize: staged.byteSize,
      });
      try {
        const upload = await this.database.$transaction(
          async (transaction: Transaction) => {
            const created = await transaction.privateCaptureUpload.create({
              data: {
                ownerId: parsed.actor.userId,
                originalFilename: parsed.metadata.filename,
                objectKey: objectKey!,
                detectedType: inspected.detectedType,
                detectedMime: inspected.detectedMime,
                byteSize: staged.byteSize,
                sha256: staged.sha256,
              },
            });
            await this.audit.append(transaction, {
              eventType: "private_capture.upload_staged",
              actor: { kind: "human", id: parsed.actor.userId },
              effectiveSubjectId: parsed.actor.userId,
              scopeType: "system",
              scopeId: parsed.actor.userId,
              targetType: "private_capture_upload",
              targetId: created.id,
              reason: "Employee staged a private capture file",
              safeDiff: {
                detectedType: created.detectedType,
                detectedMime: created.detectedMime,
                byteSize: created.byteSize,
                sha256: created.sha256,
              },
              correlationId: parsed.correlationId,
              source: "api",
            });
            return created;
          },
          { isolationLevel: "Serializable" },
        );
        return PrivateCaptureUploadSchema.parse({
          id: upload.id,
          filename: upload.originalFilename,
          detectedType: upload.detectedType,
          detectedMime: upload.detectedMime,
          byteSize: upload.byteSize,
          sha256: upload.sha256,
          createdAt: upload.createdAt.toISOString(),
        });
      } catch (error) {
        await this.storage.delete(objectKey);
        throw error;
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  async assertOwned(command: unknown): Promise<void> {
    const parsed = ReadCommandSchema.parse(command);
    assertActive(parsed.actor);
    const upload = await this.database.privateCaptureUpload.findUnique({
      where: { id: parsed.privateCaptureUploadId },
      select: { ownerId: true },
    });
    if (upload === null || upload.ownerId !== parsed.actor.userId) throw forbidden();
  }

  async signRead(command: unknown): Promise<Readonly<{ url: string; expiresAt: string }>> {
    const parsed = ReadCommandSchema.parse(command);
    assertActive(parsed.actor);
    const upload = await this.database.privateCaptureUpload.findUnique({
      where: { id: parsed.privateCaptureUploadId },
      select: { id: true, ownerId: true, objectKey: true },
    });
    if (upload === null || upload.ownerId !== parsed.actor.userId) throw forbidden();
    const url = await this.storage.signGet({
      key: upload.objectKey,
      expiresInSeconds: this.policy.signedUrlTtlSeconds,
    });
    await this.database.$transaction(
      async (transaction: Transaction) => {
        await this.audit.append(transaction, {
          eventType: "private_capture.upload_read_signed",
          actor: { kind: "human", id: parsed.actor.userId },
          effectiveSubjectId: parsed.actor.userId,
          scopeType: "system",
          scopeId: parsed.actor.userId,
          targetType: "private_capture_upload",
          targetId: upload.id,
          reason: "Employee opened a private capture file",
          safeDiff: { expiresInSeconds: this.policy.signedUrlTtlSeconds },
          correlationId: parsed.correlationId,
          source: "api",
        });
      },
      { isolationLevel: "Serializable" },
    );
    return {
      url,
      expiresAt: new Date(
        (this.options.now ?? (() => new Date()))().getTime() +
          this.policy.signedUrlTtlSeconds * 1000,
      ).toISOString(),
    };
  }
}

async function stageStream(
  stream: NodeJS.ReadableStream,
  target: string,
  maximumBytes: number,
): Promise<Readonly<{ byteSize: number; sha256: string }>> {
  const file = await open(target, "wx", 0o600);
  const hash = createHash("sha256");
  let byteSize = 0;
  try {
    for await (const chunk of stream) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string | Uint8Array);
      byteSize += bytes.length;
      if (byteSize > maximumBytes)
        throw new AppError("UPLOAD_SIZE_REJECTED", "errors.documents.uploadSizeRejected", 413);
      hash.update(bytes);
      await file.write(bytes);
    }
  } finally {
    await file.close();
  }
  if (byteSize === 0)
    throw new AppError("UPLOAD_TYPE_REJECTED", "errors.documents.uploadTypeRejected", 400);
  return { byteSize, sha256: hash.digest("hex") };
}

function mediaClassFor(filename: string): "text" | "office" | "image" {
  const extension = filename.toLowerCase().match(/\.([a-z0-9]+)$/u)?.[1];
  if (["md", "txt"].includes(extension ?? "")) return "text";
  if (["docx", "pdf"].includes(extension ?? "")) return "office";
  if (["png", "jpg", "jpeg", "webp"].includes(extension ?? "")) return "image";
  throw new AppError("UPLOAD_TYPE_REJECTED", "errors.documents.uploadTypeRejected", 400);
}

function assertActive(actor: { active: boolean }) {
  if (!actor.active) throw forbidden();
}

function forbidden() {
  return new AppError("PRIVATE_CAPTURE_FORBIDDEN", "errors.privateCapture.forbidden", 403);
}
