import { databaseAuditWriter } from "@evaluation/audit";
import {
  AppendDocumentVersionSchema,
  AppError,
  CreateDocumentSchema,
  DocumentDetailSchema,
} from "@evaluation/contracts";
import { z } from "zod";

import { authorizeDocument } from "./document-authorization.js";

type Database = import("./model.js").DocumentDatabase;
type Transaction = import("./model.js").DocumentTransaction;
type Reader = import("./model.js").DocumentResourceIdentityReader;
type Identity = import("./model.js").DocumentResourceIdentity;
type Audit = import("./model.js").DocumentAuditWriter;
type Clock = import("./model.js").DocumentClock;
type SourceInput = import("@evaluation/contracts").DocumentSourceInput;

const ActorSchema = z.object({ userId: z.string().uuid(), active: z.boolean() }).strict();
const CreateCommandSchema = z
  .object({
    actor: ActorSchema,
    correlationId: z.string().uuid(),
    input: CreateDocumentSchema,
  })
  .strict();
const AppendCommandSchema = z
  .object({
    actor: ActorSchema,
    correlationId: z.string().uuid(),
    documentId: z.string().uuid(),
    input: AppendDocumentVersionSchema,
  })
  .strict();
const GetCommandSchema = z
  .object({
    actor: ActorSchema,
    correlationId: z.string().uuid(),
    documentId: z.string().uuid(),
  })
  .strict();

export class DocumentService {
  private readonly database: Database;
  private readonly reader: Reader;
  private readonly audit: Audit;
  private readonly clock: Clock;

  constructor(
    database: Database,
    reader: Reader,
    audit: Audit = databaseAuditWriter as Audit,
    clock: Clock = () => new Date(),
  ) {
    this.database = database;
    this.reader = reader;
    this.audit = audit;
    this.clock = clock;
  }

  async create(command: unknown): Promise<import("@evaluation/contracts").DocumentDetail> {
    const parsed = CreateCommandSchema.parse(command);
    const now = validNow(this.clock());
    const identity = await this.reader.read({
      kind: parsed.input.kind,
      resourceId: parsed.input.resourceId,
    });
    assertWritableIdentity(identity);
    try {
      return await serializable(this.database, async (transaction) => {
        await authorizeDocument(
          transaction,
          parsed.actor,
          identity,
          "document.version.create",
          now,
        );
        const scope = recordScope(identity);
        const existing = await transaction.documentRecord.findFirst({ where: scope });
        if (existing !== null) throw documentAlreadyExists();
        const template = await resolveActiveTemplate(transaction, identity);
        if (template === null) throw templateNotActive();
        await validateSources(transaction, identity, parsed.input.sources);
        const record = await transaction.documentRecord.create({
          data: {
            organizationId: identity.organizationId,
            departmentId: identity.departmentId,
            ...scope,
            templateVersionId: template.id,
            currentVersion: 0,
            createdById: parsed.actor.userId,
          },
        });
        await transaction.documentVersion.create({
          data: {
            documentId: record.id,
            version: 1,
            templateVersionId: template.id,
            createdById: parsed.actor.userId,
            reason: parsed.input.reason,
            sources: { create: sourceRows(parsed.input.sources) },
          },
        });
        const advanced = await transaction.documentRecord.updateMany({
          where: { id: record.id, currentVersion: 0 },
          data: { currentVersion: 1 },
        });
        if (advanced.count !== 1) throw versionConflict();
        await appendAudit(transaction, this.audit, {
          actorId: parsed.actor.userId,
          correlationId: parsed.correlationId,
          eventType: "document.created",
          identity,
          documentId: record.id,
          reason: parsed.input.reason,
          version: 1,
          templateVersionId: template.id,
        });
        return loadDetail(transaction, record.id);
      });
    } catch (error) {
      if (hasCode(error, "P2002")) throw documentAlreadyExists();
      throw error;
    }
  }

