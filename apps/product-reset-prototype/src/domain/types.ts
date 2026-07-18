export type Locale = "ar" | "en";
export type Persona = "employee" | "manager";
export type Health = "on_track" | "needs_attention" | "at_risk" | "paused" | "completed";
export type WorkItemStatus =
  | "planned"
  | "ready"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "done"
  | "cancelled";
export type Priority = "urgent" | "high" | "medium" | "low";
export type ExecutionMode = "manual" | "ai_assisted" | "agent_generated" | "mixed";

export type LocalizedText = {
  readonly ar: string;
  readonly en: string;
};

export type Project = {
  readonly id: string;
  readonly name: LocalizedText;
  readonly purpose: LocalizedText;
  readonly employeeRole: LocalizedText;
  readonly health: Health;
  readonly owner: string;
  readonly targetDate: string;
  readonly latestUpdate: LocalizedText;
  readonly nextAction: LocalizedText;
  readonly blocker: LocalizedText | null;
  readonly milestones: readonly LocalizedText[];
  readonly kpis: readonly { readonly label: LocalizedText; readonly value: string }[];
};

export type Workstream = {
  readonly id: string;
  readonly projectId: string;
  readonly name: LocalizedText;
  readonly purpose: LocalizedText;
  readonly owner: string;
  readonly contributors: readonly string[];
  readonly health: Health;
  readonly targetOutput: LocalizedText;
  readonly kpis: readonly { readonly label: LocalizedText; readonly value: string }[];
  readonly criteria: readonly LocalizedText[];
  readonly responsibilityHistory: readonly {
    readonly person: string;
    readonly role: LocalizedText;
    readonly startsAt: string;
    readonly endsAt: string | null;
  }[];
};

export type WorkItem = {
  readonly id: string;
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  readonly projectId: string;
  readonly workstreamId: string | null;
  readonly employeeRole: LocalizedText;
  readonly primaryAssignee: string;
  readonly participants: readonly string[];
  readonly type: "task" | "decision" | "review" | "research";
  readonly status: WorkItemStatus;
  readonly priority: Priority;
  readonly startDate: string;
  readonly dueDate: string | null;
  readonly requirements: readonly LocalizedText[];
  readonly acceptanceCriteria: readonly LocalizedText[];
  readonly dependencies: readonly string[];
  readonly blockerReason: LocalizedText | null;
  readonly nextAction: LocalizedText;
  readonly criterionIds: readonly string[];
  readonly updateIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly githubLinks: readonly string[];
  readonly contributionContext: LocalizedText;
  readonly history: readonly {
    readonly label: LocalizedText;
    readonly at: string;
    readonly actor: string;
  }[];
};

export type InboxItem = {
  readonly id: string;
  readonly kind:
    | "manager_clarification"
    | "mention"
    | "criteria_acknowledgment"
    | "github_suggestion"
    | "attribution_request"
    | "weekly_reminder"
    | "evaluation_action";
  readonly title: LocalizedText;
  readonly detail: LocalizedText;
  readonly actionable: boolean;
  readonly workItemId: string | null;
  readonly occurredAt: string;
};

export type ActivityEvent = {
  readonly id: string;
  readonly kind:
    | "original_input"
    | "structured_summary"
    | "verified_fact"
    | "employee_interpretation"
    | "suggested_evidence"
    | "confirmed_evidence"
    | "decision"
    | "blocker"
    | "responsibility_change";
  readonly title: LocalizedText;
  readonly detail: LocalizedText;
  readonly occurredAt: string;
  readonly actor: string;
  readonly projectId: string;
  readonly workstreamId: string | null;
  readonly workItemId: string | null;
};

export type EvidenceSuggestion = {
  readonly id: string;
  readonly sourceKind:
    | "pull_request"
    | "commit"
    | "ci_result"
    | "test_result"
    | "file"
    | "link"
    | "screenshot"
    | "architecture_diagram";
  readonly title: LocalizedText;
  readonly sourceLabel: string;
  readonly projectId: string;
  readonly workstreamId: string | null;
  readonly workItemId: string | null;
  readonly state: "suggested" | "confirmed" | "rejected" | "ignored";
  readonly executionMode: ExecutionMode | null;
  readonly context: LocalizedText | null;
};

export type ReadinessFact = {
  readonly id: string;
  readonly period: LocalizedText;
  readonly projectId: string;
  readonly workstreamId: string | null;
  readonly responsibilityWindow: LocalizedText;
  readonly employeeClaim: LocalizedText;
  readonly supportedFacts: readonly LocalizedText[];
  readonly unclearParts: readonly LocalizedText[];
  readonly result: LocalizedText;
  readonly evidenceIds: readonly string[];
  readonly verificationState: "source_supported" | "partially_verified" | "self_reported";
  readonly attributionState: "peer_acknowledged" | "self_reported" | "disputed";
  readonly criterionIds: readonly string[];
};

export type StructuredUpdateDraft = {
  readonly originalInput: string;
  readonly activity: string;
  readonly result: string;
  readonly personalContribution: string;
  readonly teamContribution: string;
  readonly participants: readonly string[];
  readonly impact: string;
  readonly blocker: string;
  readonly decision: string;
  readonly learning: string;
  readonly nextStep: string;
  readonly relatedWorkItemId: string | null;
  readonly relatedCriteria: readonly string[];
  readonly suggestedEvidenceIds: readonly string[];
  readonly missingContext: readonly string[];
  readonly clarificationQuestion: string | null;
};
