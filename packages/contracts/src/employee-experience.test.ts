import { describe, expect, it } from "vitest";

import {
  CaptureUnderstandingV1Schema,
  EmployeeHomeV1Schema,
  EmployeeProjectExperienceV1Schema,
  ReviewConfirmationDraftV1Schema,
  ReviewConfirmationResultV1Schema,
} from "./employee-experience.js";

const projectId = "10000000-0000-4000-8000-000000000001";
const workItemId = "10000000-0000-4000-8000-000000000002";
const componentId = "10000000-0000-4000-8000-000000000003";
const source = {
  kind: "progress_contract" as const,
  label: "Approved Project contract",
  observedAt: "2026-08-13T07:00:00.000Z",
  freshness: "fresh" as const,
};

const progress = {
  state: "accepted" as const,
  percent: 62,
  source,
  explanation: "Confirmed by the active measurable rule.",
};

const milestones = [
  {
    componentId,
    name: "API authentication",
    kind: "milestone" as const,
    state: "current" as const,
    percent: 50,
  },
];

const smartBrief = {
  title: "Review one decision",
  body: "The API authentication decision is the smallest next action.",
  source,
  why: "It blocks the next milestone.",
  consequence: "Reviewing opens the existing protected decision flow.",
  action: { label: "Review decision", href: `/en/projects/${projectId}` },
};

const home = {
  schemaVersion: "employee-home.v1" as const,
  generatedAt: "2026-08-13T07:05:00.000Z",
  greetingName: "Codex",
  signals: { decisions: 1, dueToday: 2, verifiedChanges: 1 },
  projects: [
    {
      id: projectId,
      name: "Atlas Delivery",
      description: "Deliver secure API access.",
      status: "active" as const,
      progress,
      milestones,
      kpi: {
        componentId,
        name: "API error rate",
        baseline: 4.1,
        current: 1.8,
        target: 1,
        unit: "%",
        direction: "decrease" as const,
        source,
      },
      nextAction: { label: "Owner confirmation needed", href: `/en/projects/${projectId}` },
    },
  ],
  smartBrief,
  now: [
    {
      id: "decision:184",
      kind: "decision" as const,
      occurredAt: "2026-08-13T07:00:00.000Z",
      title: "Link PR #184 to API authentication?",
      projectId,
      projectName: "Atlas Delivery",
      statusLabel: "Needs your decision",
      href: `/en/projects/${projectId}`,
      source,
    },
  ],
};

