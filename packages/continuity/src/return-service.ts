/* eslint-disable no-unused-vars */
import { AppError } from "@evaluation/contracts";
import { z } from "zod";

const Utc = z.iso.datetime({ offset: true }).refine((value) => value.endsWith("Z"));
const Draft = z
  .object({
    id: z.string().uuid(),
    delegationId: z.string().uuid(),
    actorId: z.string().uuid(),
    completedWork: z.string().trim().min(1).max(4_000),
    decisionsAndChanges: z.string().trim().min(1).max(4_000),
    openWork: z.string().trim().min(1).max(4_000),
    risksAndNextSteps: z.string().trim().min(1).max(4_000),
    correlationId: z.string().uuid(),
  })
  .strict();
const Confirm = z
  .object({
    returnId: z.string().uuid(),
    delegationId: z.string().uuid(),
    actorId: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
    correlationId: z.string().uuid(),
  })
  .strict();
const Finalize = z
  .object({
    returnId: z.string().uuid(),
    delegationId: z.string().uuid(),
    managerId: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
    choice: z.enum(["RETURN", "EXTEND", "PERMANENT_TRANSFER"]),
    occurredAt: Utc,
    extendedEndsAt: Utc.optional(),
    reason: z.string().trim().min(1).max(2_000),
    correlationId: z.string().uuid(),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      input.choice === "EXTEND" &&
      (input.extendedEndsAt === undefined ||
        Date.parse(input.extendedEndsAt) <= Date.parse(input.occurredAt))
    ) {
      context.addIssue({ code: "custom", message: "valid extension end is required" });
    }
    if (input.choice !== "EXTEND" && input.extendedEndsAt !== undefined) {
      context.addIssue({ code: "custom", message: "extension end is not allowed" });
    }
  });

export type ReturnDelegation = Readonly<{
  id: string;
  ownerId: string;
  delegateId: string;
  managerId: string;
  departmentId: string;
  state: "ACTIVE" | "RETURNED" | "EXPIRED";
}>;

export type ReturnRecord = Readonly<{
  id: string;
  delegationId: string;
  actingOwnerId: string;
  originalOwnerId: string;
  state: "DRAFT" | "OWNER_CONFIRMED" | "FINALIZED";
  version: number;
  choice: "RETURN" | "EXTEND" | "PERMANENT_TRANSFER" | null;
}>;

export interface ReturnTransaction {
  findDelegation(id: string): Promise<ReturnDelegation | null>;
  findReturn(id: string): Promise<ReturnRecord | null>;
  expireDelegation(id: string, occurredAt: string): Promise<void>;
  extendDelegation(id: string, input: Record<string, unknown>): Promise<void>;
  appendReturn(input: Record<string, unknown>): Promise<ReturnRecord>;
  confirmReturn(id: string, input: Record<string, unknown>): Promise<ReturnRecord>;
  finalizeReturn(id: string, input: Record<string, unknown>): Promise<ReturnRecord>;
  appendAudit(input: Record<string, unknown>): Promise<{ id: string }>;
}

export interface ReturnStore extends ReturnTransaction {
  transaction<T>(operation: (tx: ReturnTransaction) => Promise<T>): Promise<T>;
}

export interface ReturnAuthorizationPort {
  canManageEmployee(managerId: string, employeeId: string, departmentId: string): Promise<boolean>;
}

export interface ReturnDecisionPort {
  permanentTransfer(
    delegation: ReturnDelegation,
    input: Readonly<{
      managerId: string;
      occurredAt: string;
      reason: string;
      correlationId: string;
    }>,
  ): Promise<void>;
}

export class ReturnService {
  constructor(
    private readonly store: ReturnStore,
    private readonly authorization: ReturnAuthorizationPort,
    private readonly decisions: ReturnDecisionPort,
  ) {}

  async draft(input: unknown): Promise<ReturnRecord> {
    const parsed = Draft.parse(input);
    return this.store.transaction(async (tx) => {
      const delegation = await requiredDelegation(tx, parsed.delegationId);
      if (delegation.state !== "ACTIVE" || delegation.delegateId !== parsed.actorId) {
        throw failure("RETURN_HANDOVER_INVALID", 409);
      }
      const audit = await tx.appendAudit({
        eventType: "continuity.return.drafted",
        actorId: parsed.actorId,
        subjectId: delegation.ownerId,
        targetId: parsed.id,
        correlationId: parsed.correlationId,
      });
      return tx.appendReturn({
        ...parsed,
        actingOwnerId: delegation.delegateId,
        originalOwnerId: delegation.ownerId,
        auditEventId: audit.id,
      });
    });
  }

