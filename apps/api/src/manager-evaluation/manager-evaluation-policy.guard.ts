import { AppError } from "@evaluation/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";
import { parseManagerEvaluationUuid } from "./manager-evaluation-input.js";

export const MANAGER_EVALUATION_POLICY_DATABASE = Symbol("MANAGER_EVALUATION_POLICY_DATABASE");

export type ManagerEvaluationRequest = Readonly<{
  headers: Readonly<Record<string, string | undefined>>;
  params: Readonly<Record<string, string | undefined>>;
  body?: unknown;
  principal?: import("@evaluation/auth").AuthenticatedPrincipal & { roles?: readonly string[] };
}>;

export class ManagerEvaluationPolicyGuard {
  readonly #auth: AuthGuard;
  readonly #database: import("@evaluation/database").DatabaseClient;

  constructor(auth: AuthGuard, database: import("@evaluation/database").DatabaseClient) {
    this.#auth = auth;
    this.#database = database;
  }

  async canActivate(context: import("@nestjs/common").ExecutionContext): Promise<boolean> {
    await this.#auth.canActivate(context);
    const request = context.switchToHttp().getRequest<ManagerEvaluationRequest>();
    const principal = request.principal;
    if (principal?.active !== true) throw forbidden();
    const roles = await this.#database.roleAssignment.findMany({
      where: { userId: principal.userId },
      select: { role: true, scopeType: true, scope: { select: { departmentId: true } } },
    });
    Object.assign(principal, { roles: [...new Set(roles.map(({ role }) => role))] });
    const handler = context.getHandler().name;
    if (handler === "open") {
      const body = object(request.body);
      const departmentId = parseManagerEvaluationUuid(body.departmentId);
      if (!canConfigure(roles, departmentId)) throw forbidden();
      return true;
    }
    const cycleId = request.params.cycleId;
    const responseId = request.params.responseId;
    const cycle =
      cycleId === undefined
        ? responseId === undefined
          ? null
          : await this.#database.managerEvaluationResponse
              .findUnique({
                where: { id: parseManagerEvaluationUuid(responseId) },
                select: { cycle: true, evaluatorId: true },
              })
              .then((value) => value?.cycle ?? null)
        : await this.#database.managerEvaluationCycle.findUnique({
            where: { id: parseManagerEvaluationUuid(cycleId) },
          });
    if (handler === "submit") {
      const body = object(request.body);
      const submittedCycle = await this.#database.managerEvaluationCycle.findUnique({
        where: { id: parseManagerEvaluationUuid(body.cycleId) },
        select: { id: true },
      });
      if (submittedCycle === null) throw forbidden();
      const eligible = await this.#database.managerEvaluatorEligibility.count({
        where: { cycleId: submittedCycle.id, evaluatorId: principal.userId },
      });
      if (eligible !== 1) throw forbidden();
      return true;
    }
    if (cycle === null) throw forbidden();
    if (handler === "eligibility") {
      if (principal.userId !== cycle.managerId && !canConfigure(roles, cycle.departmentId)) {
        throw forbidden();
      }
      return true;
    }
    // Identified originals, completion, and summaries belong only to the frozen manager.
    if (principal.userId !== cycle.managerId) throw forbidden();
    return true;
  }
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw forbidden();
  return value as Record<string, unknown>;
}

function canConfigure(
  roles: readonly { role: string; scopeType: string; scope: { departmentId: string | null } }[],
  departmentId: string,
) {
  return roles.some(
    ({ role, scopeType, scope }) =>
      (role === "system_administrator" && scopeType === "system") ||
      (role === "manager" && scopeType === "department" && scope.departmentId === departmentId),
  );
}

function forbidden() {
  return new AppError("MANAGER_EVALUATION_FORBIDDEN", "errors.managerEvaluation.forbidden", 403);
}

Injectable()(ManagerEvaluationPolicyGuard);
Inject(AuthGuard)(ManagerEvaluationPolicyGuard, undefined, 0);
Inject(MANAGER_EVALUATION_POLICY_DATABASE)(ManagerEvaluationPolicyGuard, undefined, 1);
