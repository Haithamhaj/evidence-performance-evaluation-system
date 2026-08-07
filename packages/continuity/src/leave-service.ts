/* eslint-disable no-unused-vars */
import { AppError } from "@evaluation/contracts";
import { z } from "zod";

import type {
  ContinuityAuthorizationPort,
  ContinuityScopeReader,
  ContinuityStore,
  LeaveRow,
} from "./ports.js";

const Utc = z.iso.datetime({ offset: true }).refine((value) => value.endsWith("Z"));
const Scope = z.object({ kind: z.enum(["PROJECT", "WORKSTREAM"]), id: z.string().uuid() }).strict();
const Submit = z
  .object({
    id: z.string().uuid(),
    employeeId: z.string().uuid(),
    actorId: z.string().uuid(),
    departmentId: z.string().uuid(),
    startsAt: Utc,
    endsAt: Utc,
    reasonCategory: z.enum(["PLANNED_LEAVE", "UNPLANNED_LEAVE", "OTHER_APPROVED_ABSENCE"]),
    affectedScopes: z.array(Scope).min(1).max(100),
    correlationId: z.string().uuid(),
  })
  .strict()
  .refine(({ employeeId, actorId }) => employeeId === actorId, {
    message: "employee must submit own leave",
  })
  .refine(({ startsAt, endsAt }) => Date.parse(startsAt) < Date.parse(endsAt), {
    message: "invalid leave interval",
  });
const Decide = z
  .object({
    leaveId: z.string().uuid(),
    managerId: z.string().uuid(),
    decision: z.enum(["APPROVED", "REJECTED"]),
    reason: z.string().trim().min(1).max(2_000),
    correlationId: z.string().uuid(),
  })
  .strict();
const Activate = z
  .object({
    leaveId: z.string().uuid(),
    managerId: z.string().uuid(),
    occurredAt: Utc,
    correlationId: z.string().uuid(),
  })
  .strict();
const Cancel = z
  .object({
    leaveId: z.string().uuid(),
    actorId: z.string().uuid(),
    reason: z.string().trim().min(1).max(2_000),
    correlationId: z.string().uuid(),
  })
  .strict();

export class LeaveService {
  constructor(
    private readonly store: ContinuityStore,
    private readonly scopes: ContinuityScopeReader,
    private readonly authorization: ContinuityAuthorizationPort,
  ) {}

  async submit(input: unknown): Promise<LeaveRow> {
    const parsed = Submit.parse(input);
    await Promise.all(
      parsed.affectedScopes.map((scope) =>
        this.scopes.assertEmployeeScope(parsed.employeeId, scope),
      ),
    );
    return this.store.transaction(async (transaction) => {
      const leave = await transaction.createLeave({
        id: parsed.id,
        employeeId: parsed.employeeId,
        departmentId: parsed.departmentId,
        state: "SUBMITTED",
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        reasonCategory: parsed.reasonCategory,
        affectedScopes: parsed.affectedScopes,
        version: 1,
      });
      const audit = await transaction.appendAudit({
        eventType: "continuity.leave.submitted",
        actorId: parsed.actorId,
        subjectId: parsed.employeeId,
        targetId: parsed.id,
        scopeType: "department",
        scopeId: parsed.departmentId,
        correlationId: parsed.correlationId,
      });
      await transaction.appendLeaveTransition({
        leaveId: parsed.id,
        fromState: "DRAFT",
        toState: "SUBMITTED",
        actorId: parsed.actorId,
        auditEventId: audit.id,
      });
      return leave;
    });
  }

  async decide(input: unknown): Promise<LeaveRow> {
    const parsed = Decide.parse(input);
    const leave = await this.store.findLeave(parsed.leaveId);
    if (!leave) throw failure("LEAVE_NOT_FOUND", 404);
    if (
      !(await this.authorization.canManageEmployee(
        parsed.managerId,
        leave.employeeId,
        leave.departmentId,
      ))
    ) {
      throw failure("AUTHZ_SCOPE", 403);
    }
    if (leave.state !== "SUBMITTED") throw failure("LEAVE_TRANSITION_INVALID", 409);
    return this.store.transaction(async (transaction) => {
      const fresh = await transaction.findLeave(parsed.leaveId);
      if (!fresh || fresh.state !== "SUBMITTED" || fresh.version !== leave.version)
        throw failure("VERSION_CONFLICT", 409);
      const audit = await transaction.appendAudit({
        eventType: `continuity.leave.${parsed.decision.toLowerCase()}`,
        actorId: parsed.managerId,
        subjectId: fresh.employeeId,
        targetId: fresh.id,
        scopeType: "department",
        scopeId: fresh.departmentId,
        reason: parsed.reason,
        correlationId: parsed.correlationId,
      });
      await transaction.appendLeaveDecision({
        leaveId: fresh.id,
        managerId: parsed.managerId,
        decision: parsed.decision,
        reason: parsed.reason,
        auditEventId: audit.id,
      });
      await transaction.appendLeaveTransition({
        leaveId: fresh.id,
        fromState: fresh.state,
        toState: parsed.decision,
        actorId: parsed.managerId,
        reason: parsed.reason,
        auditEventId: audit.id,
      });
      if (parsed.decision === "APPROVED") {
        await transaction.appendEligibilityEffect({
          leaveId: fresh.id,
          employeeId: fresh.employeeId,
          startsAt: fresh.startsAt,
          endsAt: fresh.endsAt,
          checkInRequired: false,
          negativeRegularitySignal: false,
          evaluationObligationSuspended: true,
          auditEventId: audit.id,
        });
      }
      return transaction.updateLeave(fresh.id, parsed.decision, fresh.version + 1);
    });
  }

