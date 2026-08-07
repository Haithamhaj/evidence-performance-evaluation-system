export type ContinuityScope = Readonly<{ kind: "PROJECT" | "WORKSTREAM"; id: string }>;
export type LeaveRow = Readonly<{
  id: string;
  employeeId: string;
  departmentId: string;
  state: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "ACTIVE" | "RETURNED" | "CANCELLED";
  startsAt: string;
  endsAt: string;
  reasonCategory: "PLANNED_LEAVE" | "UNPLANNED_LEAVE" | "OTHER_APPROVED_ABSENCE";
  affectedScopes: readonly ContinuityScope[];
  version: number;
}>;

export interface ContinuityAuthorizationPort {
  canManageEmployee(actorId: string, employeeId: string, departmentId: string): Promise<boolean>;
}

export interface ContinuityScopeReader {
  assertEmployeeScope(employeeId: string, scope: ContinuityScope): Promise<void>;
}

export interface ContinuityTransaction {
  createLeave(input: LeaveRow): Promise<LeaveRow>;
  findLeave(id: string): Promise<LeaveRow | null>;
  updateLeave(id: string, state: LeaveRow["state"], version: number): Promise<LeaveRow>;
  appendLeaveDecision(input: Record<string, unknown>): Promise<void>;
  appendLeaveTransition(input: Record<string, unknown>): Promise<void>;
  appendEligibilityEffect(input: Record<string, unknown>): Promise<void>;
  appendAudit(input: Record<string, unknown>): Promise<{ id: string }>;
  findApprovedLeaveAt(employeeId: string, occurredAt: string): Promise<LeaveRow | null>;
  currentHandoverRevision(handoverId: string): Promise<number>;
  appendHandoverRevision(input: Record<string, unknown>): Promise<{ revision: number }>;
  appendHandoverConfirmation(input: Record<string, unknown>): Promise<void>;
}

export interface ContinuityStore extends ContinuityTransaction {
  transaction<T>(operation: (transaction: ContinuityTransaction) => Promise<T>): Promise<T>;
}
