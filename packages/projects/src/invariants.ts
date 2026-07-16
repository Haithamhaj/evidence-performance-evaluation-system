import { AppError } from "@evaluation/contracts";
import type { ProjectStatus, ResponsibilityType } from "@evaluation/contracts";

export const ownerResponsibilityTypes = [
  "original",
  "acting",
  "permanent",
] as const satisfies ReadonlyArray<ResponsibilityType>;

const allowedLifecycleTransitions = Object.freeze({
  draft: ["active", "archived"],
  active: ["paused", "completed", "archived"],
  paused: ["active", "completed", "archived"],
  completed: ["archived"],
  archived: [],
} as const satisfies Readonly<Record<ProjectStatus, ReadonlyArray<ProjectStatus>>>);

type ResponsibilityWindowInput = Readonly<{
  responsibilityType: ResponsibilityType;
  startsAt: string;
  endsAt: string | null;
  reason: string;
  managerDecisionById: string | null;
  managerDecisionAt: string | null;
  managerDecisionReason: string | null;
  delegationType: string | null;
}>;

type TimeWindow = Readonly<{ startsAt: string; endsAt: string | null }>;

function fail(code: string): never {
  throw new AppError(code, `errors.projects.${code.toLowerCase()}`, 422);
}

function nonBlank(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}

function isOwnerType(type: ResponsibilityType): boolean {
  return ownerResponsibilityTypes.includes(type as (typeof ownerResponsibilityTypes)[number]);
}

export function assertLifecycleTransition(
  from: ProjectStatus,
  to: ProjectStatus,
  hasPrimaryOwner: boolean,
): void {
  if (to === "active" && !hasPrimaryOwner) fail("PRIMARY_OWNER_REQUIRED");
  if (!(allowedLifecycleTransitions[from] as ReadonlyArray<ProjectStatus>).includes(to)) {
    fail("LIFECYCLE_TRANSITION_INVALID");
  }
}

export function containsInstant(window: TimeWindow, instant: string): boolean {
  const startsAt = Date.parse(window.startsAt);
  const at = Date.parse(instant);
  const endsAt = window.endsAt === null ? Number.POSITIVE_INFINITY : Date.parse(window.endsAt);
  return (
    Number.isFinite(startsAt) &&
    Number.isFinite(at) &&
    (window.endsAt === null || Number.isFinite(endsAt)) &&
    startsAt <= at &&
    at < endsAt
  );
}

export function assertResponsibilityWindow(window: ResponsibilityWindowInput): void {
  const startsAt = Date.parse(window.startsAt);
  const endsAt = window.endsAt === null ? null : Date.parse(window.endsAt);
  if (
    !Number.isFinite(startsAt) ||
    (endsAt !== null && (!Number.isFinite(endsAt) || startsAt >= endsAt)) ||
    window.reason.trim().length === 0
  ) {
    fail("RESPONSIBILITY_WINDOW_INVALID");
  }

  const managerDecisionComplete =
    nonBlank(window.managerDecisionById) &&
    nonBlank(window.managerDecisionAt) &&
    nonBlank(window.managerDecisionReason);
  if (isOwnerType(window.responsibilityType) && !managerDecisionComplete) {
    fail("MANAGER_DECISION_REQUIRED");
  }

  if (window.responsibilityType === "acting") {
    if (window.endsAt === null) fail("ACTING_WINDOW_END_REQUIRED");
    if (!nonBlank(window.delegationType)) fail("ACTING_DELEGATION_REQUIRED");
    return;
  }

  if (window.delegationType !== null) fail("DELEGATION_NOT_ALLOWED");
}
