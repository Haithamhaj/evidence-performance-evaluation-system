/* eslint-disable no-unused-vars */
import { AppError } from "@evaluation/contracts";
import { z } from "zod";

const Utc = z.iso.datetime({ offset: true }).refine((value) => value.endsWith("Z"));
const Deactivate = z
  .object({
    administratorId: z.string().uuid(),
    userId: z.string().uuid(),
    occurredAt: Utc,
    correlationId: z.string().uuid(),
  })
  .strict();
const Resolve = z
  .object({
    caseId: z.string().uuid(),
    actorId: z.string().uuid(),
    successorId: z.string().uuid(),
    effectiveAt: Utc,
    reason: z.string().trim().min(1).max(2_000),
    correlationId: z.string().uuid(),
  })
  .strict();

export type OwnedScope = Readonly<{
  kind: "PROJECT" | "WORKSTREAM";
  id: string;
  projectId?: string;
  version: number;
}>;
export type OffboardingCase = Readonly<{
  id: string;
  formerOwnerId: string;
  scope: OwnedScope;
  state: "REASSIGNMENT_REQUIRED" | "RESOLVED";
  createdAt: string;
}>;

export interface OffboardingTransaction {
  createCaseIfMissing(input: Omit<OffboardingCase, "id" | "state">): Promise<OffboardingCase>;
  findCase(id: string): Promise<OffboardingCase | null>;
  markResolved(id: string, input: Record<string, unknown>): Promise<OffboardingCase>;
  appendAudit(input: Record<string, unknown>): Promise<{ id: string }>;
  appendNotificationIntent(input: Record<string, unknown>): Promise<void>;
  listManagerQueue(managerId: string): Promise<readonly OffboardingCase[]>;
}
export interface OffboardingStore extends OffboardingTransaction {
  transaction<T>(operation: (tx: OffboardingTransaction) => Promise<T>): Promise<T>;
}
export interface AuthDeactivationPort {
  deactivate(input: {
    administratorId: string;
    userId: string;
    occurredAt: string;
    correlationId: string;
  }): Promise<{ userId: string; deactivatedAt: string }>;
}
export interface OwnershipContinuityPort {
  listActiveOwnedScopes(userId: string, occurredAt: string): Promise<readonly OwnedScope[]>;
  resolveReassignment(input: {
    caseId: string;
    scope: OwnedScope;
    actorId: string;
    successorId: string;
    transferKind: "permanent";
    effectiveAt: string;
    expectedVersion: number;
    reason: string;
    correlationId: string;
  }): Promise<OffboardingCase>;
}
export interface ReassignmentAuthorizationPort {
  canResolveReassignment(actorId: string, scope: OwnedScope): Promise<boolean>;
}
export interface AtomicOffboardingPort {
  deactivateWithContinuity(input: {
    administratorId: string;
    userId: string;
    occurredAt: string;
    correlationId: string;
  }): Promise<{
    userId: string;
    administratorId: string;
    deactivatedAt: string;
    preservedHistory: true;
    reassignmentCaseIds: readonly string[];
  }>;
}

export class OffboardingService {
  constructor(
    private readonly store: OffboardingStore,
    private readonly auth: AuthDeactivationPort,
    private readonly ownership: OwnershipContinuityPort,
    private readonly authorization: ReassignmentAuthorizationPort,
    private readonly atomic?: AtomicOffboardingPort,
  ) {}

  async deactivate(input: unknown) {
    const parsed = Deactivate.parse(input);
    if (this.atomic) return this.atomic.deactivateWithContinuity(parsed);
    const receipt = await this.auth.deactivate(parsed);
    const scopes = await this.ownership.listActiveOwnedScopes(parsed.userId, parsed.occurredAt);
    const cases = await this.store.transaction(async (tx) => {
      const created: OffboardingCase[] = [];
      for (const scope of scopes) {
        const audit = await tx.appendAudit({
          eventType: "continuity.reassignment.required",
          actorId: parsed.administratorId,
          subjectId: parsed.userId,
          targetId: scope.id,
          correlationId: parsed.correlationId,
        });
        const item = await tx.createCaseIfMissing({
          formerOwnerId: parsed.userId,
          scope,
          createdAt: receipt.deactivatedAt,
          auditEventId: audit.id,
        } as Omit<OffboardingCase, "id" | "state">);
        created.push(item);
        await tx.appendNotificationIntent({
          kind: "REASSIGNMENT_REQUIRED",
          caseId: item.id,
          formerOwnerId: parsed.userId,
        });
      }
      return created;
    });
    return {
      userId: parsed.userId,
      administratorId: parsed.administratorId,
      deactivatedAt: receipt.deactivatedAt,
      preservedHistory: true as const,
      reassignmentCaseIds: cases.map((item) => item.id),
    };
  }

  async resolve(input: unknown): Promise<OffboardingCase> {
    const parsed = Resolve.parse(input);
    const caseRecord = await this.store.findCase(parsed.caseId);
    if (!caseRecord) throw failure("REASSIGNMENT_CASE_NOT_FOUND", 404);
    if (caseRecord.state !== "REASSIGNMENT_REQUIRED") {
      throw failure("REASSIGNMENT_CASE_RESOLVED", 409);
    }
    if (!(await this.authorization.canResolveReassignment(parsed.actorId, caseRecord.scope))) {
      throw failure("AUTHZ_SCOPE", 403);
    }
    return this.ownership.resolveReassignment({
      caseId: caseRecord.id,
      scope: caseRecord.scope,
      actorId: parsed.actorId,
      successorId: parsed.successorId,
      transferKind: "permanent",
      effectiveAt: parsed.effectiveAt,
      expectedVersion: caseRecord.scope.version,
      reason: parsed.reason,
      correlationId: parsed.correlationId,
    });
  }

  async managerQueue(actorId: string): Promise<readonly OffboardingCase[]> {
    z.string().uuid().parse(actorId);
    return this.store.listManagerQueue(actorId);
  }
}

function failure(code: string, status: number) {
  return new AppError(code, "errors.continuity.invalid", status);
}
