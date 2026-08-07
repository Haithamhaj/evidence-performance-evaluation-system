import { databaseAuditWriter } from "@evaluation/audit";
import {
  AddEvaluationDiscussionEntryInputSchema,
  AppError,
  AssessmentEntrySchema,
} from "@evaluation/contracts";
import { z } from "zod";

type Database = import("@evaluation/database").DatabaseClient;
type Transaction = import("./ports.js").EvaluationTransaction;
type Audit = import("@evaluation/contracts").AuditWriter<Transaction>;

export type EvaluationDiscussionEntryReceipt = Readonly<{
  schemaVersion: 1;
  id: string;
  assignmentId: string;
  actorId: string;
  body: string;
  sourceReferences: readonly string[];
  resultingVersion: number;
  createdAt: string;
}>;

export class EvaluationDiscussionService {
  readonly #database: Database;
  readonly #audit: Audit;

  constructor(database: Database, audit: Audit = databaseAuditWriter as Audit) {
    this.#database = database;
    this.#audit = audit;
  }

  async add(input: unknown): Promise<EvaluationDiscussionEntryReceipt> {
    const parsed = AddEvaluationDiscussionEntryInputSchema.parse(input);
    return serializable(this.#database, async (transaction) => {
      const duplicate = await transaction.evaluationDiscussionEntry.findUnique({
        where: { idempotencyKey: parsed.idempotencyKey },
      });
      if (duplicate !== null) {
        if (
          duplicate.assignmentId !== parsed.assignmentId ||
          duplicate.actorId !== parsed.actorId ||
          duplicate.body !== parsed.body ||
          duplicate.resultingVersion !== parsed.expectedVersion + 1 ||
          JSON.stringify(duplicate.sourceReferences) !== JSON.stringify(parsed.sourceReferences)
        ) {
          throw discussionError("IDEMPOTENCY_KEY_REUSED", 409);
        }
        return serialize(duplicate);
      }
      const assignment = await transaction.evaluationAssignment.findUnique({
        where: { id: parsed.assignmentId },
        include: {
          cycle: { select: { state: true } },
          submissions: { include: { revision: true } },
        },
      });
      if (assignment === null) throw discussionError("EVALUATION_ASSIGNMENT_NOT_FOUND", 404);
      if (![assignment.employeeId, assignment.managerId].includes(parsed.actorId)) {
        throw discussionError("AUTHZ_SCOPE", 403);
      }
      if (assignment.cycle.state !== "COMPARISON") {
        throw discussionError("EVALUATION_DISCUSSION_STAGE_INVALID", 409);
      }
      if (assignment.version !== parsed.expectedVersion) {
        throw discussionError("VERSION_CONFLICT", 409);
      }
      if (assignment.submissions.length !== 2) {
        throw discussionError("EVALUATION_SUBMISSIONS_REQUIRED", 409);
      }
      const authorizedSources = new Set(
        assignment.submissions.flatMap(({ revision }) =>
          z
            .array(AssessmentEntrySchema)
            .parse(revision.entries)
            .flatMap(({ sourceReferences }) => sourceReferences),
        ),
      );
      if (parsed.sourceReferences.some((source) => !authorizedSources.has(source))) {
        throw discussionError("EVALUATION_DISCUSSION_SOURCE_NOT_AUTHORIZED", 403);
      }
      const entry = await transaction.evaluationDiscussionEntry.create({
        data: {
          idempotencyKey: parsed.idempotencyKey,
          assignmentId: assignment.id,
          actorId: parsed.actorId,
          body: parsed.body,
          sourceReferences: parsed.sourceReferences,
          resultingVersion: parsed.expectedVersion + 1,
        },
      });
      const advanced = await transaction.evaluationAssignment.updateMany({
        where: { id: assignment.id, version: parsed.expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (advanced.count !== 1) throw discussionError("VERSION_CONFLICT", 409);
      await this.#audit.append(transaction, {
        eventType: "evaluation.discussion.recorded",
        actor: { kind: "human", id: parsed.actorId },
        effectiveSubjectId: assignment.employeeId,
        scopeType: "cycle",
        scopeId: assignment.cycleId,
        targetType: "evaluation_discussion_entry",
        targetId: entry.id,
        safeDiff: { sourceReferenceCount: parsed.sourceReferences.length },
        correlationId: parsed.idempotencyKey,
        source: "api",
      });
      return serialize(entry);
    });
  }
}

function serialize(entry: {
  id: string;
  assignmentId: string;
  actorId: string;
  body: string;
  sourceReferences: unknown;
  resultingVersion: number;
  createdAt: Date;
}): EvaluationDiscussionEntryReceipt {
  return {
    schemaVersion: 1,
    id: entry.id,
    assignmentId: entry.assignmentId,
    actorId: entry.actorId,
    body: entry.body,
    sourceReferences: z.array(z.string().uuid()).parse(entry.sourceReferences),
    resultingVersion: entry.resultingVersion,
    createdAt: entry.createdAt.toISOString(),
  };
}

function discussionError(code: string, status = 400): AppError {
  return new AppError(code, "errors.evaluation.discussionInvalid", status);
}

async function serializable<T>(
  database: Database,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await database.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (attempt < 4 && isRetryable(error)) continue;
      throw error;
    }
  }
  throw new Error("Unreachable evaluation discussion retry state");
}

function isRetryable(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    ["P2034", "P2002"].includes(String((error as { code?: unknown }).code))
  );
}
