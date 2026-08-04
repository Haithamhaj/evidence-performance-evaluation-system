import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { databaseAuditWriter } from "@evaluation/audit";
import { AppError, StageUploadMetadataSchema, UploadedSourceSchema } from "@evaluation/contracts";
import { z } from "zod";

import { authorizeDocument } from "./document-authorization.js";
import { inspectFile } from "./file-inspection.js";

type Database = import("./model.js").DocumentDatabase;
type Transaction = import("./model.js").DocumentTransaction;
type Reader = import("./model.js").DocumentResourceIdentityReader;
type Storage = import("./model.js").PrivateObjectStorage;
type Scanner = import("./model.js").MalwareScanner;
type Policy = import("./model.js").UploadPolicy;
type Audit = import("./model.js").DocumentAuditWriter;

const CommandSchema = z
  .object({
    actor: z.object({ userId: z.string().uuid(), active: z.boolean() }).strict(),
    correlationId: z.string().uuid(),
    metadata: StageUploadMetadataSchema,
  })
  .strict();

const SignReadCommandSchema = z
  .object({
    actor: z.object({ userId: z.string().uuid(), active: z.boolean() }).strict(),
    correlationId: z.string().uuid(),
    uploadedSourceId: z.string().uuid(),
  })
  .strict();

export class UploadService {
  private readonly database: Database;
  private readonly reader: Reader;
  private readonly storage: Storage;
  private readonly scanner: Scanner;
  private readonly policy: Policy;
  private readonly audit: Audit;
  private readonly temporaryRoot: string;
  private readonly randomId: () => string;
  private readonly now: () => Date;

