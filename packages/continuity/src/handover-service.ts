/* eslint-disable no-unused-vars */
import { AppError } from "@evaluation/contracts";
import { z } from "zod";

import type { ContinuityScopeReader, ContinuityStore } from "./ports.js";

const Scope = z.object({ kind: z.enum(["PROJECT", "WORKSTREAM"]), id: z.string().uuid() }).strict();
const Item = z
  .object({
    scope: Scope,
    currentState: z.string().trim().min(1).max(4_000),
    completedWork: z.string().trim().min(1).max(4_000),
    openWork: z.string().trim().min(1).max(4_000),
    blockersAndRisks: z.string().trim().min(1).max(4_000),
    immediateNextStep: z.string().trim().min(1).max(4_000),
    keyLinks: z.array(z.url()).max(50),
    requiredAccess: z.array(z.string().trim().min(1).max(500)).max(50),
    pendingDecisions: z.array(z.string().trim().min(1).max(2_000)).max(50),
    proposedDelegateId: z.string().uuid().nullable(),
  })
  .strict();
const Revise = z
  .object({
    handoverId: z.string().uuid(),
    leaveId: z.string().uuid(),
    employeeId: z.string().uuid(),
    actorId: z.string().uuid(),
    expectedRevision: z.number().int().min(0),
    correlationId: z.string().uuid(),
    items: z.array(Item).min(1).max(100),
  })
  .strict()
  .refine(({ employeeId, actorId }) => employeeId === actorId, {
    message: "employee must author own handover",
  });
const Confirm = z
  .object({
    handoverId: z.string().uuid(),
    employeeId: z.string().uuid(),
    actorId: z.string().uuid(),
    expectedRevision: z.number().int().positive(),
    correlationId: z.string().uuid(),
  })
  .strict()
  .refine(({ employeeId, actorId }) => employeeId === actorId, {
    message: "employee must confirm own handover",
  });

export class HandoverService {
  constructor(
    private readonly store: ContinuityStore,
    private readonly scopes: ContinuityScopeReader,
  ) {}

  async revise(input: unknown) {
    if (containsSensitiveKey(input)) throw failure("HANDOVER_SENSITIVE_CONTENT", 400);
    const parsed = Revise.parse(input);
    await Promise.all(
      parsed.items.map((item) => this.scopes.assertEmployeeScope(parsed.employeeId, item.scope)),
    );
    return this.store.transaction(async (transaction) => {
      const current = await transaction.currentHandoverRevision(parsed.handoverId);
      if (current !== parsed.expectedRevision) throw failure("VERSION_CONFLICT", 409);
      const audit = await transaction.appendAudit({
        eventType: "continuity.handover.revised",
        actorId: parsed.actorId,
        subjectId: parsed.employeeId,
        targetId: parsed.handoverId,
        scopeType: "department",
        scopeId: parsed.leaveId,
        correlationId: parsed.correlationId,
      });
      return transaction.appendHandoverRevision({
        ...parsed,
        revision: current + 1,
        auditEventId: audit.id,
      });
    });
  }

  async confirm(input: unknown) {
    const parsed = Confirm.parse(input);
    return this.store.transaction(async (transaction) => {
      const current = await transaction.currentHandoverRevision(parsed.handoverId);
      if (current !== parsed.expectedRevision) throw failure("VERSION_CONFLICT", 409);
      const audit = await transaction.appendAudit({
        eventType: "continuity.handover.confirmed",
        actorId: parsed.actorId,
        subjectId: parsed.employeeId,
        targetId: parsed.handoverId,
        scopeType: "department",
        scopeId: parsed.handoverId,
        correlationId: parsed.correlationId,
      });
      await transaction.appendHandoverConfirmation({
        ...parsed,
        confirmedRevision: current,
        auditEventId: audit.id,
      });
      return { handoverId: parsed.handoverId, confirmedRevision: current };
    });
  }
}

const sensitive = /(?:password|secret|token|credential|private.?key)/iu;
function containsSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitiveKey);
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) => sensitive.test(key) || containsSensitiveKey(child),
  );
}
function failure(code: string, status: number) {
  return new AppError(code, "errors.continuity.invalid", status);
}
