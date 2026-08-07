/* eslint-disable no-unused-vars */
import {
  AppError,
  CoachingInsightDecisionSchema,
  DecideCoachingInsightInputSchema,
} from "@evaluation/contracts";

import type { CoachingAuditWriter, CoachingRepository } from "./ports.js";

export class CoachingInsightService {
  constructor(
    private readonly repository: CoachingRepository,
    private readonly audit?: CoachingAuditWriter,
  ) {}

  async read(input: Readonly<{ insightId: string; actorId: string; correlationId?: string }>) {
    const insight = await this.repository.findInsight(input.insightId);
    if (insight === null) throw fail("COACHING_INSIGHT_NOT_FOUND", 404);
    if (insight.employeeId !== input.actorId) throw fail("AUTHZ_SCOPE", 403);
    await this.repository.auditRead?.({
      ...input,
      employeeId: input.actorId,
      eventType: "coaching.insight.employee_read",
    });
    return insight;
  }

  async decide(input: unknown) {
    const parsed = DecideCoachingInsightInputSchema.parse(input);
    const existing = await this.repository.findInsightDecisionByIdempotencyKey?.(
      parsed.idempotencyKey,
    );
    if (existing) {
      if (
        existing.insightId !== parsed.insightId ||
        existing.employeeId !== parsed.employeeId ||
        existing.decision !== parsed.decision
      )
        throw fail("IDEMPOTENCY_CONFLICT", 409);
      return {
        insightId: parsed.insightId,
        decision: parsed.decision,
        version: Number(existing.resultingVersion),
      };
    }
    const insight = await this.read({ insightId: parsed.insightId, actorId: parsed.employeeId });
    if (Number(insight.version) !== parsed.expectedVersion) throw fail("VERSION_CONFLICT", 409);
    await this.repository.appendInsightDecision({
      ...parsed,
      decision: CoachingInsightDecisionSchema.parse(parsed.decision),
      resultingVersion: parsed.expectedVersion + 1,
    });
    await this.audit?.append(undefined, {
      eventType: "coaching.insight.decided",
      actor: { kind: "human", id: parsed.employeeId },
      targetId: parsed.insightId,
      correlationId: parsed.idempotencyKey,
      source: "api",
    });
    return {
      insightId: parsed.insightId,
      decision: parsed.decision,
      version: parsed.expectedVersion + 1,
    };
  }
}
function fail(code: string, status: number) {
  return new AppError(code, "errors.coaching.invalid", status);
}
