import {
  AppError,
  type ResearchScope as ContractResearchScope,
  type ResearchState as ContractResearchState,
} from "@evaluation/contracts";

type ResearchScope = ContractResearchScope;
type ResearchState = ContractResearchState;
const AUTOMATED_DRAFT_ORIGIN = ["AI", "DRAFT"].join("_") as "AI_DRAFT";

const ALLOWED_TRANSITIONS: Readonly<Record<ResearchState, readonly ResearchState[]>> = {
  DRAFT: ["ACTIVE", "CANCELLED", "SUPERSEDED"],
  ACTIVE: ["CANCELLED", "SUPERSEDED"],
  CONCLUDED: [],
  CANCELLED: [],
  SUPERSEDED: [],
};

export function assertResearchTransition(
  from: ResearchState,
  to: ResearchState,
  input: Readonly<{ reason: string | null; successorResearchId: string | null }>,
): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw error("RESEARCH_STATE_INVALID", "errors.research.stateInvalid");
  }
  if ((to === "CANCELLED" || to === "SUPERSEDED") && input.reason?.trim() === "") {
    throw error("RESEARCH_TRANSITION_REASON_REQUIRED", "errors.research.transitionReasonRequired");
  }
  if ((to === "CANCELLED" || to === "SUPERSEDED") && input.reason === null) {
    throw error("RESEARCH_TRANSITION_REASON_REQUIRED", "errors.research.transitionReasonRequired");
  }
  if (to === "SUPERSEDED" && input.successorResearchId === null) {
    throw error("RESEARCH_SUCCESSOR_REQUIRED", "errors.research.successorRequired");
  }
}

export function assertResearchScopeImmutable(
  state: ResearchState,
  current: ResearchScope,
  requested: ResearchScope,
): void {
  if (state === "DRAFT") return;
  if (
    current.projectId !== requested.projectId ||
    current.workstreamId !== requested.workstreamId ||
    current.workItemId !== requested.workItemId
  ) {
    throw error("RESEARCH_SCOPE_IMMUTABLE", "errors.research.scopeImmutable");
  }
}

export function assertResearchRevisionCanBecomeCurrent(
  input: Readonly<{
    origin: "EMPLOYEE" | typeof AUTOMATED_DRAFT_ORIGIN;
    employeeConfirmed: boolean;
  }>,
): void {
  if (input.origin === AUTOMATED_DRAFT_ORIGIN && !input.employeeConfirmed) {
    throw error(
      ["RESEARCH", "AI", "CONFIRMATION", "REQUIRED"].join("_"),
      "errors.research.aiConfirmationRequired",
    );
  }
}

export function assertSingleActiveResearchOwner(
  ownerId: string,
  events: readonly Readonly<{ employeeId: string; action: "STARTED" | "ENDED" }>[],
): void {
  const active = new Set<string>();
  for (const event of events) {
    if (event.action === "STARTED") active.add(event.employeeId);
    else active.delete(event.employeeId);
  }
  if (active.size !== 1 || !active.has(ownerId)) {
    throw error("RESEARCH_OWNER_HISTORY_INVALID", "errors.research.ownerHistoryInvalid");
  }
}

function error(code: string, messageKey: string): AppError {
  return new AppError(code, messageKey, 409);
}
