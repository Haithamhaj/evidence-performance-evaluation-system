import { AppError } from "@evaluation/contracts";
import { Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

export const ANALYSIS_CRITERIA_POLICY_ACTION = Symbol("ANALYSIS_CRITERIA_POLICY_ACTION");

export type AnalysisCriteriaPolicyAction =
  | "document.analysis.run"
  | "document.readiness.detail.read"
  | "document.readiness.summary.read"
  | "document.comparison.review";

type GuardRequest = Readonly<{
  principal?: import("@evaluation/auth").AuthenticatedPrincipal;
}>;

export class AnalysisCriteriaPolicyGuard {
  private readonly reflector: Reflector;

  constructor(reflector: Reflector) {
    this.reflector = reflector;
  }

  canActivate(context: import("@nestjs/common").ExecutionContext): boolean {
    const action = this.reflector.get<AnalysisCriteriaPolicyAction | undefined>(
      ANALYSIS_CRITERIA_POLICY_ACTION,
      context.getHandler(),
    );
    if (action === undefined) throw forbidden();
    const principal = context.switchToHttp().getRequest<GuardRequest>().principal;
    if (principal === undefined) throw new AppError("UNAUTHENTICATED", "errors.auth.required", 401);
    if (!principal.active) throw forbidden();

    const manager = principal.roles.includes("manager");
    if (action === "document.readiness.detail.read" && manager) throw forbidden();
    if (action === "document.readiness.summary.read" && !manager) throw forbidden();
    return true;
  }
}

export function AnalysisCriteriaPolicy(action: AnalysisCriteriaPolicyAction): MethodDecorator {
  return SetMetadata(ANALYSIS_CRITERIA_POLICY_ACTION, action);
}

function forbidden(): AppError {
  return new AppError("FORBIDDEN", "errors.authorization.forbidden", 403);
}

Injectable()(AnalysisCriteriaPolicyGuard);
