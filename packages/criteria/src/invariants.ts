import { AppError } from "@evaluation/contracts";

const proposalTransitions: Readonly<
  Record<
    import("./model.js").CriteriaProposalState,
    ReadonlySet<import("./model.js").CriteriaProposalState>
  >
> = {
  owner_review: new Set(["contributor_review", "approved", "rejected", "superseded"]),
  contributor_review: new Set(["approved", "manager_resolution", "superseded"]),
  manager_resolution: new Set(["approved", "superseded"]),
  approved: new Set(["activated", "superseded"]),
  rejected: new Set(),
  superseded: new Set(),
  activated: new Set(),
};

function criteriaError(code: string): AppError {
  return new AppError(code, `errors.criteria.${code.toLowerCase()}`, 422);
}

export function assertCriterionCount(kind: import("./model.js").CriteriaKind, count: number): void {
  const valid = Number.isInteger(count) && (kind === "project" ? count >= 1 : count >= 2);
  if (!valid || count > 3) throw criteriaError("CRITERIA_COUNT_INVALID");
}

export function assertCollectionComplete(
  eligibility: readonly Readonly<{ employeeId: string; responseRequired: boolean }>[],
  responses: readonly Readonly<{
    employeeId: string;
    response: import("./model.js").ContributorResponse;
  }>[],
): Readonly<{ complete: boolean; objectionCount: number }> {
  const required = new Set(
    eligibility
      .filter(({ responseRequired }) => responseRequired)
      .map(({ employeeId }) => employeeId),
  );
  const seen = new Set<string>();
  let objectionCount = 0;
  for (const response of responses) {
    if (!required.has(response.employeeId) || seen.has(response.employeeId)) {
      throw criteriaError("CRITERIA_RESPONSE_INVALID");
    }
    seen.add(response.employeeId);
    if (response.response === "object") objectionCount += 1;
  }
  return { complete: seen.size === required.size, objectionCount };
}

export function assertManagerResolution(
  objectionCount: number,
  resolution: Readonly<{ decision: import("./model.js").ManagerResolution; reason: string }>,
): Readonly<{ decision: import("./model.js").ManagerResolution; reason: string }> {
  if (!Number.isInteger(objectionCount) || objectionCount < 1 || resolution.reason.trim() === "") {
    throw criteriaError("CRITERIA_RESOLUTION_INVALID");
  }
  return resolution;
}

export function assertProspectiveEffectiveFrom(
  effectiveFrom: Date,
  approvedAt: Date,
  now: Date,
): void {
  if (
    !Number.isFinite(effectiveFrom.getTime()) ||
    !Number.isFinite(approvedAt.getTime()) ||
    !Number.isFinite(now.getTime()) ||
    effectiveFrom < approvedAt ||
    effectiveFrom < now
  ) {
    throw criteriaError("CRITERIA_EFFECTIVE_FROM_INVALID");
  }
}

export function assertProposalTransition(
  fromState: import("./model.js").CriteriaProposalState,
  toState: import("./model.js").CriteriaProposalState,
): void {
  if (!proposalTransitions[fromState].has(toState)) {
    throw criteriaError("CRITERIA_TRANSITION_INVALID");
  }
}
