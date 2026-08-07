/* eslint-disable no-unused-vars */
import type {
  ContinuityScopeReader,
  ContinuityStore,
  ContinuityTransaction,
  LeaveRow,
} from "./ports.js";

export const allowAllScopeReader: ContinuityScopeReader = {
  assertEmployeeScope: async () => undefined,
};

export class MemoryContinuityStore implements ContinuityStore {
  readonly leaves = new Map<string, LeaveRow>();
  readonly handoverRevisions: Record<string, unknown>[] = [];
  readonly handoverConfirmations: Record<string, unknown>[] = [];
  readonly decisions: Record<string, unknown>[] = [];
  readonly transitions: Record<string, unknown>[] = [];
  readonly eligibility: Record<string, unknown>[] = [];
  readonly audits: Record<string, unknown>[] = [];
  failNextAudit = false;

  async transaction<T>(operation: (transaction: ContinuityTransaction) => Promise<T>): Promise<T> {
    const snapshot = {
      leaves: new Map(this.leaves),
      handover: [...this.handoverRevisions],
      confirmations: [...this.handoverConfirmations],
      decisions: [...this.decisions],
      transitions: [...this.transitions],
      eligibility: [...this.eligibility],
      audits: [...this.audits],
    };
    try {
      return await operation(this);
    } catch (error) {
      this.leaves.clear();
      for (const [key, value] of snapshot.leaves) this.leaves.set(key, value);
      replace(this.handoverRevisions, snapshot.handover);
      replace(this.decisions, snapshot.decisions);
      replace(this.handoverConfirmations, snapshot.confirmations);
      replace(this.transitions, snapshot.transitions);
      replace(this.eligibility, snapshot.eligibility);
      replace(this.audits, snapshot.audits);
      throw error;
    }
  }
  async createLeave(input: LeaveRow) {
    this.leaves.set(input.id, input);
    return input;
  }
  async findLeave(id: string) {
    return this.leaves.get(id) ?? null;
  }
  async updateLeave(id: string, state: LeaveRow["state"], version: number) {
    const current = this.leaves.get(id);
    if (!current) throw new Error("leave missing");
    const next = { ...current, state, version };
    this.leaves.set(id, next);
    return next;
  }
  async appendLeaveDecision(input: Record<string, unknown>) {
    this.decisions.push(input);
  }
  async appendLeaveTransition(input: Record<string, unknown>) {
    this.transitions.push(input);
  }
  async appendEligibilityEffect(input: Record<string, unknown>) {
    this.eligibility.push(input);
  }
  async appendAudit(input: Record<string, unknown>) {
    if (this.failNextAudit) {
      this.failNextAudit = false;
      throw new Error("audit unavailable");
    }
    const id = crypto.randomUUID();
    this.audits.push({ id, ...input });
    return { id };
  }
  async findApprovedLeaveAt(employeeId: string, occurredAt: string) {
    const instant = Date.parse(occurredAt);
    return (
      [...this.leaves.values()].find(
        (leave) =>
          leave.employeeId === employeeId &&
          ["APPROVED", "ACTIVE"].includes(leave.state) &&
          Date.parse(leave.startsAt) <= instant &&
          instant < Date.parse(leave.endsAt),
      ) ?? null
    );
  }
  async currentHandoverRevision(handoverId: string) {
    return this.handoverRevisions.filter((item) => item.handoverId === handoverId).length;
  }
  async appendHandoverRevision(input: Record<string, unknown>) {
    this.handoverRevisions.push(input);
    return { revision: input.revision as number };
  }
  async appendHandoverConfirmation(input: Record<string, unknown>) {
    this.handoverConfirmations.push(input);
  }
}

function replace<T>(target: T[], source: T[]) {
  target.splice(0, target.length, ...source);
}
