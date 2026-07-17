import { AppError } from "@evaluation/contracts";

import type * as CriteriaModel from "./model.js";

function criteriaError(code: string): AppError {
  return new AppError(code, `errors.criteria.${code.toLowerCase()}`, 422);
}

export function assertCriterionCount(kind: CriteriaModel.CriteriaKind, count: number): void {
  const valid = Number.isInteger(count) && (kind === "project" ? count >= 1 : count >= 2);
  if (!valid || count > 3) throw criteriaError("CRITERIA_COUNT_INVALID");
}

export function assertCollectionComplete(
  eligibility: readonly Readonly<{ employeeId: string; responseRequired: boolean }>[],
  responses: readonly Readonly<{
    employeeId: string;
    response: CriteriaModel.ContributorResponse;
  }>[],
): Readonly<{ complete: boolean; objectionCount: number }> {
  const required = new Set<string>();
  for (const entry of eligibility) {
    if (entry.responseRequired) required.add(entry.employeeId);
  }
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
  resolution: Readonly<{ decision: CriteriaModel.ManagerResolution; reason: string }>,
): Readonly<{ decision: CriteriaModel.ManagerResolution; reason: string }> {
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
  fromState: CriteriaModel.CriteriaProposalState,
  toState: CriteriaModel.CriteriaProposalState,
): void {
  const allowed =
    fromState === "owner_review"
      ? ["contributor_review", "approved", "rejected", "superseded"]
      : fromState === "contributor_review"
        ? ["approved", "manager_resolution", "superseded"]
        : fromState === "manager_resolution"
          ? ["approved", "superseded"]
          : fromState === "approved"
            ? ["activated", "superseded"]
            : [];
  if (!(allowed as readonly CriteriaModel.CriteriaProposalState[]).includes(toState)) {
    throw criteriaError("CRITERIA_TRANSITION_INVALID");
  }
}
