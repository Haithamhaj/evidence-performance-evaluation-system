import { JobEnvelopeSchema } from "@evaluation/contracts";
import { z } from "zod";

import { NonRetryableJobError } from "../queue/job-errors.js";

const ProcessPayloadSchema = z
  .object({
    requestId: z.string().uuid(),
    payloadHash: z.string().regex(/^[a-f0-9]{64}$/u),
    domainIdempotencyKey: z.string().trim().min(1).max(256),
  })
  .strict();

type Database = import("@evaluation/database").DatabaseClient;

type PhaseHandler = Readonly<{
  process(requestId: string, actorId: string, correlationId: string): Promise<string>;
}>;

type PhaseHandlers = Readonly<{
  readiness: PhaseHandler;
  comparison: PhaseHandler;
  criteria: PhaseHandler;
}>;

export class AnalysisCriteriaProcessor {
  private readonly database: Database;
  private readonly handlers: PhaseHandlers;

  constructor(database: Database, handlers: PhaseHandlers) {
    this.database = database;
    this.handlers = handlers;
  }

  async process(rawEnvelope: unknown): Promise<string> {
    const envelope = parseEnvelope(rawEnvelope);
    const payload = parsePayload(envelope.payload);
    if (envelope.jobType !== "analysis-criteria.process" || envelope.jobVersion !== 1) {
      throw conflict();
    }
    const validated = await this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT request.id
        FROM "DocumentAnalysisRequest" request
        INNER JOIN "Operation" operation ON operation.id = request."operationId"
        WHERE request.id = ${payload.requestId}::uuid
        FOR UPDATE OF request, operation
      `;
      const request = await transaction.documentAnalysisRequest.findUnique({
        where: { id: payload.requestId },
        include: { operation: true },
      });
      if (request === null || !matchesEnvelope(request, envelope, payload)) throw conflict();
      const audit = await transaction.auditEvent.findFirst({
        where: {
          targetType: "document_analysis_request",
          targetId: request.id,
          correlationId: envelope.correlationId,
          eventType: {
            in: auditEventTypes(request.kind),
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { actorKind: true, actorId: true, correlationId: true },
      });
      if (
        audit === null ||
        audit.actorKind !== "human" ||
        !z.string().uuid().safeParse(audit.actorId).success ||
        audit.correlationId !== envelope.correlationId
      ) {
        throw new NonRetryableJobError("ANALYSIS_JOB_ACTOR_INVALID");
      }
      const requestTerminal =
        ["succeeded", "superseded"].includes(request.state) &&
        request.resultReference !== null;
      const operationSucceeded =
        request.operation.status === "succeeded" &&
        request.operation.resultReference !== null;
      if (requestTerminal) {
        const requestReference = request.resultReference;
        const operationReference = request.operation.resultReference;
        if (
          operationSucceeded &&
          requestReference !== null &&
          operationReference !== null &&
          requestReference === operationReference
        ) {
          return { kind: "replay" as const, resultReference: requestReference };
        }
        if (request.operation.status === "running" && operationReference === null) {
          return dispatchOf(request, audit.actorId, envelope.correlationId);
        }
        throw new NonRetryableJobError("ANALYSIS_JOB_STATE_INCONSISTENT");
      }
      if (request.state === "superseded") {
        const effect = await terminalEffectReference(transaction, request);
        if (effect === null)
          throw new NonRetryableJobError("ANALYSIS_JOB_STATE_INCONSISTENT");
        if (
          operationSucceeded &&
          request.operation.resultReference === effect.receiptReference
        ) {
          return { kind: "replay" as const, resultReference: effect.receiptReference };
        }
        if (
          request.operation.status === "running" &&
          request.operation.resultReference === null
        ) {
          return dispatchOf(request, audit.actorId, envelope.correlationId);
        }
        throw new NonRetryableJobError("ANALYSIS_JOB_STATE_INCONSISTENT");
      }
      if (operationSucceeded) {
        throw new NonRetryableJobError("ANALYSIS_JOB_STATE_INCONSISTENT");
      }
      return dispatchOf(request, audit.actorId, envelope.correlationId);
    });
    if (validated.kind === "replay") return validated.resultReference;
    const handler =
      validated.requestKind === "readiness"
        ? this.handlers.readiness
        : validated.requestKind === "comparison"
          ? this.handlers.comparison
          : this.handlers.criteria;
    return handler.process(
      validated.requestId,
      validated.actorId,
      validated.correlationId,
    );
  }
}

function auditEventTypes(
  kind: "readiness" | "comparison" | "criteria_project" | "criteria_workstream",
): string[] {
  if (kind === "readiness") return ["document.readiness_requested"];
  if (kind === "comparison") return ["document.comparison_requested"];
  return [
    "dynamic_criteria.generation_requested",
    "dynamic_criteria.revision_requested",
  ];
}

async function terminalEffectReference(
  transaction: import("@evaluation/database").DatabaseTransaction,
  request: Readonly<{
    id: string;
    kind: "readiness" | "comparison" | "criteria_project" | "criteria_workstream";
  }>,
): Promise<Readonly<{ receiptReference: string }> | null> {
  if (request.kind === "criteria_project" || request.kind === "criteria_workstream") {
    return transaction.operationEffectReceipt.findUnique({
      where: { idempotencyKey: `analysis:${request.id}:validated-result` },
      select: { receiptReference: true },
    });
  }
  if (request.kind === "readiness") {
    const result = await transaction.documentReadinessCheck.findUnique({
      where: { requestId: request.id },
      select: { outputReference: true },
    });
    return result === null ? null : { receiptReference: result.outputReference };
  }
  const result = await transaction.documentComparison.findUnique({
    where: { requestId: request.id },
    select: { outputReference: true },
  });
  return result === null ? null : { receiptReference: result.outputReference };
}

function dispatchOf(
  request: Readonly<{
    id: string;
    kind: "readiness" | "comparison" | "criteria_project" | "criteria_workstream";
  }>,
  actorId: string,
  correlationId: string,
) {
  return {
    kind: "dispatch" as const,
    requestKind: request.kind,
    requestId: request.id,
    actorId,
    correlationId,
  };
}

function parseEnvelope(value: unknown): import("@evaluation/contracts").JobEnvelope {
  const parsed = JobEnvelopeSchema.safeParse(value);
  if (!parsed.success) throw new NonRetryableJobError("ANALYSIS_JOB_ENVELOPE_INVALID");
  return parsed.data;
}

function parsePayload(value: unknown): z.infer<typeof ProcessPayloadSchema> {
  const parsed = ProcessPayloadSchema.safeParse(value);
  if (!parsed.success) throw new NonRetryableJobError("ANALYSIS_JOB_ENVELOPE_INVALID");
  return parsed.data;
}

function matchesEnvelope(
  request: Readonly<{
    operationId: string;
    idempotencyKey: string;
    payloadHash: string;
    operation: Readonly<{
      id: string;
      organizationId: string;
      jobType: string;
      jobVersion: number;
      correlationId: string;
      idempotencyKey: string;
      payloadHash: string;
    }>;
  }>,
  envelope: import("@evaluation/contracts").JobEnvelope,
  payload: z.infer<typeof ProcessPayloadSchema>,
): boolean {
  return (
    request.operationId === envelope.operationId &&
    request.operation.id === envelope.operationId &&
    request.operation.organizationId === envelope.scope.organizationId &&
    request.operation.jobType === envelope.jobType &&
    request.operation.jobVersion === envelope.jobVersion &&
    request.operation.correlationId === envelope.correlationId &&
    request.operation.idempotencyKey === envelope.idempotencyKey &&
    request.operation.payloadHash === payload.payloadHash &&
    request.idempotencyKey === payload.domainIdempotencyKey &&
    request.payloadHash === payload.payloadHash
  );
}

function conflict(): NonRetryableJobError {
  return new NonRetryableJobError("ANALYSIS_JOB_IDEMPOTENCY_CONFLICT");
}
