import {
  AppError,
  ConfirmEvidenceInputSchema,
  CreateGitHubEvidenceInputSchema,
  CreateManualEvidenceInputSchema,
  RejectEvidenceInputSchema,
  ReviseEvidenceInputSchema,
} from "@evaluation/contracts";
import { z } from "zod";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type AuditWriter = import("@evaluation/contracts").AuditWriter<Transaction>;

const ActorSchema = z.object({ userId: z.string().uuid(), active: z.boolean() }).strict();
const CreateCommandSchema = z
  .object({
    actor: ActorSchema,
    correlationId: z.string().uuid(),
    input: CreateManualEvidenceInputSchema,
  })
  .strict();
const CreateGitHubSuggestionCommandSchema = z
  .object({
    actor: ActorSchema,
    correlationId: z.string().uuid(),
    input: CreateGitHubEvidenceInputSchema,
  })
  .strict();
const EvidenceCommandSchema = z
  .object({
    actor: ActorSchema,
    correlationId: z.string().uuid(),
    evidenceId: z.string().uuid(),
  })
  .strict();
const ReviseCommandSchema = EvidenceCommandSchema.extend({
  input: ReviseEvidenceInputSchema,
}).strict();
const ConfirmCommandSchema = EvidenceCommandSchema.extend({
  input: ConfirmEvidenceInputSchema,
}).strict();
const RejectCommandSchema = EvidenceCommandSchema.extend({
  input: RejectEvidenceInputSchema,
}).strict();

export interface EvidenceScopeReader {
  authorizeIn(
    transaction: Transaction,
    input: Readonly<{
      actor: { userId: string; active: boolean };
      projectId: string;
      workstreamId: string | null;
      workItemId: string | null;
      progressComponentId: string | null;
      dynamicCriterionId: string | null;
      at: Date;
    }>,
  ): Promise<void>;
}

export interface SafeEvidenceUploadReader {
  getApprovedUploadIn(
    transaction: Transaction,
    input: Readonly<{
      actor: { userId: string; active: boolean };
      uploadedSourceId: string;
      projectId: string;
      workstreamId: string | null;
    }>,
  ): Promise<{
    objectKey: string;
    mediaType: string;
    checksumSha256: string;
    sizeBytes: number;
  }>;
}

export interface GitHubEvidenceSourceReader {
  getVerifiedSourceIn(
    transaction: Transaction,
    input: Readonly<{ sourceEventId: string; projectId: string }>,
  ): Promise<Readonly<{ sourceEventId: string; sourceUrl: string }>>;
}

export class EvidenceService {
  private readonly client: DatabaseClient;
  private readonly scopeReader: EvidenceScopeReader;
  private readonly uploadReader: SafeEvidenceUploadReader;
  private readonly auditWriter: AuditWriter;
  private readonly clock: () => Date;
  private readonly githubSourceReader: GitHubEvidenceSourceReader | undefined;

  constructor(
    client: DatabaseClient,
    scopeReader: EvidenceScopeReader,
    uploadReader: SafeEvidenceUploadReader,
    auditWriter: AuditWriter,
    clock: () => Date = () => new Date(),
    githubSourceReader?: GitHubEvidenceSourceReader,
  ) {
    this.client = client;
    this.scopeReader = scopeReader;
    this.uploadReader = uploadReader;
    this.auditWriter = auditWriter;
    this.clock = clock;
    this.githubSourceReader = githubSourceReader;
  }

  async create(command: unknown): Promise<EvidenceDetail> {
    const parsed = CreateCommandSchema.parse(command);
    const at = validClock(this.clock());
    return serializable(this.client, (transaction) => this.createIn(transaction, parsed, at));
  }

  async createFromGitHubSuggestion(command: unknown): Promise<EvidenceDetail> {
    const parsed = CreateGitHubSuggestionCommandSchema.parse(command);
    const at = validClock(this.clock());
    if (this.githubSourceReader === undefined) throw invalidState();
    return serializable(this.client, async (transaction) => {
      const source = await this.githubSourceReader!.getVerifiedSourceIn(transaction, {
        sourceEventId: parsed.input.sourceEventId,
        projectId: parsed.input.projectId,
      });
      const created = CreateCommandSchema.parse({
        actor: parsed.actor,
        correlationId: parsed.correlationId,
        input: {
          idempotencyKey: parsed.input.idempotencyKey,
          projectId: parsed.input.projectId,
          workstreamId: parsed.input.workstreamId,
          workItemId: parsed.input.workItemId,
          capturedFromWorkItem: false,
          updateSourceId: null,
          source: { kind: "url", url: source.sourceUrl },
          supportedClaim: parsed.input.supportedClaim,
          relatedKpiComponentId: parsed.input.relatedKpiComponentId,
          relatedCriterionId: parsed.input.relatedCriterionId,
          contributionContext: parsed.input.contributionContext,
          executionMode: parsed.input.executionMode,
        },
      });
      return this.createIn(transaction, created, at, source.sourceEventId);
    });
  }

