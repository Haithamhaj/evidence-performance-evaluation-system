import { AppError } from "@evaluation/contracts";

export class CoachingDevelopmentReportReader {
  constructor(private readonly readPlan: (planId: string) => Promise<Record<string, unknown> | null>) {}
  async read(input: Readonly<{ planId: string; actorId: string }>) {
    const plan = await this.readPlan(input.planId);
    if (!plan) throw new AppError("FORMAL_PLAN_NOT_FOUND", "errors.coaching.invalid", 404);
    if (plan.employeeId !== input.actorId && plan.managerId !== input.actorId) throw new AppError("AUTHZ_SCOPE", "errors.coaching.invalid", 403);
    const { privateReason: _privateReason, personalNote: _personalNote, ...projection } = plan;
    return projection;
  }
}