  async appendVersion(command: unknown): Promise<import("@evaluation/contracts").DocumentDetail> {
    const parsed = AppendCommandSchema.parse(command);
    const now = validNow(this.clock());
    const preview = await this.database.documentRecord.findUnique({
      where: { id: parsed.documentId },
      select: { projectId: true, workstreamId: true },
    });
    if (preview === null) throw notFound();
    const reference = resourceReference(preview);
    const identity = await this.reader.read(reference);
    assertWritableIdentity(identity);

    return serializable(this.database, async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM "DocumentRecord"
        WHERE id = ${parsed.documentId}::uuid
        FOR UPDATE
      `;
      const record = await transaction.documentRecord.findUnique({
        where: { id: parsed.documentId },
      });
      if (record === null || !sameRecordScope(record, identity)) throw notFound();
      if (record.currentVersion !== parsed.input.expectedVersion) throw versionConflict();
      await authorizeDocument(transaction, parsed.actor, identity, "document.version.create", now);
      await validateSources(transaction, identity, parsed.input.sources);
      const nextVersion = record.currentVersion + 1;
      await transaction.documentVersion.create({
        data: {
          documentId: record.id,
          version: nextVersion,
          templateVersionId: record.templateVersionId,
          createdById: parsed.actor.userId,
          reason: parsed.input.reason,
          sources: { create: sourceRows(parsed.input.sources) },
        },
      });
      const advanced = await transaction.documentRecord.updateMany({
        where: { id: record.id, currentVersion: parsed.input.expectedVersion },
        data: { currentVersion: nextVersion },
      });
      if (advanced.count !== 1) throw versionConflict();
      await appendAudit(transaction, this.audit, {
        actorId: parsed.actor.userId,
        correlationId: parsed.correlationId,
        eventType: "document.version_created",
        identity,
        documentId: record.id,
        reason: parsed.input.reason,
        version: nextVersion,
        templateVersionId: record.templateVersionId,
      });
      return loadDetail(transaction, record.id);
    });
  }

  async get(command: unknown): Promise<import("@evaluation/contracts").DocumentDetail> {
    const parsed = GetCommandSchema.parse(command);
    const now = validNow(this.clock());
    const preview = await this.database.documentRecord.findUnique({
      where: { id: parsed.documentId },
      select: { projectId: true, workstreamId: true },
    });
    if (preview === null) throw notFound();
    const identity = await this.reader.read(resourceReference(preview));
    if (identity === null) throw notFound();
    await authorizeDocument(this.database, parsed.actor, identity, "document.read", now);
    return loadDetail(this.database, parsed.documentId);
  }
}

async function resolveActiveTemplate(transaction: Transaction, identity: Identity) {
  const department = await transaction.documentTemplateVersion.findFirst({
    where: {
      status: "active",
      template: {
        organizationId: identity.organizationId,
        departmentId: identity.departmentId,
        scopeType: "department",
        kind: identity.kind,
      },
    },
    select: { id: true },
  });
  return (
    department ??
    transaction.documentTemplateVersion.findFirst({
      where: {
        status: "active",
        template: {
          organizationId: identity.organizationId,
          departmentId: null,
          scopeType: "organization",
          kind: identity.kind,
        },
      },
      select: { id: true },
    })
  );
}

async function validateSources(
  transaction: Transaction,
  identity: Identity,
  sources: readonly SourceInput[],
): Promise<void> {
  const uploadIds = sources.flatMap((source) =>
    source.sourceType === "upload" ? [source.uploadedSourceId] : [],
  );
  if (new Set(uploadIds).size !== uploadIds.length) throw invalidInput();
  if (uploadIds.length === 0) return;
  const uploads = await transaction.uploadedSource.findMany({
    where: { id: { in: uploadIds } },
    select: {
      id: true,
      organizationId: true,
      departmentId: true,
      projectId: true,
      workstreamId: true,
      documentVersionSource: { select: { id: true } },
    },
  });
  if (uploads.length !== uploadIds.length) throw invalidInput();
  const scopeMatches = uploads.every(
    (upload) =>
      upload.organizationId === identity.organizationId &&
      upload.departmentId === identity.departmentId &&
      upload.projectId === (identity.kind === "project" ? identity.resourceId : null) &&
      upload.workstreamId === (identity.kind === "workstream" ? identity.resourceId : null),
  );
  if (!scopeMatches) throw scopeMismatch();
  if (uploads.some(({ documentVersionSource }) => documentVersionSource !== null)) {
    throw invalidInput();
  }
}

function sourceRows(sources: readonly SourceInput[]) {
  return sources.map((source, index) => {
    const common = { position: index + 1, sourceType: source.sourceType };
    if (source.sourceType === "upload") {
      return { ...common, uploadedSourceId: source.uploadedSourceId };
    }
    if (source.sourceType === "external_link") return { ...common, url: source.url };
    return { ...common, url: source.url, externalSourceId: source.sourceId };
  });
}

async function loadDetail(database: Transaction, documentId: string) {
  const document = await database.documentRecord.findUnique({
    where: { id: documentId },
    include: {
      versions: {
        orderBy: { version: "asc" },
        include: {
          sources: {
            orderBy: { position: "asc" },
            include: {
              uploadedSource: {
                select: {
                  id: true,
                  originalFilename: true,
                  detectedMime: true,
                  detectedType: true,
                  byteSize: true,
                  sha256: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (document === null) throw notFound();
  const kind = document.workstreamId === null ? ("project" as const) : ("workstream" as const);
  const resourceId = document.workstreamId ?? document.projectId;
  if (resourceId === null) throw notFound();
  return DocumentDetailSchema.parse({
    id: document.id,
    kind,
    resourceId,
    templateVersionId: document.templateVersionId,
    currentVersion: document.currentVersion,
    createdAt: document.createdAt.toISOString(),
    versions: document.versions.map((version) => ({
      id: version.id,
      documentId: document.id,
      version: version.version,
      templateVersionId: version.templateVersionId,
      createdById: version.createdById,
      reason: version.reason,
      createdAt: version.createdAt.toISOString(),
      sources: version.sources.map((source) => {
        const common = {
          id: source.id,
          position: source.position,
          sourceType: source.sourceType,
        };
        if (source.sourceType === "upload" && source.uploadedSource !== null) {
          return {
            ...common,
            sourceType: "upload",
            uploadedSource: {
              id: source.uploadedSource.id,
              kind,
              resourceId,
              filename: source.uploadedSource.originalFilename,
              detectedMime: source.uploadedSource.detectedMime,
              detectedType: source.uploadedSource.detectedType,
              byteSize: source.uploadedSource.byteSize,
              sha256: source.uploadedSource.sha256,
              createdAt: source.uploadedSource.createdAt.toISOString(),
            },
          };
        }
        if (source.sourceType === "external_link" && source.url !== null) {
          return { ...common, sourceType: "external_link", url: source.url };
        }
        if (
          source.sourceType === "github" &&
          source.url !== null &&
          source.externalSourceId !== null
        ) {
          return {
            ...common,
            sourceType: "github",
            url: source.url,
            sourceId: source.externalSourceId,
          };
        }
        throw invalidInput();
      }),
    })),
  });
}

function recordScope(identity: Identity) {
  return identity.kind === "project"
    ? { projectId: identity.resourceId }
    : { workstreamId: identity.resourceId };
}

function resourceReference(
  record: Readonly<{ projectId: string | null; workstreamId: string | null }>,
) {
  if (record.workstreamId !== null) {
    return { kind: "workstream" as const, resourceId: record.workstreamId };
  }
  if (record.projectId !== null) return { kind: "project" as const, resourceId: record.projectId };
  throw notFound();
}

function sameRecordScope(
  record: Readonly<{ projectId: string | null; workstreamId: string | null }>,
  identity: Identity,
) {
  return identity.kind === "project"
    ? record.projectId === identity.resourceId && record.workstreamId === null
    : record.workstreamId === identity.resourceId && record.projectId === null;
}

function assertWritableIdentity(identity: Identity | null): asserts identity is Identity {
  if (identity === null) throw notFound();
  if (identity.status === "completed" || identity.status === "archived") throw invalidState();
}

async function appendAudit(
  transaction: Transaction,
  audit: Audit,
  input: Readonly<{
    actorId: string;
    correlationId: string;
    eventType: "document.created" | "document.version_created";
    identity: Identity;
    documentId: string;
    reason: string;
    version: number;
    templateVersionId: string;
  }>,
) {
  await audit.append(transaction, {
    eventType: input.eventType,
    actor: { kind: "human", id: input.actorId },
    effectiveSubjectId: input.actorId,
    scopeType: input.identity.kind,
    scopeId: input.identity.resourceId,
    targetType: "document",
    targetId: input.documentId,
    reason: input.reason,
    safeDiff: { version: input.version, templateVersionId: input.templateVersionId },
    correlationId: input.correlationId,
    source: "api",
  });
}

async function serializable<T>(
  database: Database,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  try {
    return await database.$transaction(operation, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isSerializationConflict(error)) throw versionConflict();
    throw error;
  }
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function isSerializationConflict(error: unknown, seen: Set<object> = new Set()): boolean {
  if (hasCode(error, "P2034")) return true;
  if (typeof error !== "object" || error === null || seen.has(error)) return false;
  seen.add(error);
  for (const key of ["code", "kind", "originalCode", "cause", "meta", "driverAdapterError"]) {
    const value = Reflect.get(error, key);
    if (value === "40001" || value === "TransactionWriteConflict") return true;
    if (isSerializationConflict(value, seen)) return true;
  }
  return false;
}

function validNow(now: Date): Date {
  if (!Number.isFinite(now.getTime())) throw new Error("Document clock is invalid");
  return now;
}

function notFound() {
  return new AppError("RESOURCE_NOT_FOUND", "errors.documents.resourceNotFound", 404);
}
function invalidState() {
  return new AppError("RESOURCE_STATE_INVALID", "errors.documents.resourceStateInvalid", 409);
}
function documentAlreadyExists() {
  return new AppError("DOCUMENT_ALREADY_EXISTS", "errors.documents.alreadyExists", 409);
}
function templateNotActive() {
  return new AppError("DOCUMENT_TEMPLATE_NOT_ACTIVE", "errors.documents.templateNotActive", 409);
}
function versionConflict() {
  return new AppError("VERSION_CONFLICT", "errors.documents.versionConflict", 409);
}
function invalidInput() {
  return new AppError("DOCUMENT_INPUT_INVALID", "errors.documents.inputInvalid", 400);
}
function scopeMismatch() {
  return new AppError("SCOPE_MISMATCH", "errors.documents.scopeMismatch", 403);
}
