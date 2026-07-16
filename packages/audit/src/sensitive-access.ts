import { z } from "zod";

import { AppError } from "@evaluation/contracts";

export const SensitiveAccessRequestSchema = z
  .object({
    visibilityMode: z.enum(["manager_blinded", "anonymous_aggregated"]),
    reason: z.string().trim().min(3).max(500),
    actor: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("human"), id: z.string().uuid() }).strict(),
      z.object({ kind: z.literal("service"), id: z.enum(["bootstrap"]) }).strict(),
    ]),
    effectiveSubjectId: z.string().uuid(),
    scopeType: z.enum(["system", "organization", "department", "project", "workstream", "cycle"]),
    scopeId: z.string().uuid(),
    targetType: z.string().min(1),
    targetId: z.string().uuid(),
    correlationId: z.string().uuid(),
    source: z.enum(["api", "worker", "seed", "admin_replay"]),
  })
  .strict();

const IdentifiedAccessRequestSchema = z
  .object({ visibilityMode: z.literal("identified"), targetId: z.string().uuid() })
  .strict();

interface TransactionRunner<TTransaction> {
  $transaction<TResult>(
    operation: (transaction: TTransaction) => Promise<TResult>,
  ): Promise<TResult>;
}

export async function accessSensitiveContent<TTransaction, TContent>(
  transactionRunner: TransactionRunner<TTransaction>,
  request: unknown,
  writer: import("@evaluation/contracts").AuditWriter<TTransaction>,
  authorize: (
    transaction: TTransaction,
    request: z.infer<typeof SensitiveAccessRequestSchema>,
  ) => boolean | Promise<boolean>,
  loadProtectedContent: () => Promise<TContent>,
): Promise<TContent> {
  const mode = z
    .object({ visibilityMode: z.enum(["identified", "manager_blinded", "anonymous_aggregated"]) })
    .passthrough()
    .parse(request).visibilityMode;
  if (mode === "identified") {
    IdentifiedAccessRequestSchema.parse(request);
    return loadProtectedContent();
  }

  const parsed = SensitiveAccessRequestSchema.parse(request);
  const allowed = await transactionRunner.$transaction(async (transaction) => {
    const decision = await authorize(transaction, parsed);
    await writer.append(transaction, {
      eventType: "sensitive.access.decision",
      actor: parsed.actor,
      effectiveSubjectId: parsed.effectiveSubjectId,
      scopeType: parsed.scopeType,
      scopeId: parsed.scopeId,
      targetType: parsed.targetType,
      targetId: parsed.targetId,
      reason: parsed.reason,
      correlationId: parsed.correlationId,
      source: parsed.source,
      safeDiff: {
        visibilityMode: parsed.visibilityMode,
        decision: decision ? "allowed" : "denied",
      },
    });
    return decision;
  });
  if (!allowed) {
    throw new AppError("AUTHZ_SENSITIVE_ACCESS_DENIED", "errors.authorization.denied", 403);
  }
  return loadProtectedContent();
}
