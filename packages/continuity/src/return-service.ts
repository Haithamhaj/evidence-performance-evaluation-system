/* eslint-disable no-unused-vars */
import { AppError } from "@evaluation/contracts";
import { z } from "zod";

const Complete = z
  .object({
    delegationId: z.string().uuid(),
    actingOwnerId: z.string().uuid(),
    originalOwnerId: z.string().uuid(),
    completedWork: z.string().trim().min(1).max(4_000),
    decisionsAndChanges: z.string().trim().min(1).max(4_000),
    openWork: z.string().trim().min(1).max(4_000),
    risksAndNextSteps: z.string().trim().min(1).max(4_000),
    choice: z.enum(["RETURN", "EXTEND", "PERMANENT_TRANSFER"]),
    confirmedById: z.string().uuid().nullable(),
    occurredAt: z.iso.datetime({ offset: true }),
    correlationId: z.string().uuid(),
  })
  .strict();

export type ReturnDelegation = Readonly<{
  id: string;
  ownerId: string;
  delegateId: string;
  state: "ACTIVE" | "RETURNED" | "EXPIRED";
}>;

export interface ReturnTransaction {
  findDelegation(id: string): Promise<ReturnDelegation | null>;
  expireDelegation(id: string, occurredAt: string): Promise<void>;
  appendReturn(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  appendAudit(input: Record<string, unknown>): Promise<{ id: string }>;
}

export interface ReturnStore extends ReturnTransaction {
  transaction<T>(operation: (tx: ReturnTransaction) => Promise<T>): Promise<T>;
}

export class ReturnService {
  constructor(private readonly store: ReturnStore) {}

  async complete(input: unknown) {
    const parsed = Complete.parse(input);
    return this.store.transaction(async (tx) => {
      const delegation = await tx.findDelegation(parsed.delegationId);
      if (!delegation) throw failure("DELEGATION_NOT_FOUND", 404);
      if (
        delegation.state !== "ACTIVE" ||
        delegation.delegateId !== parsed.actingOwnerId ||
        delegation.ownerId !== parsed.originalOwnerId
      ) {
        throw failure("RETURN_HANDOVER_INVALID", 409);
      }
      const id = crypto.randomUUID();
      const audit = await tx.appendAudit({
        eventType: "continuity.delegation.returned",
        actorId: parsed.actingOwnerId,
        subjectId: parsed.originalOwnerId,
        targetId: parsed.delegationId,
        correlationId: parsed.correlationId,
      });
      await tx.expireDelegation(parsed.delegationId, parsed.occurredAt);
      return tx.appendReturn({ ...parsed, id, auditEventId: audit.id });
    });
  }
}

function failure(code: string, status: number) {
  return new AppError(code, "errors.continuity.invalid", status);
}