  private async createIn(
    transaction: Transaction,
    parsed: z.infer<typeof CreateCommandSchema>,
    at: Date,
    githubSourceEventId?: string,
  ): Promise<EvidenceDetail> {
    await this.scopeReader.authorizeIn(transaction, {
      actor: parsed.actor,
      projectId: parsed.input.projectId,
      workstreamId: parsed.input.workstreamId,
      workItemId: parsed.input.workItemId,
      progressComponentId: parsed.input.relatedKpiComponentId,
      dynamicCriterionId: parsed.input.relatedCriterionId,
      at,
    });
    const existing = await transaction.evidenceRecord.findUnique({
      where: { idempotencyKey: parsed.input.idempotencyKey },
      include: { revisions: { orderBy: { revision: "desc" }, take: 1 } },
    });
    if (existing !== null) {
      assertOwner(existing.employeeId, parsed.actor);
      const revision = existing.revisions[0];
      if (revision === undefined) throw invalidState();
      return serialize(existing, revision);
    }
    const source = await resolveSource(transaction, this.uploadReader, parsed);
    const revisionKind = parsed.input.executionMode === "manual" ? "manual_draft" : "ai_draft";
    const record = await transaction.evidenceRecord.create({
      data: {
        idempotencyKey: parsed.input.idempotencyKey,
        projectId: parsed.input.projectId,
        workstreamId: parsed.input.workstreamId,
        workItemId: parsed.input.workItemId,
        capturedFromWorkItem: parsed.input.capturedFromWorkItem,
        updateSourceId: parsed.input.updateSourceId,
        ...(githubSourceEventId === undefined ? {} : { githubSourceEventId }),
        employeeId: parsed.actor.userId,
        revisions: {
          create: {
            revision: 1,
            revisionKind,
            sourceKind: parsed.input.source.kind,
            ...source,
            supportedClaim: parsed.input.supportedClaim,
            contributionContext: parsed.input.contributionContext,
            executionMode: parsed.input.executionMode,
            createdById: parsed.actor.userId,
            links: { create: links(parsed.input) },
            attributions: {
              create: {
                employeeId: parsed.actor.userId,
                contributionContext: parsed.input.contributionContext,
                state: "acknowledged",
                proposedById: parsed.actor.userId,
                reason: "Employee-provided contribution context",
              },
            },
            verifications: {
              create: {
                outcome: "unverified",
                sourceReferences: [],
                actorId: parsed.actor.userId,
                reason: "Awaiting evidence review",
              },
            },
          },
        },
      },
      include: { revisions: true },
    });
    const revision = record.revisions[0];
    if (revision === undefined) throw invalidState();
    return serialize(record, revision);
  }

  async revise(command: unknown): Promise<EvidenceDetail> {
    const parsed = ReviseCommandSchema.parse(command);
    const at = validClock(this.clock());
    return serializable(this.client, async (transaction) => {
      await lockEvidence(transaction, parsed.evidenceId);
      const record = await loadRecord(transaction, parsed.evidenceId);
      assertOwner(record.employeeId, parsed.actor);
      if (record.state !== "draft") throw invalidState();
      if (record.currentRevision !== parsed.input.expectedRevision) throw versionConflict();
      await this.scopeReader.authorizeIn(transaction, {
        actor: parsed.actor,
        projectId: record.projectId,
        workstreamId: record.workstreamId,
        workItemId: record.workItemId,
        progressComponentId: null,
        dynamicCriterionId: null,
        at,
      });
      const latest = record.revisions.at(-1);
      if (latest === undefined) throw invalidState();
      const revision = await transaction.evidenceRevision.create({
        data: {
          evidenceId: record.id,
          revision: latest.revision + 1,
          revisionKind: "employee_edit",
          sourceKind: latest.sourceKind,
          objectKey: latest.objectKey,
          sourceText: latest.sourceText,
          sourceUrl: latest.sourceUrl,
          mediaType: latest.mediaType,
          checksumSha256: latest.checksumSha256,
          sizeBytes: latest.sizeBytes,
          supportedClaim: parsed.input.supportedClaim,
          contributionContext: parsed.input.contributionContext,
          executionMode: latest.executionMode === "manual" ? "manual" : "mixed",
          createdById: parsed.actor.userId,
          links: {
            create: latest.links.map((link) => ({
              workItemId: link.workItemId,
              progressComponentId: link.progressComponentId,
              dynamicCriterionId: link.dynamicCriterionId,
            })),
          },
          attributions: {
            create: {
              employeeId: parsed.actor.userId,
              contributionContext: parsed.input.contributionContext,
              state: "acknowledged",
              proposedById: parsed.actor.userId,
              reason: "Employee-reviewed contribution context",
            },
          },
          verifications: {
            create: {
              outcome: "unverified",
              sourceReferences: [],
              actorId: parsed.actor.userId,
              reason: "Awaiting evidence review",
            },
          },
        },
      });
      const updated = await transaction.evidenceRecord.update({
        where: { id: record.id },
        data: { currentRevision: { increment: 1 }, version: { increment: 1 } },
      });
      return serialize(updated, revision);
    });
  }