  async confirm(input: unknown): Promise<ReturnRecord> {
    const parsed = Confirm.parse(input);
    return this.store.transaction(async (tx) => {
      const delegation = await requiredDelegation(tx, parsed.delegationId);
      const record = await requiredReturn(tx, parsed.returnId);
      if (
        record.delegationId !== delegation.id ||
        record.originalOwnerId !== parsed.actorId ||
        record.state !== "DRAFT" ||
        record.version !== parsed.expectedVersion
      ) {
        throw failure("RETURN_HANDOVER_INVALID", 409);
      }
      const audit = await tx.appendAudit({
        eventType: "continuity.return.owner_confirmed",
        actorId: parsed.actorId,
        targetId: record.id,
        correlationId: parsed.correlationId,
      });
      return tx.confirmReturn(record.id, {
        confirmedById: parsed.actorId,
        expectedVersion: parsed.expectedVersion,
        auditEventId: audit.id,
      });
    });
  }

  async finalize(input: unknown): Promise<ReturnRecord> {
    const parsed = Finalize.parse(input);
    const delegation = await this.store.findDelegation(parsed.delegationId);
    if (!delegation) throw failure("DELEGATION_NOT_FOUND", 404);
    if (
      !(await this.authorization.canManageEmployee(
        parsed.managerId,
        delegation.ownerId,
        delegation.departmentId,
      ))
    ) {
      throw failure("AUTHZ_SCOPE", 403);
    }
    if (parsed.choice === "PERMANENT_TRANSFER") {
      await this.decisions.permanentTransfer(delegation, parsed);
    }
    return this.store.transaction(async (tx) => {
      const freshDelegation = await requiredDelegation(tx, parsed.delegationId);
      const record = await requiredReturn(tx, parsed.returnId);
      const delegationStateAllowed =
        freshDelegation.state === "ACTIVE" ||
        (parsed.choice === "PERMANENT_TRANSFER" && freshDelegation.state === "RETURNED");
      if (
        !delegationStateAllowed ||
        record.delegationId !== freshDelegation.id ||
        !["DRAFT", "OWNER_CONFIRMED"].includes(record.state) ||
        record.version !== parsed.expectedVersion
      ) {
        throw failure("RETURN_HANDOVER_INVALID", 409);
      }
      const audit = await tx.appendAudit({
        eventType: "continuity.return.manager_finalized",
        actorId: parsed.managerId,
        subjectId: freshDelegation.ownerId,
        targetId: record.id,
        reason: parsed.reason,
        safeDiff: {
          choice: parsed.choice,
          occurredAt: parsed.occurredAt,
          ...(parsed.extendedEndsAt ? { extendedEndsAt: parsed.extendedEndsAt } : {}),
        },
        correlationId: parsed.correlationId,
      });
      if (parsed.choice === "RETURN") {
        await tx.expireDelegation(parsed.delegationId, parsed.occurredAt);
      } else if (parsed.choice === "EXTEND") {
        await tx.extendDelegation(parsed.delegationId, {
          managerId: parsed.managerId,
          occurredAt: parsed.occurredAt,
          extendedEndsAt: parsed.extendedEndsAt!,
          reason: parsed.reason,
          correlationId: parsed.correlationId,
          auditEventId: audit.id,
        });
      }
      return tx.finalizeReturn(record.id, {
        choice: parsed.choice,
        finalizedById: parsed.managerId,
        expectedVersion: parsed.expectedVersion,
        auditEventId: audit.id,
      });
    });
  }
}

async function requiredDelegation(tx: ReturnTransaction, id: string) {
  const record = await tx.findDelegation(id);
  if (!record) throw failure("DELEGATION_NOT_FOUND", 404);
  return record;
}

async function requiredReturn(tx: ReturnTransaction, id: string) {
  const record = await tx.findReturn(id);
  if (!record) throw failure("RETURN_HANDOVER_NOT_FOUND", 404);
  return record;
}

function failure(code: string, status: number) {
  return new AppError(code, "errors.continuity.invalid", status);
}