describe("final employee experience contracts", () => {
  it("accepts source-backed operational Home progress and rejects employee scoring fields", () => {
    expect(EmployeeHomeV1Schema.parse(home)).toEqual(home);
    expect(() =>
      EmployeeHomeV1Schema.parse({
        ...home,
        projects: [{ ...home.projects[0], employeeScore: 91 }],
      }),
    ).toThrow();
  });

  it("preserves honest missing Project progress instead of requiring an invented percentage", () => {
    const project = {
      schemaVersion: "employee-project-experience.v1" as const,
      generatedAt: "2026-08-13T07:05:00.000Z",
      access: "current" as const,
      ownership: {
        access: "current" as const,
        viewerRole: "owner" as const,
        currentOwner: {
          id: projectId,
          displayName: "Codex",
          responsibilityType: "original" as const,
          startsAt: "2026-08-01T09:00:00.000Z",
          endsAt: null,
        },
        viewerWindow: { startsAt: "2026-08-01T09:00:00.000Z", endsAt: null },
        plannedReturnOwnerName: null,
        contributors: [],
        transfer: { allowed: false as const, expectedVersion: 1, candidates: [] },
      },
      project: {
        id: projectId,
        name: "Atlas Delivery",
        description: "Deliver secure API access.",
        status: "active" as const,
        ownerName: "Codex",
        workstreams: [],
      },
      document: null,
      progress: { state: "awaiting_information" as const, missing: ["API error source"] },
      milestones,
      kpi: null,
      attention: [],
      collections: { work: [], updates: [], evidence: [], documents: [] },
      timeline: [],
      nextCursor: null,
      agentSignals: [
        {
          id: "project-signal:evidence-gap",
          kind: "evidence_gap" as const,
          severity: "attention" as const,
          title: "Evidence needed for API authentication",
          detail: "Owner confirmation",
          source,
          action: { label: "Review missing evidence", href: `/en/projects/${projectId}` },
        },
      ],
      preparedActions: [
        {
          id: "project-preparation:milestone-context",
          kind: "next_milestone_context" as const,
          title: "Prepare the next milestone context",
          detail: "Review what is still needed before API authentication can move forward.",
          source,
          action: { label: "Review context", href: `/en/projects/${projectId}` },
          requiresConfirmation: true as const,
        },
      ],
      smartBrief,
    };

    const parsed = EmployeeProjectExperienceV1Schema.parse(project);
    expect(parsed).toEqual(project);
    if (parsed.access === "current") expect("percent" in parsed.progress).toBe(false);
    expect(() =>
      EmployeeProjectExperienceV1Schema.parse({
        ...project,
        preparedActions: [{ ...project.preparedActions[0], requiresConfirmation: false }],
      }),
    ).toThrow();
  });

  it("keeps capture interpretation private and non-commanding", () => {
    const value = {
      schemaVersion: "capture-understanding.v1" as const,
      likelyProject: { id: projectId, name: "Atlas Delivery", confidence: "high" as const },
      likelyMeaning: "project_update" as const,
      relatedWorkItemId: workItemId,
      relatedWorkItemTitle: "Validate streaming fallback",
      relatedComponentId: componentId,
      sourceRefs: [source],
      clarification: {
        question: "What API error rate did you observe?",
        missingField: "measured_result",
      },
      confidence: "high" as const,
      createsOfficialRecord: false as const,
    };

    expect(CaptureUnderstandingV1Schema.parse(value)).toEqual(value);
    expect(() =>
      CaptureUnderstandingV1Schema.parse({ ...value, createsOfficialRecord: true }),
    ).toThrow();
  });

  it("requires separate editable Update, selectable Evidence, and non-mutating progress proposal", () => {
    const value = {
      schemaVersion: "review-confirmation-draft.v1" as const,
      captureId: "10000000-0000-4000-8000-000000000004",
      project: { id: projectId, name: "Atlas Delivery" },
      workItem: { id: workItemId, title: "Validate streaming fallback" },
      update: {
        sessionId: "10000000-0000-4000-8000-000000000005",
        expectedVersion: 1,
        editable: true as const,
        selected: true,
        summary: "Streaming fallback works in staging.",
        result: "The fallback path completed successfully.",
        nextAction: "Confirm the API error source.",
        sourceRefs: [source],
      },
      evidence: [
        {
          draftId: "10000000-0000-4000-8000-000000000006",
          expectedRevision: 2,
          selected: true,
          employeeEditRequired: true,
          employeeEdited: true,
          supportedClaim: "The fallback completed in staging.",
          contributionContext: "Codex implemented and validated the fallback.",
          sourceRefs: [source],
        },
      ],
      progressProposal: {
        componentId,
        selected: false,
        proposedValue: "1.8%",
        rationale: "Needs the contract owner to verify the measurement source.",
        mutatesOfficialProgress: false as const,
        requiresOwnerConfirmation: true,
        sourceRefs: [source],
      },
      uncertainty: "The measurement source is still missing.",
      afterConfirmation: [
        "The Update will be appended to the Project Timeline.",
        "Selected Evidence will remain separately reviewable.",
      ],
    };

    expect(ReviewConfirmationDraftV1Schema.parse(value)).toEqual(value);
    expect(() =>
      ReviewConfirmationDraftV1Schema.parse({
        ...value,
        progressProposal: { ...value.progressProposal, mutatesOfficialProgress: true },
      }),
    ).toThrow();
  });

  it("rejects rating, ranking, productivity-score, and activity-volume progress semantics", () => {
    for (const prohibited of [
      "Recommended performance rating: 5",
      "Employee rank: first",
      "Productivity score: 94",
      "Project progress is 80% because 8 tasks were completed",
      "التقييم المقترح للموظف ٥",
    ]) {
      expect(() =>
        ReviewConfirmationDraftV1Schema.parse({
          schemaVersion: "review-confirmation-draft.v1",
          captureId: "10000000-0000-4000-8000-000000000004",
          project: { id: projectId, name: "Atlas Delivery" },
          workItem: null,
          update: null,
          evidence: [],
          progressProposal: null,
          uncertainty: prohibited,
          afterConfirmation: ["No official action without confirmation."],
        }),
      ).toThrow();
    }
  });

  it("records each confirmed domain action independently for truthful partial recovery", () => {
    const value = {
      schemaVersion: "review-confirmation-result.v1" as const,
      completedAt: "2026-08-13T07:10:00.000Z",
      outcomes: [
        {
          kind: "update" as const,
          state: "confirmed" as const,
          receiptId: "10000000-0000-4000-8000-000000000007",
          safeMessage: "Update confirmed.",
        },
        {
          kind: "evidence" as const,
          state: "retryable_error" as const,
          receiptId: null,
          safeMessage: "Evidence was not confirmed; your edits remain available.",
        },
      ],
    };

    expect(ReviewConfirmationResultV1Schema.parse(value)).toEqual(value);
  });
});