  async confirm(command: unknown): Promise<AcceptedEvidence> {
    const parsed = ConfirmCommandSchema.parse(command);
    const at = validClock(this.clock());
    return serializable(this.client, async (transaction) => {
      await lockEvidence(transaction, parsed.evidenceId);
      const record = await loadRecord(transaction, parsed.evidenceId);
      assertOwner(record.employeeId, parsed.actor);
      const existing = await transaction.acceptedEvidenceEvent.findUnique({
        where: { evidenceId: record.id },
      });
      if (existing !== null) return serializeAccepted(existing);
      if (record.state !== "draft") throw invalidState();
      if (record.currentRevision !== parsed.input.expectedRevision) throw versionConflict();
      const latest = record.revisions.at(-1);
      if (latest === undefined) throw invalidState();
      if (latest.revisionKind === "ai_draft") throw employeeEditRequired();
      await this.scopeReader.authorizeIn(transaction, {
        actor: parsed.actor,
        projectId: record.projectId,
        workstreamId: record.workstreamId,
        workItemId: record.workItemId,
        progressComponentId: null,
        dynamicCriterionId: null,
        at,
      });
      const confirmation = await transaction.evidenceConfirmation.create({
        data: {
          evidenceId: record.id,
          evidenceRevisionId: latest.id,
          employeeId: parsed.actor.userId,
          reason: parsed.input.reason,
          confirmedAt: at,
        },
      });
      const event = await transaction.acceptedEvidenceEvent.create({
        data: {
          confirmationId: confirmation.id,
          evidenceId: record.id,
          projectId: record.projectId,
          workstreamId: record.workstreamId,
          sourceReferences: [
            `evidence:${record.id}`,
            ...(record.githubSourceEventId === null
              ? []
              : [`github-source-event:${record.githubSourceEventId}`]),
          ],
          occurredAt: at,
        },
      });
      await transaction.evidenceRecord.update({
        where: { id: record.id },
        data: { state: "confirmed", version: { increment: 1 } },
      });
      await this.auditWriter.append(transaction, {
        eventType: "evidence.confirmed",
        actor: { kind: "human", id: parsed.actor.userId },
        effectiveSubjectId: parsed.actor.userId,
        scopeType: "project",
        scopeId: record.projectId,
        targetType: "accepted_evidence_event",
        targetId: event.id,
        reason: parsed.input.reason,
        safeDiff: { evidenceId: record.id, revision: latest.revision },
        correlationId: parsed.correlationId,
        source: "api",
      });
      return serializeAccepted(event);
    });
  }

  async reject(command: unknown): Promise<EvidenceDetail> {
    const parsed = RejectCommandSchema.parse(command);
    const at = validClock(this.clock());
    return serializable(this.client, async (transaction) => {
      await lockEvidence(transaction, parsed.evidenceId);
      const record = await loadRecord(transaction, parsed.evidenceId);
      assertOwner(record.employeeId, parsed.actor);
      if (record.state !== "draft") throw invalidState();
      if (record.currentRevision !== parsed.input.expectedRevision) throw versionConflict();
      await this.scopeReader.authorizeIn(transaction, {
        actor: parsed.actor,
        projectId: record.projectId,
        workstreamId: record.workstreamId,
        workItemId: record.workItemId,
        progressComponentId: null,
        dynamicCriterionId: null,
        at,
      });
      const latest = record.revisions.at(-1);
      if (latest === undefined) throw invalidState();
      const rejected = await transaction.evidenceRecord.update({
        where: { id: record.id },
        data: { state: "rejected", version: { increment: 1 } },
      });
      await this.auditWriter.append(transaction, {
        eventType: "evidence.rejected",
        actor: { kind: "human", id: parsed.actor.userId },
        effectiveSubjectId: parsed.actor.userId,
        scopeType: "project",
        scopeId: record.projectId,
        targetType: "evidence_record",
        targetId: record.id,
        reason: parsed.input.reason,
        safeDiff: { revision: latest.revision, nextState: "rejected" },
        correlationId: parsed.correlationId,
        source: "api",
      });
      return serialize(rejected, latest);
    });
  }
}

