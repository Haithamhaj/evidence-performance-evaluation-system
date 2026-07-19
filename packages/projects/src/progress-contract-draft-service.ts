import { createHash, randomUUID } from "node:crypto";

import { databaseAuditWriter } from "@evaluation/audit";
import {
  AppError,
  ProgressContractAiDraftOutputSchema,
  type AuditWriter,
  type ProgressContractAiDraftOutput,
} from "@evaluation/contracts";
import { z } from "zod";

import {
  PROJECT_PROGRESS_CONTRACT_OUTPUT_SCHEMA_V1,
  PROJECT_PROGRESS_CONTRACT_OUTPUT_SCHEMA_VERSION,
  PROJECT_PROGRESS_CONTRACT_PROMPT_V1,
  PROJECT_PROGRESS_CONTRACT_PROMPT_VERSION,
  PROJECT_PROGRESS_CONTRACT_ROUTE_KEY,
} from "./progress-contract-draft-artifacts.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type Actor = Readonly<{ userId: string; active: true }>;

const RequestDraftSchema = z
  .object({
    actor: z.object({ userId: z.string().uuid(), active: z.literal(true) }).strict(),
    correlationId: z.string().uuid(),
    idempotencyKey: z.string().trim().min(1).max(200),
    projectId: z.string().uuid(),
    documentVersionId: z.string().uuid(),
    sourceChecksum: z.string().regex(/^[a-f0-9]{64}$/u),
    locale: z.string().trim().min(2).max(20),
    timezone: z.string().trim().min(1).max(100),
    effectiveAt: z.iso.datetime({ offset: true }),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();
const ReviseDraftSchema = z
  .object({
    actor: z.object({ userId: z.string().uuid(), active: z.literal(true) }).strict(),
    correlationId: z.string().uuid(),
    requestId: z.string().uuid(),
    expectedRevision: z.number().int().nonnegative(),
    content: z.unknown(),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();
const RejectDraftSchema = ReviseDraftSchema.omit({ content: true });
const ApplyRevisionSchema = RejectDraftSchema.extend({
  selectedRevision: z.number().int().positive(),
  calculationKind: z.enum(["weighted", "stage_gate"]),
}).strict();

export type ProgressContractDraftReceipt = Readonly<{
  requestId: string;
  state: "pending" | "ready" | "failed" | "applied" | "rejected";
  revision: number | null;
  origin: "ai" | "human" | null;
  content: ProgressContractAiDraftOutput | null;
  failureCode: string | null;
  aiRunTraceId: string | null;
  appliedContractId: string | null;
}>;

export type ProgressContractDraftAiRouter = Pick<
  import("@evaluation/ai-routing").AiRouter<Transaction>,
  "run"
>;

type DraftSource = Readonly<{
  projectId: string;
  departmentId: string;
  documentId: string;
  documentVersionId: string;
  documentVersion: number;
  sourceChecksum: string;
  sourceReferences: readonly string[];
  quotedSections: readonly Readonly<{
    reference: string;
    mediaType: string;
    text: string;
    trust: "untrusted";
  }>[];
}>;
type DraftSourceReader = Readonly<{
  loadApprovedVersion(input: Readonly<{
    actor: Readonly<{ userId: string; active: boolean }>;
    projectId: string;
    documentVersionId: string;
    sourceChecksum: string;
  }>): Promise<DraftSource>;
}>;
type IdentityReader = Pick<
  import("./criteria-review-reader.js").CriteriaReviewReader,
  "snapshotIn"
>;
type ContractProposer = Pick<import("./progress-contract-service.js").ProgressContractService, "propose">;

export class ProgressContractDraftService {
  private readonly client: DatabaseClient;
  private readonly audit: AuditWriter<Transaction>;
  private readonly sourceReader: DraftSourceReader;
  private readonly identityReader: IdentityReader;
  private readonly aiRouter: ProgressContractDraftAiRouter;
  private readonly progressContracts: ContractProposer;
  private readonly options: Readonly<{
    systemId: string;
    timeoutMs: number;
    now?: () => Date;
  }>;

  constructor(
    client: DatabaseClient,
    audit: AuditWriter<Transaction>,
    sourceReader: DraftSourceReader,
    identityReader: IdentityReader,
    aiRouter: ProgressContractDraftAiRouter,
    progressContracts: ContractProposer,
    options: Readonly<{ systemId: string; timeoutMs: number; now?: () => Date }>,
  ) {
    this.client = client;
    this.audit = audit;
    this.sourceReader = sourceReader;
    this.identityReader = identityReader;
    this.aiRouter = aiRouter;
    this.progressContracts = progressContracts;
    this.options = options;
  }

  async requestDraft(command: unknown): Promise<ProgressContractDraftReceipt> {
    const parsed = RequestDraftSchema.parse(command);
    const payloadHash = hashPayload(parsed);
    const duplicate = await this.findIdempotent(parsed.actor.userId, parsed.idempotencyKey);
    if (duplicate !== null && duplicate.payloadHash !== payloadHash) throw idempotencyConflict();
    if (duplicate !== null && duplicate.state !== "failed") return this.receipt(duplicate);

    const source = await this.sourceReader.loadApprovedVersion({
      actor: parsed.actor,
      projectId: parsed.projectId,
      documentVersionId: parsed.documentVersionId,
      sourceChecksum: parsed.sourceChecksum,
    });
    const prepared = await this.prepareRequest(parsed, source, payloadHash);
    if (!prepared.invoke) return this.receipt(prepared.request);

    const previousContract = await this.client.progressContract.findFirst({
      where: { projectId: parsed.projectId, workstreamId: null, state: "active" },
      orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
      include: { components: { orderBy: { position: "asc" } } },
    });
    let createdRevision:
      | Readonly<{
          revision: number;
          origin: "ai";
          content: ProgressContractAiDraftOutput;
        }>
      | undefined;
    let route: Awaited<ReturnType<ProgressContractDraftAiRouter["run"]>>;
    try {
      route = await this.aiRouter.run(
        {
          routeKey: PROJECT_PROGRESS_CONTRACT_ROUTE_KEY,
          projectId: parsed.projectId,
          departmentId: source.departmentId,
          systemId: this.options.systemId,
          input: buildBoundedDraftInput(source, previousContract, {
            locale: parsed.locale,
            timezone: parsed.timezone,
            effectiveAt: parsed.effectiveAt,
          }),
          inputReference: `progress-contract-draft:${prepared.request.id}`,
          inputSchemaVersion: "project-progress-contract-draft-input.v1",
          outputSchemaVersion: PROJECT_PROGRESS_CONTRACT_OUTPUT_SCHEMA_VERSION,
          promptTemplateVersion: PROJECT_PROGRESS_CONTRACT_PROMPT_VERSION,
          outputSchema: PROJECT_PROGRESS_CONTRACT_OUTPUT_SCHEMA_V1,
          sourceReferences: source.sourceReferences,
          classification: "confidential",
          timeoutMs: this.options.timeoutMs,
          requiresHumanApproval: true,
          correlationId: parsed.correlationId,
        },
        async (transaction, rawOutput) => {
          const output = ProgressContractAiDraftOutputSchema.parse(rawOutput);
          assertSourceReferences(output, source.sourceReferences);
          await lockRequest(transaction, prepared.request.id);
          const current = await transaction.progressContractAiDraftRequest.findUnique({
            where: { id: prepared.request.id },
          });
          if (current?.state !== "pending" || current.payloadHash !== payloadHash) {
            throw invalidState();
          }
          const latest = await transaction.progressContractAiDraftRevision.findFirst({
            where: { requestId: current.id },
            orderBy: { revision: "desc" },
            select: { revision: true },
          });
          const revision = (latest?.revision ?? 0) + 1;
          const id = randomUUID();
          await transaction.progressContractAiDraftRevision.create({
            data: {
              id,
              requestId: current.id,
              revision,
              content: output,
              origin: "ai",
              editorId: parsed.actor.userId,
              reason: "Validated AI proposal from the exact approved document version",
              sourceReferences: collectSourceReferences(output),
            },
          });
          await transaction.progressContractAiDraftRequest.update({
            where: { id: current.id },
            data: { state: "ready", failureCode: null },
          });
          await this.audit.append(transaction, {
            eventType: "progress_contract_ai_draft.ready",
            actor: { kind: "human", id: parsed.actor.userId },
            effectiveSubjectId: parsed.actor.userId,
            scopeType: "project",
            scopeId: parsed.projectId,
            targetType: "progress_contract_ai_draft_request",
            targetId: current.id,
            reason: parsed.reason,
            safeDiff: {
              state: "ready",
              revision,
              origin: "ai",
              documentVersionId: source.documentVersionId,
            },
            correlationId: parsed.correlationId,
            source: "api",
          });
          createdRevision = { revision, origin: "ai", content: output };
          return { outputReference: `progress-contract-draft-revision:${id}` };
        },
      );
    } catch (error) {
      const failureCode = safeFailureCode(error);
      await this.markFailed(prepared.request.id, parsed, failureCode);
      throw new AppError(
        "PROGRESS_CONTRACT_AI_DRAFT_FAILED",
        "errors.progressContractDraft.failed",
        502,
      );
    }

    const output = ProgressContractAiDraftOutputSchema.parse(route.output);
    if (createdRevision === undefined) throw invalidState();
    const ready = await this.client.progressContractAiDraftRequest.update({
      where: { id: prepared.request.id },
      data: { aiRunTraceId: route.runId },
    });
    return {
      requestId: ready.id,
      state: "ready",
      revision: createdRevision.revision,
      origin: createdRevision.origin,
      content: output,
      failureCode: null,
      aiRunTraceId: route.runId,
      appliedContractId: null,
    };
  }

  async reviseDraft(command: unknown): Promise<ProgressContractDraftReceipt> {
    const parsed = ReviseDraftSchema.parse(command);
    const content = ProgressContractAiDraftOutputSchema.parse(parsed.content);
    return this.client.$transaction(
      async (transaction) => {
        const context = await this.lockAuthorizedReady(
          transaction,
          parsed.actor,
          parsed.requestId,
          parsed.expectedRevision,
        );
        const original = await transaction.progressContractAiDraftRevision.findUnique({
          where: { requestId_revision: { requestId: context.request.id, revision: 1 } },
          select: { sourceReferences: true },
        });
        if (original === null) throw invalidState();
        assertSourceReferences(content, jsonStrings(original.sourceReferences));
        const revision = context.latest.revision + 1;
        const row = await transaction.progressContractAiDraftRevision.create({
          data: {
            id: randomUUID(),
            requestId: context.request.id,
            revision,
            content,
            origin: "human",
            editorId: parsed.actor.userId,
            reason: parsed.reason,
            sourceReferences: collectSourceReferences(content),
          },
        });
        await this.audit.append(transaction, {
          eventType: "progress_contract_ai_draft.revised",
          actor: { kind: "human", id: parsed.actor.userId },
          effectiveSubjectId: parsed.actor.userId,
          scopeType: "project",
          scopeId: context.request.projectId,
          targetType: "progress_contract_ai_draft_revision",
          targetId: row.id,
          reason: parsed.reason,
          safeDiff: { requestId: context.request.id, revision, origin: "human" },
          correlationId: parsed.correlationId,
          source: "api",
        });
        return receiptFrom(context.request, row, content);
      },
      { isolationLevel: "Serializable" },
    );
  }

  async rejectDraft(command: unknown): Promise<ProgressContractDraftReceipt> {
    const parsed = RejectDraftSchema.parse(command);
    return this.client.$transaction(
      async (transaction) => {
        const context = await this.lockAuthorizedReady(
          transaction,
          parsed.actor,
          parsed.requestId,
          parsed.expectedRevision,
        );
        const rejected = await transaction.progressContractAiDraftRequest.update({
          where: { id: context.request.id },
          data: { state: "rejected" },
        });
        await this.audit.append(transaction, {
          eventType: "progress_contract_ai_draft.rejected",
          actor: { kind: "human", id: parsed.actor.userId },
          effectiveSubjectId: parsed.actor.userId,
          scopeType: "project",
          scopeId: context.request.projectId,
          targetType: "progress_contract_ai_draft_request",
          targetId: context.request.id,
          reason: parsed.reason,
          safeDiff: { state: "rejected", revision: context.latest.revision },
          correlationId: parsed.correlationId,
          source: "api",
        });
        return receiptFrom(
          rejected,
          context.latest,
          ProgressContractAiDraftOutputSchema.parse(context.latest.content),
        );
      },
      { isolationLevel: "Serializable" },
    );
  }

  async applyRevision(command: unknown): Promise<
    Readonly<{
      requestId: string;
      selectedRevision: number;
      contractId: string;
      contractState: "draft";
    }>
  > {
    const parsed = ApplyRevisionSchema.parse(command);
    return this.client.$transaction(
      async (transaction) => {
        const context = await this.lockAuthorizedReady(
          transaction,
          parsed.actor,
          parsed.requestId,
          parsed.expectedRevision,
        );
        const selected = await transaction.progressContractAiDraftRevision.findUnique({
          where: {
            requestId_revision: {
              requestId: context.request.id,
              revision: parsed.selectedRevision,
            },
          },
        });
        if (selected === null) {
          throw new AppError(
            "PROGRESS_CONTRACT_AI_DRAFT_REVISION_NOT_FOUND",
            "errors.progressContractDraft.revisionNotFound",
            404,
          );
        }
        const content = ProgressContractAiDraftOutputSchema.parse(selected.content);
        const contract = await this.progressContracts.propose(
          {
            actor: parsed.actor,
            correlationId: parsed.correlationId,
            reason: parsed.reason,
            draft: {
              scopeKind: "project",
              projectId: context.request.projectId,
              workstreamId: null,
              sourceDocumentId: context.request.documentId,
              sourceDocumentVersionId: context.request.documentVersionId,
              sourceDocumentVersion: context.request.documentVersion.version,
              calculationKind: parsed.calculationKind,
              calculationSchemaVersion: "1.0.0",
              effectiveAt: context.request.effectiveAt.toISOString(),
              components: content.components.map((component) => ({
                id: randomUUID(),
                kind: component.kind === "operational_kpi" ? "kpi" : component.kind,
                name: component.name,
                description: component.description,
                weight: component.weight,
                baseline: component.baseline,
                target: component.target,
                unit: component.unit,
                direction: component.direction,
                acceptanceConditions: component.acceptanceConditions,
                requiredEvidence: component.requiredEvidence,
                confirmationMode: component.confirmationMode,
              })),
            },
          },
          transaction,
        );
        if (contract.state !== "draft") {
          throw new AppError(
            "PROGRESS_CONTRACT_AI_DRAFT_APPLY_UNSAFE",
            "errors.progressContractDraft.applyUnsafe",
            500,
          );
        }
        await transaction.progressContractAiDraftRequest.update({
          where: { id: context.request.id },
          data: { state: "applied", appliedContractId: contract.id },
        });
        await this.audit.append(transaction, {
          eventType: "progress_contract_ai_draft.applied",
          actor: { kind: "human", id: parsed.actor.userId },
          effectiveSubjectId: parsed.actor.userId,
          scopeType: "project",
          scopeId: context.request.projectId,
          targetType: "progress_contract",
          targetId: contract.id,
          reason: parsed.reason,
          safeDiff: {
            requestId: context.request.id,
            selectedRevision: parsed.selectedRevision,
            contractState: "draft",
          },
          correlationId: parsed.correlationId,
          source: "api",
        });
        return {
          requestId: context.request.id,
          selectedRevision: parsed.selectedRevision,
          contractId: contract.id,
          contractState: "draft",
        };
      },
      { isolationLevel: "Serializable" },
    );
  }

  private async prepareRequest(
    parsed: z.infer<typeof RequestDraftSchema>,
    source: DraftSource,
    payloadHash: string,
  ): Promise<Readonly<{ request: any; invoke: boolean }>> {
    try {
      return await this.client.$transaction(
        async (transaction) => {
          const existing = await transaction.progressContractAiDraftRequest.findUnique({
            where: {
              requestedById_idempotencyKey: {
                requestedById: parsed.actor.userId,
                idempotencyKey: parsed.idempotencyKey,
              },
            },
          });
          if (existing !== null) {
            if (existing.payloadHash !== payloadHash) throw idempotencyConflict();
            if (existing.state !== "failed") return { request: existing, invoke: false };
            await this.assertOwner(transaction, parsed.actor, parsed.projectId);
            const retried = await transaction.progressContractAiDraftRequest.update({
              where: { id: existing.id },
              data: { state: "pending", failureCode: null, aiRunTraceId: null },
            });
            return { request: retried, invoke: true };
          }
          await this.assertOwner(transaction, parsed.actor, parsed.projectId);
          const request = await transaction.progressContractAiDraftRequest.create({
            data: {
              id: randomUUID(),
              projectId: parsed.projectId,
              documentId: source.documentId,
              documentVersionId: source.documentVersionId,
              requestedById: parsed.actor.userId,
              idempotencyKey: parsed.idempotencyKey,
              payloadHash,
              state: "pending",
              sourceChecksum: source.sourceChecksum,
              routeKey: PROJECT_PROGRESS_CONTRACT_ROUTE_KEY,
              promptVersion: PROJECT_PROGRESS_CONTRACT_PROMPT_VERSION,
              outputSchemaVersion: PROJECT_PROGRESS_CONTRACT_OUTPUT_SCHEMA_VERSION,
              locale: parsed.locale,
              timezone: parsed.timezone,
              effectiveAt: new Date(parsed.effectiveAt),
            },
          });
          await this.audit.append(transaction, {
            eventType: "progress_contract_ai_draft.requested",
            actor: { kind: "human", id: parsed.actor.userId },
            effectiveSubjectId: parsed.actor.userId,
            scopeType: "project",
            scopeId: parsed.projectId,
            targetType: "progress_contract_ai_draft_request",
            targetId: request.id,
            reason: parsed.reason,
            safeDiff: {
              state: "pending",
              documentVersionId: source.documentVersionId,
              promptVersion: PROJECT_PROGRESS_CONTRACT_PROMPT_VERSION,
              outputSchemaVersion: PROJECT_PROGRESS_CONTRACT_OUTPUT_SCHEMA_VERSION,
            },
            correlationId: parsed.correlationId,
            source: "api",
          });
          return { request, invoke: true };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const existing = await this.findIdempotent(parsed.actor.userId, parsed.idempotencyKey);
      if (existing === null) throw error;
      if (existing.payloadHash !== payloadHash) throw idempotencyConflict();
      return { request: existing, invoke: false };
    }
  }

  private async lockAuthorizedReady(
    transaction: Transaction,
    actor: Actor,
    requestId: string,
    expectedRevision: number,
  ) {
    await lockRequest(transaction, requestId);
    const request = await transaction.progressContractAiDraftRequest.findUnique({
      where: { id: requestId },
      include: { documentVersion: { select: { version: true } } },
    });
    if (request === null) {
      throw new AppError(
        "PROGRESS_CONTRACT_AI_DRAFT_NOT_FOUND",
        "errors.progressContractDraft.notFound",
        404,
      );
    }
    await this.assertOwner(transaction, actor, request.projectId);
    if (request.state !== "ready") throw invalidState();
    const latest = await transaction.progressContractAiDraftRevision.findFirst({
      where: { requestId },
      orderBy: { revision: "desc" },
    });
    if (latest === null) throw invalidState();
    if (latest.revision !== expectedRevision) {
      throw new AppError(
        "PROGRESS_CONTRACT_AI_DRAFT_REVISION_CONFLICT",
        "errors.progressContractDraft.revisionConflict",
        409,
      );
    }
    return { request, latest };
  }

  private async assertOwner(transaction: Transaction, actor: Actor, projectId: string) {
    const identity = await this.identityReader.snapshotIn(transaction, {
      kind: "project",
      resourceId: projectId,
      at: this.options.now?.() ?? new Date(),
    });
    if (identity === null || identity.projectId !== projectId || identity.primaryOwnerId !== actor.userId) {
      throw new AppError(
        "PROGRESS_CONTRACT_AI_DRAFT_FORBIDDEN",
        "errors.progressContractDraft.forbidden",
        403,
      );
    }
  }

  private findIdempotent(requestedById: string, idempotencyKey: string) {
    return this.client.progressContractAiDraftRequest.findUnique({
      where: { requestedById_idempotencyKey: { requestedById, idempotencyKey } },
    });
  }

  private async receipt(request: any): Promise<ProgressContractDraftReceipt> {
    const latest = await this.client.progressContractAiDraftRevision.findFirst({
      where: { requestId: request.id },
      orderBy: { revision: "desc" },
    });
    return receiptFrom(
      request,
      latest,
      latest === null ? null : ProgressContractAiDraftOutputSchema.parse(latest.content),
    );
  }

  private async markFailed(
    requestId: string,
    parsed: z.infer<typeof RequestDraftSchema>,
    failureCode: string,
  ) {
    await this.client.$transaction(async (transaction) => {
      await lockRequest(transaction, requestId);
      const request = await transaction.progressContractAiDraftRequest.findUnique({
        where: { id: requestId },
      });
      if (request?.state !== "pending") return;
      await transaction.progressContractAiDraftRequest.update({
        where: { id: requestId },
        data: { state: "failed", failureCode },
      });
      await this.audit.append(transaction, {
        eventType: "progress_contract_ai_draft.failed",
        actor: { kind: "human", id: parsed.actor.userId },
        effectiveSubjectId: parsed.actor.userId,
        scopeType: "project",
        scopeId: parsed.projectId,
        targetType: "progress_contract_ai_draft_request",
        targetId: requestId,
        reason: parsed.reason,
        safeDiff: { state: "failed", failureCode },
        correlationId: parsed.correlationId,
        source: "api",
      });
    });
  }
}

export function createProgressContractDraftService(
  client: DatabaseClient,
  sourceReader: DraftSourceReader,
  identityReader: IdentityReader,
  aiRouter: ProgressContractDraftAiRouter,
  progressContracts: ContractProposer,
  options: Readonly<{ systemId: string; timeoutMs: number; now?: () => Date }>,
  audit: AuditWriter<Transaction> = databaseAuditWriter as AuditWriter<Transaction>,
) {
  return new ProgressContractDraftService(
    client,
    audit,
    sourceReader,
    identityReader,
    aiRouter,
    progressContracts,
    options,
  );
}

function buildBoundedDraftInput(
  source: DraftSource,
  previousContract: any,
  context: Readonly<{ locale: string; timezone: string; effectiveAt: string }>,
) {
  const previousSummary =
    previousContract === null
      ? null
      : {
          id: previousContract.id,
          contractVersion: previousContract.contractVersion,
          calculationKind: previousContract.calculationKind,
          components: previousContract.components.map((component: any) => ({
            kind: component.kind,
            name: component.name,
            description: component.description,
            weight: component.weight === null ? null : Number(component.weight),
            baseline: component.baseline === null ? null : Number(component.baseline),
            target: component.target === null ? null : Number(component.target),
            unit: component.unit,
            direction: component.direction,
            acceptanceConditions: component.acceptanceConditions,
            requiredEvidence: component.requiredEvidence,
            confirmationMode: component.confirmationMode,
          })),
        };
  const boundedPreviousSummary =
    previousSummary === null || JSON.stringify(previousSummary).length <= 20_000
      ? previousSummary
      : {
          id: previousSummary.id,
          contractVersion: previousSummary.contractVersion,
          calculationKind: previousSummary.calculationKind,
          components: [],
          boundedOmission: "Previous component detail exceeded the governed input bound",
        };
  return {
    trustedInstruction: PROJECT_PROGRESS_CONTRACT_PROMPT_V1,
    untrustedContent: JSON.stringify({
      requestedContext: context,
      exactDocumentVersion: {
        documentId: source.documentId,
        documentVersionId: source.documentVersionId,
        documentVersion: source.documentVersion,
        sourceChecksum: source.sourceChecksum,
      },
      quotedSections: source.quotedSections,
      previousActiveContract: boundedPreviousSummary,
    }),
  };
}

function hashPayload(parsed: z.infer<typeof RequestDraftSchema>): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        projectId: parsed.projectId,
        documentVersionId: parsed.documentVersionId,
        sourceChecksum: parsed.sourceChecksum,
        locale: parsed.locale,
        timezone: parsed.timezone,
        effectiveAt: parsed.effectiveAt,
        reason: parsed.reason,
      }),
    )
    .digest("hex");
}

function assertSourceReferences(
  output: ProgressContractAiDraftOutput,
  allowed: readonly string[],
) {
  const allowedSet = new Set(allowed);
  if (collectSourceReferences(output).some((reference) => !allowedSet.has(reference))) {
    throw new AppError(
      "AI_SOURCE_REFERENCE_INVALID",
      "errors.ai.sourceReferenceInvalid",
      502,
    );
  }
}

function collectSourceReferences(output: ProgressContractAiDraftOutput): string[] {
  return [
    ...new Set(output.components.flatMap((component) => component.sourceReferences)),
  ].sort();
}

function jsonStrings(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

async function lockRequest(transaction: Transaction, requestId: string) {
  await transaction.$queryRaw`
    SELECT id
    FROM "ProgressContractAiDraftRequest"
    WHERE id = ${requestId}::uuid
    FOR UPDATE
  `;
}

function receiptFrom(
  request: any,
  revision: any,
  content: ProgressContractAiDraftOutput | null,
): ProgressContractDraftReceipt {
  return {
    requestId: request.id,
    state: request.state,
    revision: revision?.revision ?? null,
    origin: revision?.origin ?? null,
    content,
    failureCode: request.failureCode ?? null,
    aiRunTraceId: request.aiRunTraceId ?? null,
    appliedContractId: request.appliedContractId ?? null,
  };
}

function safeFailureCode(error: unknown): string {
  if (error instanceof z.ZodError) return "invalid_output";
  if (error instanceof AppError) {
    if (/OUTPUT|SCHEMA|SOURCE_REFERENCE/iu.test(error.code)) return "invalid_output";
    if (/TIMEOUT/iu.test(error.code)) return "timeout";
    if (/PROVIDER|ROUTE/iu.test(error.code)) return "provider_failure";
    if (/PERSISTENCE/iu.test(error.code)) return "persistence_failure";
  }
  return "internal_failure";
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function idempotencyConflict() {
  return new AppError("IDEMPOTENCY_CONFLICT", "errors.idempotencyConflict", 409);
}

function invalidState() {
  return new AppError(
    "PROGRESS_CONTRACT_AI_DRAFT_STATE_INVALID",
    "errors.progressContractDraft.stateInvalid",
    409,
  );
}
