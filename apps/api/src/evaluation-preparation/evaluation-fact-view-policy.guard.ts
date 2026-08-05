import { AppError } from "@evaluation/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

import { AuthGuard } from "../auth/auth.guard.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;

export const EVALUATION_PREPARATION_DATABASE = Symbol("EVALUATION_PREPARATION_DATABASE");

export type EvaluationFactRequestContext = Readonly<{
  cycle: Readonly<{
    id: string;
    startsAt: string;
    endsAt: string;
    rubricVersionId: string;
  }>;
  requester: import("@evaluation/evaluation-preparation").AuthorizedEvaluationActor;
  eligibilityState: "active" | "excluded" | "approved_leave" | "pending";
}>;

export type EvaluationFactRequest = Readonly<{
  params: Readonly<{ cycleId?: string; employeeId?: string }>;
  principal?: import("@evaluation/auth").AuthenticatedPrincipal;
  evaluationFactContext?: EvaluationFactRequestContext;
}>;

export class EvaluationFactViewPolicyGuard {
  private readonly authGuard: AuthGuard;
  private readonly database: DatabaseClient;

  constructor(authGuard: AuthGuard, database: DatabaseClient) {
    this.authGuard = authGuard;
    this.database = database;
  }

  async canActivate(context: import("@nestjs/common").ExecutionContext): Promise<boolean> {
    await this.authGuard.canActivate(context);
    const request = context.switchToHttp().getRequest<EvaluationFactRequest>();
    const principal = request.principal;
    if (principal?.active !== true) throw forbidden();
    const cycleId = z.string().uuid().parse(request.params.cycleId);
    const employeeId = z.string().uuid().parse(request.params.employeeId);
    const cycle = await this.database.evaluationCycle.findFirst({
      where: {
        id: cycleId,
        eligibilityEntries: { some: { employeeId } },
      },
      select: {
        id: true,
        managerId: true,
        effectiveFrom: true,
        effectiveTo: true,
        department: { select: { organizationId: true } },
        eligibilityEntries: {
          where: { employeeId },
          take: 1,
          select: { employeeId: true, state: true },
        },
      },
    });
    const eligibility = cycle?.eligibilityEntries[0];
    if (
      cycle === null ||
      cycle === undefined ||
      eligibility === undefined ||
      eligibility.employeeId !== employeeId
    ) {
      throw forbidden();
    }

    const access =
      principal.userId === employeeId
        ? "self"
        : principal.userId === cycle.managerId
          ? "assigned_manager"
          : null;
    if (access === null) throw forbidden();
    const rubric = await this.database.rubricVersion.findFirst({
      where: {
        organizationId: cycle.department.organizationId,
        status: "active",
        activatedAt: { lte: cycle.effectiveFrom },
      },
      orderBy: [{ activatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    if (rubric === null) {
      throw new AppError("EVALUATION_RUBRIC_NOT_FOUND", "errors.evaluation.rubricNotFound", 409);
    }

    Object.assign(request, {
      evaluationFactContext: {
        cycle: {
          id: cycle.id,
          startsAt: cycle.effectiveFrom.toISOString(),
          endsAt: cycle.effectiveTo.toISOString(),
          rubricVersionId: rubric.id,
        },
        requester: {
          actorId: principal.userId,
          subjectEmployeeId: employeeId,
          access,
          active: true,
        },
        eligibilityState: eligibility.state,
      } satisfies EvaluationFactRequestContext,
    });
    return true;
  }
}

function forbidden(): AppError {
  return new AppError("EVALUATION_FACT_VIEW_FORBIDDEN", "errors.evaluation.factViewForbidden", 403);
}

Injectable()(EvaluationFactViewPolicyGuard);
Inject(AuthGuard)(EvaluationFactViewPolicyGuard, undefined, 0);
Inject(EVALUATION_PREPARATION_DATABASE)(EvaluationFactViewPolicyGuard, undefined, 1);
