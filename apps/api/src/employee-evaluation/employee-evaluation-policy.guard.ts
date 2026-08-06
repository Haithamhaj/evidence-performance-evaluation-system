import { AppError } from "@evaluation/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";
import { parseEvaluationUuid } from "./employee-evaluation-input.js";

export const EMPLOYEE_EVALUATION_POLICY_DATABASE = Symbol("EMPLOYEE_EVALUATION_POLICY_DATABASE");

export type EmployeeEvaluationRequest = Readonly<{
  params: Readonly<{ assignmentId?: string; cycleId?: string; versionId?: string }>;
  body?: Readonly<Record<string, unknown>>;
  principal?: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
  evaluationScope?: Readonly<{
    assignmentId: string;
    cycleId: string;
    employeeId: string;
    managerId: string;
    departmentId: string;
    assignmentVersion: number;
    cycleVersion: number;
    cycleState: import("@evaluation/contracts").EvaluationCycleState;
    access: "self" | "assigned_manager";
  }>;
}>;

type Database = import("@evaluation/database").DatabaseClient;

export class EmployeeEvaluationPolicyGuard {
  readonly #auth: AuthGuard;
  readonly #database: Database;

  constructor(auth: AuthGuard, database: Database) {
    this.#auth = auth;
    this.#database = database;
  }

  async canActivate(context: import("@nestjs/common").ExecutionContext): Promise<boolean> {
    await this.#auth.canActivate(context);
    const request = context.switchToHttp().getRequest<EmployeeEvaluationRequest>();
    const principal = request.principal;
    if (principal?.active !== true) throw forbidden();

    const roleAssignments = await this.#database.roleAssignment.findMany({
      where: { userId: principal.userId },
      select: {
        role: true,
        scopeType: true,
        scope: { select: { departmentId: true } },
      },
    });
    Object.assign(request, {
      principal: {
        ...principal,
        roles: [...new Set(roleAssignments.map(({ role }) => role))],
      },
    });

    const handler = context.getHandler().name;
    if (handler === "activate") {
      if (!hasSystemAdministrator(roleAssignments)) throw forbidden();
      return true;
    }
    if (handler === "open") {
      const departmentId = parseEvaluationUuid(request.body?.departmentId);
      if (!canConfigureDepartment(roleAssignments, departmentId)) throw forbidden();
      return true;
    }
    if (handler === "transition") {
      const cycleId = parseEvaluationUuid(request.params.cycleId);
      const cycle = await this.#database.employeeEvaluationCycle.findUnique({
        where: { id: cycleId },
        select: { departmentId: true },
      });
      if (cycle === null || !canConfigureDepartment(roleAssignments, cycle.departmentId)) {
        throw forbidden();
      }
      return true;
    }

    const assignmentParameter = request.params.assignmentId;
    if (assignmentParameter === undefined) return true;
    const assignmentId = parseEvaluationUuid(assignmentParameter);
    const assignment = await this.#database.evaluationAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        employeeId: true,
        managerId: true,
        cycleId: true,
        version: true,
        cycle: { select: { departmentId: true, state: true, version: true } },
      },
    });
    if (assignment === null) throw forbidden();
    if (handler === "eligibility") {
      if (!canConfigureDepartment(roleAssignments, assignment.cycle.departmentId)) {
        throw forbidden();
      }
      return true;
    }
    const access =
      principal.userId === assignment.employeeId
        ? "self"
        : principal.userId === assignment.managerId
          ? "assigned_manager"
          : null;
    if (access === null) throw forbidden();

    if (["getManagerDraft", "finalize", "close", "readDepartmentReport"].includes(handler)) {
      if (access !== "assigned_manager") throw forbidden();
    }
    if (["acknowledge", "readEmployeeReport"].includes(handler) && access !== "self") {
      throw forbidden();
    }
    Object.assign(request, {
      evaluationScope: {
        assignmentId: assignment.id,
        cycleId: assignment.cycleId,
        employeeId: assignment.employeeId,
        managerId: assignment.managerId,
        departmentId: assignment.cycle.departmentId,
        assignmentVersion: assignment.version,
        cycleVersion: assignment.cycle.version,
        cycleState: assignment.cycle.state,
        access,
      },
    });
    return true;
  }
}

type RoleAssignment = Readonly<{
  role: string;
  scopeType: string;
  scope: Readonly<{ departmentId: string | null }>;
}>;

function hasSystemAdministrator(assignments: readonly RoleAssignment[]): boolean {
  return assignments.some(
    ({ role, scopeType }) => role === "system_administrator" && scopeType === "system",
  );
}

function canConfigureDepartment(
  assignments: readonly RoleAssignment[],
  departmentId: string,
): boolean {
  return (
    hasSystemAdministrator(assignments) ||
    assignments.some(
      ({ role, scopeType, scope }) =>
        role === "manager" && scopeType === "department" && scope.departmentId === departmentId,
    )
  );
}

function forbidden(): AppError {
  return new AppError("EMPLOYEE_EVALUATION_FORBIDDEN", "errors.evaluation.forbidden", 403);
}

Injectable()(EmployeeEvaluationPolicyGuard);
Inject(AuthGuard)(EmployeeEvaluationPolicyGuard, undefined, 0);
Inject(EMPLOYEE_EVALUATION_POLICY_DATABASE)(EmployeeEvaluationPolicyGuard, undefined, 1);