type EvidenceDetail = Readonly<{
  id: string;
  revisionId: string;
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
  githubSourceEventId: string | null;
  state: "draft" | "confirmed" | "rejected";
  revision: number;
  revisionKind: "ai_draft" | "employee_edit" | "manual_draft";
  sourceKind: string;
  supportedClaim: string;
  contributionContext: string;
  executionMode: string;
}>;

type AcceptedEvidence = Readonly<{
  id: string;
  evidenceId: string;
  projectId: string;
  workstreamId: string | null;
  sourceReferences: string[];
  confirmedAt: string;
}>;

async function resolveSource(
  transaction: Transaction,
  reader: SafeEvidenceUploadReader,
  command: z.infer<typeof CreateCommandSchema>,
) {
  const source = command.input.source;
  if ("uploadedSourceId" in source) {
    const approved = await reader.getApprovedUploadIn(transaction, {
      actor: command.actor,
      uploadedSourceId: source.uploadedSourceId,
      projectId: command.input.projectId,
      workstreamId: command.input.workstreamId,
    });
    return {
      objectKey: approved.objectKey,
      mediaType: approved.mediaType,
      checksumSha256: approved.checksumSha256,
      sizeBytes: approved.sizeBytes,
    };
  }
  if ("text" in source) return { sourceText: source.text };
  return { sourceUrl: source.url };
}

function links(input: z.infer<typeof CreateManualEvidenceInputSchema>) {
  return [
    ...(input.workItemId === null ? [] : [{ workItemId: input.workItemId }]),
    ...(input.relatedKpiComponentId === null
      ? []
      : [{ progressComponentId: input.relatedKpiComponentId }]),
    ...(input.relatedCriterionId === null
      ? []
      : [{ dynamicCriterionId: input.relatedCriterionId }]),
  ];
}

async function loadRecord(transaction: Transaction, id: string) {
  const record = await transaction.evidenceRecord.findUnique({
    where: { id },
    include: {
      revisions: { orderBy: { revision: "asc" }, include: { links: true } },
    },
  });
  if (record === null) throw invalidState();
  return record;
}

function serialize(
  record: {
    id: string;
    projectId: string;
    workstreamId: string | null;
    workItemId: string | null;
    githubSourceEventId?: string | null;
    state: "draft" | "confirmed" | "rejected";
  },
  revision: {
    id: string;
    revision: number;
    revisionKind: "ai_draft" | "employee_edit" | "manual_draft";
    sourceKind: string;
    supportedClaim: string;
    contributionContext: string;
    executionMode: string;
  },
): EvidenceDetail {
  return {
    id: record.id,
    revisionId: revision.id,
    projectId: record.projectId,
    workstreamId: record.workstreamId,
    workItemId: record.workItemId,
    githubSourceEventId: record.githubSourceEventId ?? null,
    state: record.state,
    revision: revision.revision,
    revisionKind: revision.revisionKind,
    sourceKind: revision.sourceKind,
    supportedClaim: revision.supportedClaim,
    contributionContext: revision.contributionContext,
    executionMode: revision.executionMode,
  };
}

function serializeAccepted(row: {
  id: string;
  evidenceId: string;
  projectId: string;
  workstreamId: string | null;
  sourceReferences: unknown;
  occurredAt: Date;
}): AcceptedEvidence {
  return {
    id: row.id,
    evidenceId: row.evidenceId,
    projectId: row.projectId,
    workstreamId: row.workstreamId,
    sourceReferences: Array.isArray(row.sourceReferences)
      ? row.sourceReferences.filter((item): item is string => typeof item === "string")
      : [],
    confirmedAt: row.occurredAt.toISOString(),
  };
}

async function lockEvidence(transaction: Transaction, id: string): Promise<void> {
  await transaction.$queryRaw`SELECT id FROM "EvidenceRecord" WHERE id = ${id}::uuid FOR UPDATE`;
}

function assertOwner(employeeId: string, actor: { userId: string; active: boolean }): void {
  if (!actor.active || employeeId !== actor.userId) {
    throw new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
  }
}

function serializable<T>(
  client: DatabaseClient,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  return client.$transaction(operation, { isolationLevel: "Serializable" });
}

function validClock(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw new Error("Clock returned an invalid date");
  return value;
}

function invalidState(): AppError {
  return new AppError("EVIDENCE_STATE_INVALID", "errors.evidence.stateInvalid", 409);
}

function versionConflict(): AppError {
  return new AppError("VERSION_CONFLICT", "errors.versionConflict", 409);
}

function employeeEditRequired(): AppError {
  return new AppError(
    "EVIDENCE_EMPLOYEE_EDIT_REQUIRED",
    "errors.evidence.employeeEditRequired",
    409,
  );
}