  constructor(
    database: Database,
    reader: Reader,
    storage: Storage,
    scanner: Scanner,
    policy: Policy,
    audit: Audit = databaseAuditWriter as Audit,
    options: Readonly<{
      temporaryRoot?: string;
      randomId?: () => string;
      now?: () => Date;
    }> = {},
  ) {
    assertPolicy(policy);
    this.database = database;
    this.reader = reader;
    this.storage = storage;
    this.scanner = scanner;
    this.policy = policy;
    this.audit = audit;
    this.temporaryRoot = options.temporaryRoot ?? tmpdir();
    this.randomId = options.randomId ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async stage(
    command: unknown,
    stream: NodeJS.ReadableStream,
  ): Promise<import("@evaluation/contracts").UploadedSource> {
    const parsed = CommandSchema.parse(command);
    const identity = await this.reader.read({
      kind: parsed.metadata.kind,
      resourceId: parsed.metadata.resourceId,
    });
    if (identity === null) throw resourceNotFound();
    if (["completed", "archived"].includes(identity.status)) throw resourceStateInvalid();
    await authorizeDocument(
      this.database,
      parsed.actor,
      identity,
      "document.version.create",
      this.now(),
    );

    const mediaClass = classForFilename(parsed.metadata.filename);
    const directory = await mkdtemp(path.join(this.temporaryRoot, "document-upload-"));
    const stagedPath = path.join(directory, "source");
    let objectKey: string | undefined;
    try {
      const staged = await stageStream(stream, stagedPath, this.policy.maxBytesByClass[mediaClass]);
      const inspected = await inspectFile({
        path: stagedPath,
        filename: parsed.metadata.filename,
        declaredMime: parsed.metadata.declaredMime,
        policy: this.policy,
      });
      await this.scanner.scan(stagedPath);
      objectKey = [
        "documents",
        identity.organizationId,
        identity.kind,
        identity.resourceId,
        this.randomId(),
      ].join("/");
      await this.storage.put({
        key: objectKey,
        path: stagedPath,
        contentType: inspected.detectedMime,
        byteSize: staged.byteSize,
      });
      try {
        const uploaded = await this.database.$transaction(
          async (transaction) => {
            const source = await transaction.uploadedSource.create({
              data: {
                organizationId: identity.organizationId,
                departmentId: identity.departmentId,
                projectId: identity.kind === "project" ? identity.resourceId : null,
                workstreamId: identity.kind === "workstream" ? identity.resourceId : null,
                originalFilename: parsed.metadata.filename,
                objectKey: objectKey!,
                detectedType: inspected.detectedType,
                detectedMime: inspected.detectedMime,
                byteSize: staged.byteSize,
                sha256: staged.sha256,
                createdById: parsed.actor.userId,
                reason: parsed.metadata.reason,
              },
            });
            await this.audit.append(transaction, {
              eventType: "document.upload_staged",
              actor: { kind: "human", id: parsed.actor.userId },
              effectiveSubjectId: parsed.actor.userId,
              scopeType: identity.kind,
              scopeId: identity.resourceId,
              targetType: "uploaded_source",
              targetId: source.id,
              reason: parsed.metadata.reason,
              safeDiff: {
                detectedType: source.detectedType,
                detectedMime: source.detectedMime,
                byteSize: source.byteSize,
                sha256: source.sha256,
              },
              correlationId: parsed.correlationId,
              source: "api",
            });
            return source;
          },
          { isolationLevel: "Serializable" },
        );
        return UploadedSourceSchema.parse({
          id: uploaded.id,
          kind: identity.kind,
          resourceId: identity.resourceId,
          filename: uploaded.originalFilename,
          detectedMime: uploaded.detectedMime,
          detectedType: uploaded.detectedType,
          byteSize: uploaded.byteSize,
          sha256: uploaded.sha256,
          createdAt: uploaded.createdAt.toISOString(),
        });
      } catch (error) {
        await this.storage.delete(objectKey);
        throw error;
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  async signRead(command: unknown): Promise<Readonly<{ url: string; expiresAt: string }>> {
    const parsed = SignReadCommandSchema.parse(command);
    const source = await this.database.uploadedSource.findUnique({
      where: { id: parsed.uploadedSourceId },
      select: {
        id: true,
        objectKey: true,
        projectId: true,
        workstreamId: true,
      },
    });
    if (source === null) throw resourceNotFound();
    const kind = source.workstreamId === null ? ("project" as const) : ("workstream" as const);
    const resourceId = source.workstreamId ?? source.projectId;
    if (resourceId === null) throw resourceNotFound();
    const identity = await this.reader.read({ kind, resourceId });
    if (identity === null) throw resourceNotFound();
    await authorizeDocument(this.database, parsed.actor, identity, "document.read", this.now());

    const url = await this.storage.signGet({
      key: source.objectKey,
      expiresInSeconds: this.policy.signedUrlTtlSeconds,
    });
    await this.database.$transaction(
      async (transaction) => {
        await this.audit.append(transaction, {
          eventType: "document.upload_read_signed",
          actor: { kind: "human", id: parsed.actor.userId },
          effectiveSubjectId: parsed.actor.userId,
          scopeType: identity.kind,
          scopeId: identity.resourceId,
          targetType: "uploaded_source",
          targetId: source.id,
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
        this.now().getTime() + this.policy.signedUrlTtlSeconds * 1_000,
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
      if (byteSize > maximumBytes) throw sizeRejected();
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

function classForFilename(filename: string): import("./model.js").UploadMediaClass {
  const extension = filename.toLowerCase().match(/\.([a-z0-9]+)$/u)?.[1];
  if (["md", "txt"].includes(extension ?? "")) return "text";
  if (["docx", "pdf"].includes(extension ?? "")) return "office";
  if (["png", "jpg", "jpeg", "webp"].includes(extension ?? "")) return "image";
  if (["wav", "mp3", "m4a"].includes(extension ?? "")) return "audio";
  throw new AppError("UPLOAD_TYPE_REJECTED", "errors.documents.uploadTypeRejected", 400);
}

function assertPolicy(policy: Policy): void {
  const values = [
    ...Object.values(policy.maxBytesByClass),
    policy.maxArchiveEntries,
    policy.maxArchiveUncompressedBytes,
    policy.maxArchiveCompressionRatio,
    policy.signedUrlTtlSeconds,
  ];
  if (values.some((value) => !Number.isSafeInteger(value) || value < 1)) {
    throw new Error("Document upload policy is invalid");
  }
}

function sizeRejected() {
  return new AppError("UPLOAD_SIZE_REJECTED", "errors.documents.uploadSizeRejected", 413);
}
function resourceNotFound() {
  return new AppError("RESOURCE_NOT_FOUND", "errors.documents.resourceNotFound", 404);
}
function resourceStateInvalid() {
  return new AppError("RESOURCE_STATE_INVALID", "errors.documents.resourceStateInvalid", 409);
}
