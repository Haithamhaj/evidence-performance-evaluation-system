import { z } from "zod";

const AdministrativeReplayRequestSchema = z
  .object({
    operationId: z.string().uuid(),
    actor: z.object({ kind: z.literal("human"), id: z.string().uuid() }).strict(),
    effectiveSubjectId: z.string().uuid(),
    scopeType: z.enum(["system", "organization", "department", "project", "workstream", "cycle"]),
    scopeId: z.string().uuid(),
    reason: z.string().trim().min(3).max(500),
    correlationId: z.string().uuid(),
  })
  .strict();

interface ReplayTransaction {
  readonly operation: {
    findUnique(args: unknown): Promise<{ readonly id: string; readonly status: string } | null>;
    update(args: unknown): Promise<unknown>;
  };
}

interface ReplayDatabase<TTransaction extends ReplayTransaction> {
  $transaction<T>(callback: (transaction: TTransaction) => Promise<T>): Promise<T>;
}

export async function administrativelyReplayOperation<TTransaction extends ReplayTransaction>(
  database: ReplayDatabase<TTransaction>,
  input: unknown,
  auditWriter: import("@evaluation/contracts").AuditWriter<TTransaction>,
  replay: (operationId: string) => Promise<void>,
): Promise<void> {
  const request = AdministrativeReplayRequestSchema.parse(input);

  await database.$transaction(async (transaction) => {
    const operation = await transaction.operation.findUnique({
      where: { id: request.operationId },
      select: { id: true, status: true },
    });
    if (operation === null || operation.status !== "failed") {
      throw new Error("Only a failed operation can be replayed");
    }

    await auditWriter.append(transaction, {
      eventType: "administrative_replay.requested",
      actor: request.actor,
      effectiveSubjectId: request.effectiveSubjectId,
      scopeType: request.scopeType,
      scopeId: request.scopeId,
      targetType: "operation",
      targetId: request.operationId,
      reason: request.reason,
      safeDiff: { status: { from: "failed", to: "pending" } },
      correlationId: request.correlationId,
      source: "admin_replay",
    });

    await transaction.operation.update({
      where: { id: request.operationId },
      data: {
        status: "pending",
        errorCode: null,
        startedAt: null,
        completedAt: null,
        resultReference: null,
      },
    });
  });

  await replay(request.operationId);
}