  async readEligibility(employeeId: string, occurredAt: string) {
    Utc.parse(occurredAt);
    const leave = await this.store.findApprovedLeaveAt(employeeId, occurredAt);
    return leave
      ? {
          onApprovedLeave: true,
          checkInRequired: false,
          negativeRegularitySignal: false,
          evaluationObligationSuspended: true,
        }
      : {
          onApprovedLeave: false,
          checkInRequired: true,
          negativeRegularitySignal: false,
          evaluationObligationSuspended: false,
        };
  }

  async activate(input: unknown): Promise<LeaveRow> {
    const parsed = Activate.parse(input);
    const leave = await this.store.findLeave(parsed.leaveId);
    if (!leave) throw failure("LEAVE_NOT_FOUND", 404);
    if (
      !(await this.authorization.canManageEmployee(
        parsed.managerId,
        leave.employeeId,
        leave.departmentId,
      ))
    )
      throw failure("AUTHZ_SCOPE", 403);
    if (leave.state !== "APPROVED") throw failure("LEAVE_TRANSITION_INVALID", 409);
    const at = Date.parse(parsed.occurredAt);
    if (at < Date.parse(leave.startsAt) || at >= Date.parse(leave.endsAt))
      throw failure("LEAVE_INTERVAL_INACTIVE", 409);
    return this.transition(
      leave,
      "ACTIVE",
      parsed.managerId,
      "Approved interval started",
      parsed.correlationId,
    );
  }

  async cancel(input: unknown): Promise<LeaveRow> {
    const parsed = Cancel.parse(input);
    const leave = await this.store.findLeave(parsed.leaveId);
    if (!leave) throw failure("LEAVE_NOT_FOUND", 404);
    const manager = await this.authorization.canManageEmployee(
      parsed.actorId,
      leave.employeeId,
      leave.departmentId,
    );
    if (parsed.actorId !== leave.employeeId && !manager) throw failure("AUTHZ_SCOPE", 403);
    if (["REJECTED", "RETURNED", "CANCELLED"].includes(leave.state))
      throw failure("LEAVE_TRANSITION_INVALID", 409);
    return this.transition(leave, "CANCELLED", parsed.actorId, parsed.reason, parsed.correlationId);
  }

  private async transition(
    leave: LeaveRow,
    state: LeaveRow["state"],
    actorId: string,
    reason: string,
    correlationId: string,
  ) {
    return this.store.transaction(async (transaction) => {
      const fresh = await transaction.findLeave(leave.id);
      if (!fresh || fresh.version !== leave.version || fresh.state !== leave.state)
        throw failure("VERSION_CONFLICT", 409);
      const audit = await transaction.appendAudit({
        eventType: `continuity.leave.${state.toLowerCase()}`,
        actorId,
        subjectId: fresh.employeeId,
        targetId: fresh.id,
        scopeType: "department",
        scopeId: fresh.departmentId,
        reason,
        correlationId,
      });
      await transaction.appendLeaveTransition({
        leaveId: fresh.id,
        fromState: fresh.state,
        toState: state,
        actorId,
        reason,
        auditEventId: audit.id,
      });
      return transaction.updateLeave(fresh.id, state, fresh.version + 1);
    });
  }
}

export class PrismaApprovedLeaveReader {
  constructor(private readonly database: import("@evaluation/database").DatabaseClient) {}

  async findApprovedLeave(input: {
    employeeId: string;
    startsAt: string;
    endsAt: string;
  }): Promise<{ leaveId: string } | null> {
    const effect = await this.database.leaveEligibilityEffect.findFirst({
      where: {
        employeeId: input.employeeId,
        startsAt: { lt: new Date(input.endsAt) },
        endsAt: { gt: new Date(input.startsAt) },
        leave: { state: { in: ["APPROVED", "ACTIVE"] } },
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: { leaveId: true },
    });
    return effect;
  }

  async coversInterval(input: {
    employeeId: string;
    startsAt: string;
    endsAt: string;
  }): Promise<{ leaveId: string } | null> {
    return this.database.leaveEligibilityEffect.findFirst({
      where: {
        employeeId: input.employeeId,
        startsAt: { lte: new Date(input.startsAt) },
        endsAt: { gte: new Date(input.endsAt) },
        leave: { state: { in: ["APPROVED", "ACTIVE"] } },
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: { leaveId: true },
    });
  }
}

function failure(code: string, status: number) {
  return new AppError(code, "errors.continuity.invalid", status);
}
