/* global structuredClone */

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import process from "node:process";
import { URL } from "node:url";

const projectId = "11111111-1111-4111-8111-111111111111";
const workstreamId = "22222222-2222-4222-8222-222222222222";
const historicalWorkstreamId = "12121212-1212-4212-8212-121212121212";
const departmentId = "33333333-3333-4333-8333-333333333333";
const ownerId = "44444444-4444-4444-8444-444444444444";
const contributorId = "55555555-5555-4555-8555-555555555555";
const projectDocumentId = "66666666-6666-4666-8666-666666666666";
const workstreamDocumentId = "77777777-7777-4777-8777-777777777777";
const projectDocumentVersionId = "88888888-8888-4888-8888-888888888888";
const workstreamDocumentVersionId = "99999999-9999-4999-8999-999999999999";
const templateVersionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const proposalId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sourceHash = "a".repeat(64);
const progressContractId = "e1111111-1111-4111-8111-111111111111";
const progressSnapshotId = "e2222222-2222-4222-8222-222222222222";
const dogfoodProjectId = "d1111111-1111-4111-8111-111111111111";
const contextProjectId = "c1111111-1111-4111-8111-111111111111";
const dogfoodDocumentVersionId = "d2222222-2222-4222-8222-222222222222";
const dogfoodDraftRequestId = "d3333333-3333-4333-8333-333333333333";
const dogfoodContractId = "d4444444-4444-4444-8444-444444444444";
const updateSessionId = "e5555555-5555-4555-8555-555555555555";
const updateSourceId = "e6666666-6666-4666-8666-666666666666";
const firstTurnId = "e7777777-7777-4777-8777-777777777777";
const secondTurnId = "e8888888-8888-4888-8888-888888888888";
const draftRevisionId = "e9999999-9999-4999-8999-999999999999";
const evidenceId = "ea111111-1111-4111-8111-111111111111";
const evidenceRevisionId = "ea222222-2222-4222-8222-222222222222";
const uploadedSourceId = "ea333333-3333-4333-8333-333333333333";
const acceptedUpdateId = "ea444444-4444-4444-8444-444444444444";
const acceptedEvidenceId = "ea555555-5555-4555-8555-555555555555";
const voiceSessionId = "ea666666-6666-4666-8666-666666666666";
const connectedGmailItemId = "ca111111-1111-4111-8111-111111111111";
const connectedCalendarItemId = "ca222222-2222-4222-8222-222222222222";
const contextHighConfidenceItemId = "ca333333-3333-4333-8333-333333333333";
const contextUncertainItemId = "ca444444-4444-4444-8444-444444444444";
const contextRejectedItemId = "ca555555-5555-4555-8555-555555555555";
const contextTaskItemId = "ca666666-6666-4666-8666-666666666666";
const highConfidenceSuggestionId = "cb111111-1111-4111-8111-111111111111";
const uncertainSuggestionId = "cb222222-2222-4222-8222-222222222222";
const rejectedSuggestionId = "cb333333-3333-4333-8333-333333333333";
const contextTaskDraftId = "cb444444-4444-4444-8444-444444444444";
const evaluationCycleId = "ec111111-1111-4111-8111-111111111111";
const managerEvaluationCycleId = "ed111111-1111-4111-8111-111111111111";
const evaluationAssignmentId = "ec777777-7777-4777-8777-777777777777";
const evaluationManagerId = "ec888888-8888-4888-8888-888888888888";
const evaluationSnapshotId = "ec999999-9999-4999-8999-999999999999";
const evaluationRubricVersionId = "ec222222-2222-4222-8222-222222222222";
const responsibilityFactId = "ec333333-3333-4333-8333-333333333333";
const contributionFactId = "ec444444-4444-4444-8444-444444444444";
const criterionFactId = "ec555555-5555-4555-8555-555555555555";
const interpretationId = "ec666666-6666-4666-8666-666666666666";
const ownerAccessToken = "e2e-access-token";
const managerAccessToken = "e2e-manager-access-token";
const otherEmployeeAccessToken = "e2e-other-employee-access-token";
const unrelatedManagerAccessToken = "e2e-unrelated-manager-access-token";
const systemAdministratorAccessToken = "e2e-system-administrator-access-token";
const researchId = "f3111111-1111-4111-8111-111111111111";
const unsupportedExperimentId = "f3222222-2222-4222-8222-222222222222";
const supportedExperimentId = "f3333333-3333-4333-8333-333333333333";
const researchReviewId = "f3444444-4444-4444-8444-444444444444";
const researchProposalId = "f3555555-5555-4555-8555-555555555555";
const experimentProposalId = "f3666666-6666-4666-8666-666666666666";
const workItemProposalId = "f3777777-7777-4777-8777-777777777777";
const connectedWorkAccessTokens = new Set([
  ownerAccessToken,
  managerAccessToken,
  otherEmployeeAccessToken,
  unrelatedManagerAccessToken,
  systemAdministratorAccessToken,
]);
const connectedWorkState = "synthetic-connected-work-state";
const connectedWorkNonce = "synthetic-connected-work-nonce";
let clarificationTurn = 0;
let updateDraftRevision = 1;
let evidenceRevision = 1;
let voiceRevision = 1;
let voiceTranscript = "The automated GitHub checks passed and the closure evidence is attached.";
let voiceTranscriptConfirmed = false;
let latestEvidenceInput = {};
let capturedUpdateSourceKinds = [];
let officialProjectProgressPercent = 62.5;
let ambiguousProgressReviewQueued = false;
let employeePerformanceWrites = [];
let updateLocale = "ar";
let connectedWorkConnected = true;
let contextAiAvailable = true;
let researchAiAvailable = true;
let researchConfirmed = false;
let currentUpdateContext = {
  projectId,
  workstreamId: null,
  workItemId: null,
};
let dogfoodDraftRevision = 1;
let dogfoodContractState = null;
let dogfoodContractVersion = 0;
const timelineItems = [];
const connectedWorkItems = [
  {
    id: connectedGmailItemId,
    provider: "GOOGLE_GMAIL",
    occurredAt: "2026-07-20T08:30:00.000Z",
    title: "[Synthetic] Project decision",
    summary: "A deterministic local summary for owner-only review.",
    sourceUrl: "https://mail.google.com/mail/u/0/#inbox/synthetic-gmail-project-decision",
    privacy: "PRIVATE",
    excluded: false,
    projectId: null,
    sourceExclusion: {
      provider: "GOOGLE_GMAIL",
      kind: "GMAIL_LABEL",
      providerExclusionId: "synthetic-project-context",
      excluded: false,
    },
  },
  {
    id: connectedCalendarItemId,
    provider: "GOOGLE_CALENDAR",
    occurredAt: "2026-07-20T10:00:00.000Z",
    title: "[Synthetic] Project review",
    summary: "A deterministic local calendar summary for owner-only review.",
    sourceUrl: "https://calendar.google.com/calendar/event?eid=synthetic-calendar-project-review",
    privacy: "PRIVATE",
    excluded: false,
    projectId: null,
    sourceExclusion: {
      provider: "GOOGLE_CALENDAR",
      kind: "CALENDAR",
      providerExclusionId: "synthetic-work-calendar",
      excluded: false,
    },
  },
  {
    id: contextHighConfidenceItemId,
    provider: "GOOGLE_GMAIL",
    occurredAt: "2026-07-20T11:00:00.000Z",
    title: "[Synthetic AI] Release decision",
    summary: "The Atlas delivery owner and approved Project term identify one Project.",
    sourceUrl: "https://mail.google.com/mail/u/0/#inbox/synthetic-ai-release-decision",
    privacy: "PRIVATE",
    excluded: false,
    projectId: null,
    sourceExclusion: {
      provider: "GOOGLE_GMAIL",
      kind: "GMAIL_LABEL",
      providerExclusionId: "synthetic-ai-context",
      excluded: false,
    },
  },
  {
    id: contextUncertainItemId,
    provider: "GOOGLE_CALENDAR",
    occurredAt: "2026-07-20T11:30:00.000Z",
    title: "[Synthetic AI] Follow-up with two possible Projects",
    summary: "One approved Project term appears, but the context is not independently anchored.",
    sourceUrl: "https://calendar.google.com/calendar/event?eid=synthetic-ai-uncertain",
    privacy: "PRIVATE",
    excluded: false,
    projectId: null,
    sourceExclusion: {
      provider: "GOOGLE_CALENDAR",
      kind: "CALENDAR",
      providerExclusionId: "synthetic-ai-review-calendar",
      excluded: false,
    },
  },
  {
    id: contextRejectedItemId,
    provider: "GOOGLE_GMAIL",
    occurredAt: "2026-07-20T12:00:00.000Z",
    title: "[Synthetic AI] Personal reminder",
    summary: "No governed Project anchor is present in this private reminder.",
    sourceUrl: "https://mail.google.com/mail/u/0/#inbox/synthetic-ai-personal-reminder",
    privacy: "PRIVATE",
    excluded: false,
    projectId: null,
    sourceExclusion: {
      provider: "GOOGLE_GMAIL",
      kind: "GMAIL_THREAD",
      providerExclusionId: "synthetic-ai-personal-reminder",
      excluded: false,
    },
  },
  {
    id: contextTaskItemId,
    provider: "GOOGLE_CALENDAR",
    occurredAt: "2026-07-20T12:30:00.000Z",
    title: "[Synthetic AI] Acceptance follow-up",
    summary: "The accepted release decision needs one documented follow-up.",
    sourceUrl: "https://calendar.google.com/calendar/event?eid=synthetic-ai-task-draft",
    privacy: "PRIVATE",
    excluded: false,
    projectId: null,
    sourceExclusion: {
      provider: "GOOGLE_CALENDAR",
      kind: "CALENDAR",
      providerExclusionId: "synthetic-ai-task-calendar",
      excluded: false,
    },
  },
];

const project = {
  id: projectId,
  departmentId,
  name: "منصة الأدلة",
  description: "مشروع تجريبي لإدارة الأدلة ومسارات العمل.",
  status: "active",
  version: 2,
  primaryOwnerId: ownerId,
};
const dogfoodProject = {
  id: dogfoodProjectId,
  departmentId,
  name: "Evidence Performance Evaluation System",
  description: "The real product Codex is building and using as an employee.",
  status: "active",
  version: 1,
  primaryOwnerId: ownerId,
};
const contextProject = {
  id: contextProjectId,
  departmentId,
  name: "Atlas Delivery",
  description: "Synthetic English Project for Context Intelligence acceptance.",
  status: "active",
  version: 1,
  primaryOwnerId: ownerId,
};
const workstream = {
  id: workstreamId,
  projectId,
  name: "مسار واجهة API",
  description: "المسار المسؤول عن الواجهة المشتركة.",
  status: "active",
  version: 2,
  primaryOwnerId: ownerId,
};
const people = [
  {
    person: { id: ownerId, displayName: "سارة أحمد" },
    responsibilityType: "original",
    startsAt: "2026-07-01T00:00:00.000Z",
    endsAt: null,
  },
  {
    person: { id: contributorId, displayName: "عمر API" },
    responsibilityType: "contributor",
    startsAt: "2026-07-02T00:00:00.000Z",
    endsAt: null,
  },
];

function document(kind) {
  const isProject = kind === "project";
  const id = isProject ? projectDocumentId : workstreamDocumentId;
  const resourceId = isProject ? projectId : workstreamId;
  const versionId = isProject ? projectDocumentVersionId : workstreamDocumentVersionId;
  return {
    id,
    kind,
    resourceId,
    templateVersionId,
    currentVersion: 1,
    createdAt: "2026-07-01T00:00:00.000Z",
    versions: [
      {
        id: versionId,
        documentId: id,
        version: 1,
        templateVersionId,
        createdById: ownerId,
        reason: "المصدر الأول",
        createdAt: "2026-07-02T00:00:00.000Z",
        sources: [
          {
            id: isProject
              ? "12121212-1212-4212-8212-121212121212"
              : "13131313-1313-4313-8313-131313131313",
            position: 1,
            sourceType: "upload",
            uploadedSource: {
              id: isProject
                ? "14141414-1414-4414-8414-141414141414"
                : "15151515-1515-4515-8515-151515151515",
              kind,
              resourceId,
              filename: isProject ? "project-brief.pdf" : "API-spec.pdf",
              detectedMime: "application/pdf",
              detectedType: "pdf",
              byteSize: 2048,
              sha256: sourceHash,
              createdAt: "2026-07-02T00:00:00.000Z",
            },
          },
        ],
      },
    ],
  };
}

function criterion(id, position, name) {
  return {
    id,
    position,
    name,
    selectionReason: "مرتبط بنطاق مسار العمل.",
    successLink: "يوضح اكتمال التسليم.",
    expectedBehaviorOrResult: "تتوفر واجهة موثقة وقابلة للاستخدام.",
    evaluationMethod: "مراجعة المستند والمصادر المرتبطة.",
    suggestedEvidence: ["مرجع المستند"],
    sourceReferences: [`section:${position}`],
  };
}

const projectCriteria = {
  proposal: null,
  activeSet: null,
  replacementRequest: null,
  allowedActions: ["generate"],
};
const workstreamCriteria = {
  proposal: {
    id: proposalId,
    kind: "workstream",
    state: "contributor_review",
    version: 3,
    sourceDocumentVersionId: workstreamDocumentVersionId,
    items: [
      criterion("cccccccc-cccc-4ccc-8ccc-cccccccccccc", 1, "تسليم واجهة API موثقة"),
      criterion("dddddddd-dddd-4ddd-8ddd-dddddddddddd", 2, "تأكيد قابلية التكامل"),
    ],
    requiredResponses: 2,
    completedResponses: 1,
    objectionCount: 1,
    viewerResponse: null,
    managerResolution: null,
  },
  activeSet: null,
  replacementRequest: null,
  allowedActions: ["respond"],
};
const historicalWorkstreamCriteria = {
  ...workstreamCriteria,
  proposal: { ...workstreamCriteria.proposal },
  allowedActions: [...workstreamCriteria.allowedActions],
};

function workItem(index, status, dueAt, nextAction, blocker = null) {
  return {
    id: `f${String(index).padStart(7, "0")}-1111-4111-8111-111111111111`,
    projectId,
    workstreamId: index % 2 === 0 ? workstreamId : null,
    title: `Delivery task ${index}`,
    description: `Reviewable operational delivery ${index}.`,
    status,
    priority: index < 4 ? "high" : "normal",
    assigneeId: ownerId,
    dueAt,
    requirements: ["Complete the agreed scope", "Document the result"],
    acceptanceConditions: ["Review and accept the result"],
    blocker,
    nextAction,
    version: 1,
    createdAt: "2026-07-17T08:00:00.000Z",
    updatedAt: "2026-07-18T08:00:00.000Z",
    checklist: [],
    collaboratorIds: [],
    allowedActions: ["edit", "transition", "assign", "add_update"],
    allowedTransitions: workItemTransitions(status),
  };
}

function workItemTransitions(status) {
  if (status === "planned") return ["ready", "cancelled"];
  if (status === "ready") return ["in_progress", "blocked", "cancelled"];
  if (status === "in_progress") return ["blocked", "in_review", "cancelled"];
  if (status === "blocked") return ["in_progress", "cancelled"];
  if (status === "in_review") return ["in_progress", "done", "cancelled"];
  return [];
}

const workItems = Array.from({ length: 20 }, (_, offset) => {
  const index = offset + 1;
  if (index <= 3)
    return workItem(
      index,
      index === 3 ? "in_review" : "ready",
      "2026-07-18T18:00:00.000Z",
      "Review and confirm the result",
    );
  if (index <= 6)
    return workItem(
      index,
      "in_progress",
      "2026-07-18T20:00:00.000Z",
      "Complete today's verification",
    );
  if (index <= 9) {
    return workItem(index, "in_progress", "2026-07-17T16:00:00.000Z", "Update the closure plan");
  }
  if (index <= 12)
    return workItem(
      index,
      "blocked",
      null,
      "Request the owner's decision",
      "Scope decision pending",
    );
  return workItem(index, "planned", "2026-07-24T12:00:00.000Z", "Prepare implementation");
});

const codexWorkItems = [
  {
    ...workItem(101, "in_review", "2026-08-13T14:00:00.000Z", "Review the real Work journey"),
    projectId: dogfoodProjectId,
    workstreamId: null,
    title: "Review Phase 2 Work query bundle",
    description: "Verify the real filtered Work list and keyboard journey before acceptance.",
    requirements: ["Use the real Project", "Keep progress separate from GitHub activity"],
    acceptanceConditions: ["Product Owner can review the runnable employee journey"],
    updatedAt: "2026-08-13T09:15:00.000Z",
  },
  {
    ...workItem(102, "ready", "2026-08-13T16:00:00.000Z", "Implement safe inline editing"),
    projectId: dogfoodProjectId,
    workstreamId: null,
    title: "Implement safe inline Task edits",
    description: "Make common Task changes fast while preserving authorized server commands.",
    requirements: ["Edit title, due date, priority, and assignee safely"],
    acceptanceConditions: ["Employee sees the saved authoritative state"],
    updatedAt: "2026-08-13T09:10:00.000Z",
  },
  {
    ...workItem(103, "planned", "2026-08-15T12:00:00.000Z", "Connect detail to activity"),
    projectId: dogfoodProjectId,
    workstreamId: null,
    title: "Connect Task detail to updates and evidence",
    description: "Show the Task, confirmed updates, and suggested evidence in one focused view.",
    requirements: ["Keep GitHub evidence suggested until employee confirmation"],
    acceptanceConditions: ["No activity count becomes Project progress"],
    updatedAt: "2026-08-13T08:55:00.000Z",
  },
  {
    ...workItem(104, "planned", "2026-08-16T12:00:00.000Z", "Compare the daily flow"),
    projectId: dogfoodProjectId,
    workstreamId: null,
    title: "Benchmark the Work flow against the ClickUp reference",
    description: "Compare interaction speed and clarity without copying branding or architecture.",
    requirements: ["Keep Command Brief simpler than a generic project-management tool"],
    acceptanceConditions: ["Record only actionable product differences"],
    updatedAt: "2026-08-13T08:45:00.000Z",
  },
];
workItems.push(...codexWorkItems);
timelineItems.push(...initialSliceFourTimeline());

const myWork = {
  groups: [
    { key: "needs_my_action", items: workItems.slice(0, 3), collapsedByDefault: false },
    { key: "today", items: workItems.slice(3, 6), collapsedByDefault: false },
    { key: "overdue", items: workItems.slice(6, 9), collapsedByDefault: false },
    { key: "waiting_blocked", items: workItems.slice(9, 12), collapsedByDefault: true },
    { key: "this_week", items: workItems.slice(12), collapsedByDefault: true },
  ],
  nextCursor: null,
};

const privateInboxItems = [
  {
    id: "fa111111-1111-4111-8111-111111111111",
    employeeId: ownerId,
    text: "Review the customer-journey notes",
    projectId: null,
    sourceType: "text",
    sourceUploadId: null,
    status: "open",
    promotedWorkItemId: null,
    version: 1,
    createdAt: "2026-07-20T07:30:00.000Z",
    updatedAt: "2026-07-20T07:30:00.000Z",
  },
];
const experienceReceipts = [];

const baseWorkItems = [...workItems];
const basePrivateInboxItems = structuredClone(privateInboxItems);
const baseConnectedWorkItems = structuredClone(connectedWorkItems);

function dailyWorkspace() {
  return {
    needsMyAction: [codexWorkItems[0], ...myWork.groups[0].items],
    today: [codexWorkItems[1], ...myWork.groups[1].items],
    overdue: myWork.groups[2].items,
    reviewQueue: [],
    inbox: privateInboxItems.filter(({ status }) => status === "open"),
    projectPulse: [
      {
        id: dogfoodProjectId,
        name: dogfoodProject.name,
        status: "active",
        progress: { state: "awaiting_contract" },
      },
      {
        id: projectId,
        name: "Atlas Delivery",
        status: "active",
        progress: {
          state: "accepted",
          percent: 62.5,
          updatedAt: "2026-07-18T12:00:00.000Z",
        },
      },
    ],
    upcoming: myWork.groups[4].items,
  };
}

function employeeHome() {
  const progressSource = {
    kind: "progress_contract",
    label: "Approved Project contract",
    observedAt: "2026-08-13T07:00:00.000Z",
    freshness: "fresh",
  };
  const workPlanSource = {
    kind: "work_item",
    label: "Approved Phase 2 Work plan",
    observedAt: "2026-08-13T09:15:00.000Z",
    freshness: "fresh",
  };
  const githubSource = {
    kind: "github",
    label: "GitHub suggested evidence",
    observedAt: "2026-08-13T09:15:00.000Z",
    freshness: "fresh",
  };
  const projects = [
    {
      id: dogfoodProjectId,
      name: "Evidence Performance Evaluation System",
      description: "The real AI-native product Codex is building and using as an employee.",
      status: "active",
      progress: { state: "awaiting_contract" },
      milestones: [
        {
          componentId: "d3333333-3333-4333-8333-333333333333",
          name: "Requirements and engine foundation",
          kind: "milestone",
          state: "complete",
          percent: null,
        },
        {
          componentId: "d4444444-4444-4444-8444-444444444444",
          name: "Work experience expansion",
          kind: "milestone",
          state: "current",
          percent: null,
        },
        {
          componentId: "d5555555-5555-4555-8555-555555555555",
          name: "Intelligent frontend acceptance",
          kind: "milestone",
          state: "next",
          percent: null,
        },
      ],
      kpi: null,
      nextAction: {
        label: "Implement safe inline Task edits",
        href: `/en/tasks?view=my&layout=list&project=${dogfoodProjectId}`,
      },
    },
    {
      id: projectId,
      name: "Atlas Delivery",
      description: "Deliver secure API access and pilot integration for Atlas.",
      status: "active",
      progress: {
        state: "accepted",
        percent: 62,
        source: progressSource,
        explanation: "Approved contract rule",
      },
      milestones: [
        {
          componentId: crypto.randomUUID(),
          name: "Discovery",
          kind: "milestone",
          state: "complete",
          percent: 100,
        },
        {
          componentId: crypto.randomUUID(),
          name: "API authentication",
          kind: "milestone",
          state: "current",
          percent: 62,
        },
        {
          componentId: crypto.randomUUID(),
          name: "Pilot readiness",
          kind: "milestone",
          state: "next",
          percent: null,
        },
      ],
      kpi: {
        componentId: crypto.randomUUID(),
        name: "API error rate",
        baseline: 4.1,
        current: 1.8,
        target: 1,
        unit: "%",
        direction: "decrease",
        source: progressSource,
      },
      nextAction: {
        label: "Review API authentication decision",
        href: `/en/projects/${projectId}`,
      },
    },
    {
      id: contextProjectId,
      name: "Research Assistant",
      description: "Validate research sources and prepare governed experiments.",
      status: "active",
      progress: {
        state: "accepted",
        percent: 28,
        source: progressSource,
        explanation: "Approved contract rule",
      },
      milestones: [
        {
          componentId: crypto.randomUUID(),
          name: "Research scope",
          kind: "milestone",
          state: "complete",
          percent: 100,
        },
        {
          componentId: crypto.randomUUID(),
          name: "Source validation",
          kind: "milestone",
          state: "current",
          percent: 28,
        },
        {
          componentId: crypto.randomUUID(),
          name: "Prototype experiment",
          kind: "milestone",
          state: "next",
          percent: null,
        },
      ],
      kpi: {
        componentId: crypto.randomUUID(),
        name: "Validated sources",
        baseline: 0,
        current: 6,
        target: 10,
        unit: " sources",
        direction: "increase",
        source: progressSource,
      },
      nextAction: { label: "Start prototype experiment", href: `/en/projects/${contextProjectId}` },
    },
  ];
  return {
    schemaVersion: "employee-home.v1",
    generatedAt: "2026-08-13T07:05:00.000Z",
    greetingName: "Codex",
    signals: { decisions: 0, dueToday: 2, verifiedChanges: 2 },
    projects,
    smartBrief: {
      title: "Continue the Work experience",
      body: "The first Work query bundle is complete; safe inline Task editing is the next bounded step.",
      source: workPlanSource,
      why: "It removes daily friction while keeping the authoritative command and audit boundaries.",
      consequence:
        "This advances the product plan only; official Project progress remains unavailable until its contract is approved.",
      action: {
        label: "Open the next Task",
        href: `/en/tasks?view=my&layout=list&project=${dogfoodProjectId}`,
      },
    },
    now: [
      {
        id: "event:work-review",
        kind: "task",
        occurredAt: "2026-08-13T09:15:00.000Z",
        title: "Review Phase 2 Work query bundle",
        projectId: dogfoodProjectId,
        projectName: "Evidence Performance Evaluation System",
        statusLabel: "In review",
        href: `/en/tasks?view=my&layout=list&project=${dogfoodProjectId}&item=${codexWorkItems[0].id}`,
        source: workPlanSource,
      },
      {
        id: "event:meeting",
        kind: "meeting",
        occurredAt: "2026-08-13T07:00:00.000Z",
        title: "AI-native employee journey design review",
        projectId: dogfoodProjectId,
        projectName: "Evidence Performance Evaluation System",
        statusLabel: "Product direction confirmed",
        href: `/en/projects/${dogfoodProjectId}`,
        source: workPlanSource,
      },
      {
        id: "event:task",
        kind: "task",
        occurredAt: "2026-08-13T11:30:00.000Z",
        title: "Implement safe inline Task edits",
        projectId: dogfoodProjectId,
        projectName: "Evidence Performance Evaluation System",
        statusLabel: "Due today",
        href: `/en/tasks?view=my&layout=list&project=${dogfoodProjectId}&item=${codexWorkItems[1].id}`,
        source: workPlanSource,
      },
      {
        id: "event:verified",
        kind: "verified_change",
        occurredAt: "2026-08-13T13:15:00.000Z",
        title: "Work filters and keyboard list implemented",
        projectId: dogfoodProjectId,
        projectName: "Evidence Performance Evaluation System",
        statusLabel: "Suggested evidence · confirm before contribution",
        href: `/en/projects/${dogfoodProjectId}`,
        source: githubSource,
      },
    ],
  };
}

function employeeProjectExperience() {
  const source = {
    kind: "progress_contract",
    label: "Approved Project contract",
    observedAt: "2026-08-13T07:00:00.000Z",
    freshness: "fresh",
  };
  return {
    schemaVersion: "employee-project-experience.v1",
    generatedAt: "2026-08-13T07:05:00.000Z",
    project: {
      id: projectId,
      name: "Atlas Delivery",
      description: "Deliver secure API access and pilot integration for Atlas.",
      status: "active",
      ownerName: "Codex",
      workstreams: [{ id: workstreamId, name: "API readiness" }],
    },
    document: {
      id: projectDocumentVersionId,
      title: "Project Document",
      version: 2,
      source: { ...source, kind: "project_document", label: "Approved Project Document" },
      href: `/en/projects/${projectId}`,
    },
    progress: {
      state: "accepted",
      percent: 62,
      source,
      explanation: "Approved contract rule",
    },
    milestones: [
      {
        componentId: "e3333333-3333-4333-8333-333333333333",
        name: "Discovery",
        kind: "milestone",
        state: "complete",
        percent: 100,
      },
      {
        componentId: "e4444444-4444-4333-8333-333333333333",
        name: "API authentication",
        kind: "milestone",
        state: "current",
        percent: 62,
      },
      {
        componentId: "e5555555-5555-4555-8555-555555555555",
        name: "Pilot readiness",
        kind: "milestone",
        state: "next",
        percent: null,
      },
    ],
    kpi: {
      componentId: "e6666666-6666-4666-8666-666666666666",
      name: "API error rate",
      baseline: 4.1,
      current: 1.8,
      target: 1,
      unit: "%",
      direction: "decrease",
      source,
    },
    attention: [
      {
        id: "attention:decision",
        title: "Owner decision on PR #184",
        subtitle: "API authentication",
        href: `/en/projects/${projectId}`,
        source,
      },
      {
        id: "attention:document",
        title: "Missing retention document",
        subtitle: "Required for pilot readiness",
        href: `/en/projects/${projectId}`,
        source: { ...source, kind: "project_document" },
      },
      {
        id: "attention:task",
        title: "Validate streaming fallback",
        subtitle: "Due today",
        href: `/en/tasks?item=${workItems[0].id}`,
        source: { ...source, kind: "work_item" },
      },
    ],
    collections: {
      work: [
        {
          id: "work:1",
          title: "Design review — AI-native employee journey",
          subtitle: "Ready · Due today",
          href: `/en/tasks?item=${workItems[0].id}`,
          source: { ...source, kind: "work_item", label: "Work Item" },
        },
      ],
      updates: [
        {
          id: "update:1",
          title: "Authentication fallback verified",
          subtitle: "Employee confirmed",
          href: `/en/projects/${projectId}`,
          source: { ...source, kind: "update", label: "Confirmed update" },
        },
      ],
      evidence: [
        {
          id: "evidence:1",
          title: "PR #182 merged: milestone condition satisfied",
          subtitle: "Suggested evidence · employee review required",
          href: `/en/projects/${projectId}`,
          source: { ...source, kind: "github", label: "GitHub suggested evidence" },
        },
      ],
      documents: [
        {
          id: "document:1",
          title: "Project Document v2",
          subtitle: "Approved source",
          href: `/en/projects/${projectId}`,
          source: { ...source, kind: "project_document", label: "Approved Project Document" },
        },
      ],
    },
    timeline: [
      {
        id: "timeline:verified",
        kind: "verified_change",
        occurredAt: "2026-08-13T13:15:00.000Z",
        title: "PR #182 merged: contract milestone condition satisfied",
        projectId,
        projectName: "Atlas Delivery",
        statusLabel: "Verified",
        href: `/en/projects/${projectId}`,
        source: { ...source, kind: "github", label: "GitHub suggested evidence" },
      },
      {
        id: "timeline:decision",
        kind: "decision",
        occurredAt: "2026-08-13T05:45:00.000Z",
        title: "Owner decision requested on PR #184",
        projectId,
        projectName: "Atlas Delivery",
        statusLabel: "Needs your decision",
        href: `/en/projects/${projectId}`,
        source: { ...source, kind: "human_decision", label: "Owner confirmation" },
      },
    ],
    nextCursor: null,
    smartBrief: {
      title: "What should I focus on?",
      body: "The API authentication decision can unblock the next milestone.",
      source,
      why: "Review PR #184 before the pilot-readiness work continues.",
      consequence:
        "Nothing is confirmed and official Project progress does not change until the authorized owner decides.",
      action: { label: "Review API authentication decision", href: `/en/projects/${projectId}` },
    },
  };
}

function codexProjectExperience() {
  const workPlanSource = {
    kind: "work_item",
    label: "Approved Phase 2 Work plan",
    observedAt: "2026-08-13T09:15:00.000Z",
    freshness: "fresh",
  };
  const githubSource = {
    kind: "github",
    label: "GitHub suggested evidence",
    observedAt: "2026-08-13T09:15:00.000Z",
    freshness: "fresh",
  };
  const documentSource = {
    kind: "project_document",
    label: "Approved Project Document",
    observedAt: "2026-07-19T12:00:00.000Z",
    freshness: "possibly_stale",
  };
  return {
    schemaVersion: "employee-project-experience.v1",
    generatedAt: "2026-08-13T09:15:00.000Z",
    project: {
      id: dogfoodProjectId,
      name: "Evidence Performance Evaluation System",
      description: "The real AI-native product Codex is building and using as an employee.",
      status: "active",
      ownerName: "Codex",
      workstreams: [],
    },
    document: {
      id: dogfoodDocumentVersionId,
      title: "Approved Project source",
      version: 3,
      source: documentSource,
      href: `/en/projects/${dogfoodProjectId}`,
    },
    progress: { state: "awaiting_contract" },
    milestones: [
      {
        componentId: "d3333333-3333-4333-8333-333333333333",
        name: "Requirements and engine foundation",
        kind: "milestone",
        state: "complete",
        percent: null,
      },
      {
        componentId: "d4444444-4444-4444-8444-444444444444",
        name: "Work experience expansion",
        kind: "milestone",
        state: "current",
        percent: null,
      },
      {
        componentId: "d5555555-5555-4555-8555-555555555555",
        name: "Intelligent frontend acceptance",
        kind: "milestone",
        state: "next",
        percent: null,
      },
    ],
    kpi: null,
    attention: [
      {
        id: "attention:contract",
        title: "Review the Project Progress Contract proposal",
        subtitle: "Human approval is required before any official percentage can appear",
        href: `/en/projects/${dogfoodProjectId}`,
        source: documentSource,
      },
      {
        id: "attention:next-task",
        title: "Implement safe inline Task edits",
        subtitle: "Next bounded Work experience task",
        href: `/en/tasks?view=my&layout=list&project=${dogfoodProjectId}&item=${codexWorkItems[1].id}`,
        source: workPlanSource,
      },
    ],
    collections: {
      work: codexWorkItems.map((item) => ({
        id: `work:${item.id}`,
        title: item.title,
        subtitle: `${item.status.replaceAll("_", " ")} · ${item.nextAction ?? "Review"}`,
        href: `/en/tasks?view=my&layout=list&project=${dogfoodProjectId}&item=${item.id}`,
        source: workPlanSource,
      })),
      updates: [
        {
          id: "update:work-bundle",
          title: "Work query and keyboard bundle implemented",
          subtitle: "Codex update · awaiting Product Owner acceptance",
          href: `/en/projects/${dogfoodProjectId}`,
          source: { ...workPlanSource, kind: "update", label: "Codex work update" },
        },
      ],
      evidence: [
        {
          id: "evidence:e4fefae",
          title: "Filtered Work results now follow the authoritative server response",
          subtitle: "Commit e4fefae · employee confirmation required",
          href: `/en/projects/${dogfoodProjectId}`,
          source: githubSource,
        },
        {
          id: "evidence:d8a3079",
          title: "Work filters, sort, counts, and keyboard list implemented",
          subtitle: "Commit d8a3079 · employee confirmation required",
          href: `/en/projects/${dogfoodProjectId}`,
          source: githubSource,
        },
      ],
      documents: [
        {
          id: "document:approved-source-v3",
          title: "Approved Project source v3",
          subtitle: "Governed source for the pending Progress Contract proposal",
          href: `/en/projects/${dogfoodProjectId}`,
          source: documentSource,
        },
      ],
    },
    timeline: [
      {
        id: "timeline:e4fefae",
        kind: "evidence",
        occurredAt: "2026-08-13T09:15:00.000Z",
        title: "Filtered Work results fixed at the authoritative boundary",
        projectId: dogfoodProjectId,
        projectName: "Evidence Performance Evaluation System",
        statusLabel: "Suggested evidence · employee confirmation required",
        href: `/en/projects/${dogfoodProjectId}`,
        source: githubSource,
      },
      {
        id: "timeline:d8a3079",
        kind: "evidence",
        occurredAt: "2026-08-13T08:40:00.000Z",
        title: "Work filters and keyboard list implemented",
        projectId: dogfoodProjectId,
        projectName: "Evidence Performance Evaluation System",
        statusLabel: "Suggested evidence · employee confirmation required",
        href: `/en/projects/${dogfoodProjectId}`,
        source: githubSource,
      },
    ],
    nextCursor: null,
    smartBrief: {
      title: "Continue the Work experience",
      body: "The filtered Work list is implemented; safe inline Task editing is the next bounded step.",
      source: workPlanSource,
      why: "It removes daily employee friction without bypassing authoritative commands.",
      consequence:
        "GitHub changes remain suggested evidence and official Project progress remains unavailable until its contract is approved.",
      action: {
        label: "Open the next Task",
        href: `/en/tasks?view=my&layout=list&project=${dogfoodProjectId}&item=${codexWorkItems[1].id}`,
      },
    },
  };
}

function experiencePrepared() {
  return {
    state: "prepared",
    items: [
      {
        id: "ac111111-1111-4111-8111-111111111111",
        schemaVersion: "experience-prepared-output.v1",
        state: "prepared",
        kind: "next_action",
        sourceReferences: [`work-item:${workItems[0].id}`],
        why: "This authorized Task needs your attention today.",
        freshness: {
          status: "fresh",
          sourceObservedAt: "2026-08-12T08:00:00.000Z",
          preparedAt: "2026-08-12T08:05:00.000Z",
        },
        consequence: "Reviewing it keeps the current work visible; nothing changes until you act.",
        editableDraft: {
          title: "Review today’s acceptance Task",
          body: "Check the authorized Task and decide the next manual action.",
        },
        assistance: {
          mode: "deterministic",
          label: "Selected from your authorized Today data without an AI result.",
          routeTrace: null,
        },
        correlationId: "ac222222-2222-4222-8222-222222222222",
      },
    ],
  };
}

function whatChanged(afterCursor) {
  const after = afterCursor === null ? 0n : BigInt(afterCursor);
  const items = experienceReceipts.filter(({ cursor }) => BigInt(cursor) > after);
  return { items, nextCursor: items.at(-1)?.cursor ?? afterCursor };
}

const projectProgress = {
  project: {
    id: projectId,
    name: project.name,
    description: project.description,
    status: project.status,
  },
  contract: {
    id: progressContractId,
    contractVersion: 1,
    version: 3,
    state: "active",
    calculationKind: "weighted",
    effectiveAt: "2026-07-18T09:00:00.000Z",
    components: [
      {
        id: "e3333333-3333-4333-8333-333333333333",
        kind: "kpi",
        name: "السيناريوهات المعتمدة",
        description: "عدد سيناريوهات رحلة العميل التي اعتمدها مالك المنتج.",
        weight: 60,
        baseline: 0,
        target: 12,
        unit: "سيناريو",
        direction: "increase",
        requiredEvidence: ["سجل اعتماد مالك المنتج"],
      },
      {
        id: "e4444444-4444-4444-8444-444444444444",
        kind: "milestone",
        name: "جاهزية العرض المحلي",
        description: "المنتج يعمل محليًا بالعربية والإنجليزية.",
        weight: 40,
        baseline: null,
        target: null,
        unit: null,
        direction: null,
        requiredEvidence: ["لقطات سطح المكتب والجوال", "نتيجة الاختبار التشغيلي"],
      },
    ],
  },
  progress: {
    state: "accepted",
    snapshotId: progressSnapshotId,
    percent: 62.5,
    reason: "اعتمدت خمسة من ثمانية مخرجات قابلة للقياس.",
    updatedAt: "2026-07-18T12:00:00.000Z",
  },
  pulse: {
    officialProgress: 62.5,
    previousOfficialProgress: 50,
    sourceCoverage: "INSUFFICIENT",
    milestoneStates: [
      {
        componentId: "e3333333-3333-4333-8333-333333333333",
        name: "السيناريوهات المعتمدة",
        kind: "kpi",
        percent: 62.5,
        state: "in_progress",
      },
      {
        componentId: "e4444444-4444-4444-8444-444444444444",
        name: "جاهزية العرض المحلي",
        kind: "milestone",
        percent: null,
        state: "awaiting_evidence",
      },
    ],
    nextRequiredEvidence: [
      {
        componentId: "e4444444-4444-4444-8444-444444444444",
        componentName: "جاهزية العرض المحلي",
        label: "لقطات سطح المكتب والجوال",
      },
    ],
    explanation: [
      {
        kind: "increase",
        delta: 12.5,
        text: "Five of eight approved, measurable outcomes are now confirmed.",
        snapshotId: progressSnapshotId,
        observedAt: "2026-07-18T12:00:00.000Z",
      },
    ],
  },
  contractDraftSourceRequest: null,
};

const dogfoodProgress = {
  project: {
    id: dogfoodProjectId,
    name: "Evidence Performance Evaluation System",
    description: "The real AI-native product Codex is building and using as an employee.",
    status: "active",
  },
  contract: null,
  progress: { state: "awaiting_contract" },
  pulse: {
    officialProgress: null,
    previousOfficialProgress: null,
    sourceCoverage: "INSUFFICIENT",
    milestoneStates: [],
    nextRequiredEvidence: [],
    explanation: [],
  },
  contractDraftSourceRequest: {
    documentVersionId: dogfoodDocumentVersionId,
    sourceChecksum: "c".repeat(64),
    sourceVersion: 1,
  },
};

function dogfoodDraft() {
  return {
    requestId: dogfoodDraftRequestId,
    state: dogfoodContractState === null ? "ready" : "applied",
    revision: dogfoodDraftRevision,
    origin: dogfoodDraftRevision === 1 ? "ai" : "human",
    source: { label: "Approved Project document", version: 1 },
    draft: {
      components: [
        {
          position: 1,
          kind: "milestone",
          name: "Required quality gate satisfied",
          description: "The exact required checks pass for the approved merge commit.",
          weight: null,
          baseline: null,
          target: null,
          unit: null,
          direction: null,
          acceptanceConditions: ["The Product Owner accepts the named quality gate"],
          requiredEvidence: ["Required-check summary", "Product Owner acceptance record"],
          confirmationMode: "human_confirmed",
          sourceLabels: ["Approved Project document · version 1"],
          automationHints: [],
        },
      ],
      ambiguities: ["The final approved merge commit is not yet available."],
      clarificationQuestions: ["Which exact merge commit will be accepted?"],
    },
    contract:
      dogfoodContractState === null
        ? null
        : {
            id: dogfoodContractId,
            state: dogfoodContractState,
            version: dogfoodContractVersion,
          },
  };
}

const contextReviewItems = [
  {
    kind: "PROJECT_SUGGESTION",
    id: highConfidenceSuggestionId,
    employeeId: ownerId,
    sourceItemId: contextHighConfidenceItemId,
    revision: 1,
    reviewStatus: "PENDING",
    projectId: contextProjectId,
    explanation:
      "Two independent anchors agree: known Project participant and approved Project term.",
  },
  {
    kind: "PROJECT_SUGGESTION",
    id: uncertainSuggestionId,
    employeeId: ownerId,
    sourceItemId: contextUncertainItemId,
    revision: 1,
    reviewStatus: "PENDING",
    projectId: null,
    explanation: "One Project term matched, but a second independent anchor is missing.",
  },
  {
    kind: "PROJECT_SUGGESTION",
    id: rejectedSuggestionId,
    employeeId: ownerId,
    sourceItemId: contextRejectedItemId,
    revision: 1,
    reviewStatus: "PENDING",
    projectId: null,
    explanation: "No governed Project anchor was found.",
  },
  {
    kind: "TASK_DRAFT",
    id: contextTaskDraftId,
    employeeId: ownerId,
    sourceItemId: contextTaskItemId,
    revision: 1,
    reviewStatus: "PENDING",
    draft: {
      title: "Document the accepted release decision",
      description: "Record the approved decision and its agreed follow-up.",
      projectId: contextProjectId,
      workstreamId: null,
      proposedAssigneeId: null,
      dueAt: null,
      acceptanceConditions: ["The approved release decision is documented"],
      uncertainties: ["Confirm who should own the follow-up"],
    },
    clarification: { nextQuestion: { field: "assigneeId" } },
  },
];
const baseContextReviewItems = structuredClone(contextReviewItems);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:3101");
  if (request.method === "GET" && url.pathname === "/health") {
    return json(response, 200, { status: "ok" });
  }
  if (
    request.method === "POST" &&
    url.pathname === "/__e2e/context/reset" &&
    request.headers["x-e2e-control"] === "context-intelligence"
  ) {
    resetContextAcceptanceState();
    return empty(response, 204);
  }
  if (
    request.method === "POST" &&
    url.pathname === "/__e2e/slice-4/reset" &&
    request.headers["x-e2e-control"] === "slice-4"
  ) {
    resetSliceFourAcceptanceState();
    return empty(response, 204);
  }
  if (
    request.method === "POST" &&
    url.pathname === "/__e2e/slice-5/reset" &&
    request.headers["x-e2e-control"] === "slice-5"
  ) {
    resetSliceFiveAcceptanceState();
    return empty(response, 204);
  }
  if (
    request.method === "POST" &&
    url.pathname === "/__e2e/research/reset" &&
    request.headers["x-e2e-control"] === "research-experiments"
  ) {
    resetResearchAcceptanceState();
    return empty(response, 204);
  }
  if (
    request.method === "POST" &&
    url.pathname === "/__e2e/research/ai-availability" &&
    request.headers["x-e2e-control"] === "research-experiments"
  ) {
    const body = await readJson(request);
    if (body === null || typeof body.available !== "boolean") {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    researchAiAvailable = body.available;
    return empty(response, 204);
  }
  if (
    request.method === "GET" &&
    url.pathname === "/__e2e/research/checkpoint" &&
    request.headers["x-e2e-control"] === "research-experiments"
  ) {
    return json(response, 200, researchCheckpoint());
  }
  if (
    request.method === "GET" &&
    url.pathname === "/__e2e/slice-4/state" &&
    request.headers["x-e2e-control"] === "slice-4"
  ) {
    return json(response, 200, {
      capturedUpdateSourceKinds,
      officialProjectProgressPercent,
      ambiguousProgressReviewQueued,
      employeePerformanceWrites: employeePerformanceWrites.length,
    });
  }
  if (
    request.method === "POST" &&
    url.pathname === "/__e2e/slice-4/github-events" &&
    request.headers["x-e2e-control"] === "slice-4"
  ) {
    const body = await readJson(request);
    if (body === null || !Array.isArray(body.matchedRuleIds)) {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    ambiguousProgressReviewQueued = body.matchedRuleIds.length > 1;
    timelineItems.unshift(githubProjectFact());
    return json(response, 200, {
      receivedCommitCount: body.commitCount ?? 0,
      receivedChangedFileCount: body.changedFileCount ?? 0,
      officialProjectProgressPercent,
      ambiguousProgressReviewQueued,
    });
  }
  if (
    request.method === "POST" &&
    url.pathname === "/__e2e/slice-4/owner-decisions" &&
    request.headers["x-e2e-control"] === "slice-4"
  ) {
    const body = await readJson(request);
    if (body === null || typeof body.sourceRef !== "string") {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    ambiguousProgressReviewQueued = false;
    timelineItems.unshift(ownerProgressDecision(body.sourceRef, body.satisfied === true));
    return json(response, 200, {
      officialProjectProgressPercent,
      satisfied: body.satisfied === true,
    });
  }
  if (
    request.method === "POST" &&
    url.pathname === "/__e2e/context/ai-availability" &&
    request.headers["x-e2e-control"] === "context-intelligence"
  ) {
    const body = await readJson(request);
    if (body === null || typeof body.available !== "boolean") {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    contextAiAvailable = body.available;
    return empty(response, 204);
  }
  const presentedAccessToken = request.headers.authorization?.replace(/^Bearer /u, "") ?? "";
  const localPreviewOwner =
    process.env.LOCAL_PREVIEW_AUTHENTICATED === "true" && presentedAccessToken !== "";
  if (!connectedWorkAccessTokens.has(presentedAccessToken) && !localPreviewOwner) {
    return json(response, 401, { messageKey: "errors.unauthorized" });
  }
  const accessToken = localPreviewOwner ? ownerAccessToken : presentedAccessToken;

  if (request.method === "GET" && url.pathname === "/api/v1/connected-work/items") {
    if (accessToken !== ownerAccessToken || !connectedWorkConnected) {
      return json(response, 200, {
        mode: "synthetic",
        synthetic: true,
        connection: { status: "disconnected", lastSuccessfulSyncAt: null },
        items: [],
      });
    }
    return json(response, 200, {
      mode: "synthetic",
      synthetic: true,
      connection: {
        status: "connected",
        lastSuccessfulSyncAt: "2026-07-20T10:00:00.000Z",
      },
      items: connectedWorkItems,
    });
  }
  if (request.method === "GET" && url.pathname === "/api/v1/context/review-queue") {
    if (accessToken !== ownerAccessToken) return json(response, 200, { items: [] });
    if (!contextAiAvailable) {
      return json(response, 503, { messageKey: "errors.internal" });
    }
    return json(response, 200, {
      items: contextReviewItems.filter(
        (item) =>
          item.reviewStatus === "PENDING" ||
          (item.kind === "TASK_DRAFT" && item.reviewStatus === "CORRECTED"),
      ),
    });
  }
  if (
    request.method === "GET" &&
    url.pathname === "/api/v1/projects" &&
    accessToken !== ownerAccessToken
  ) {
    return json(response, 200, []);
  }
  if (
    request.method === "POST" &&
    url.pathname === "/api/v1/connected-work/google/start" &&
    accessToken === ownerAccessToken
  ) {
    const body = await readJson(request);
    if (body === null || typeof body.redirectUri !== "string") {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    const authorizationUrl = new URL(body.redirectUri);
    authorizationUrl.searchParams.set("state", connectedWorkState);
    authorizationUrl.searchParams.set("nonce", connectedWorkNonce);
    return json(response, 200, {
      mode: "synthetic",
      synthetic: true,
      authorizationUrl: authorizationUrl.toString(),
    });
  }
  if (
    request.method === "GET" &&
    url.pathname === "/api/v1/connected-work/google/callback" &&
    accessToken === ownerAccessToken
  ) {
    if (
      url.searchParams.get("state") !== connectedWorkState ||
      url.searchParams.get("nonce") !== connectedWorkNonce
    ) {
      return json(response, 403, { messageKey: "errors.forbidden" });
    }
    connectedWorkConnected = true;
    return json(response, 200, {
      mode: "synthetic",
      synthetic: true,
      connected: true,
      synchronizedProviders: ["GOOGLE_GMAIL", "GOOGLE_CALENDAR"],
    });
  }
  if (
    request.method === "DELETE" &&
    url.pathname === "/api/v1/connected-work/google" &&
    accessToken === ownerAccessToken
  ) {
    connectedWorkConnected = false;
    return json(response, 200, { mode: "synthetic", synthetic: true, connected: false });
  }
  if (
    /^\/api\/v1\/connected-work\/items\/[0-9a-f-]+\/(?:exclusion|source-exclusion|project-link)$/u.test(
      url.pathname,
    )
  ) {
    if (accessToken !== ownerAccessToken || !connectedWorkConnected) {
      return json(response, 403, { messageKey: "errors.forbidden" });
    }
    const sourceItemId = url.pathname.split("/")[5];
    const item = connectedWorkItems.find(({ id }) => id === sourceItemId);
    if (item === undefined) return json(response, 404, { messageKey: "errors.notFound" });
    if (request.method === "PATCH" && url.pathname.endsWith("/exclusion")) {
      const body = await readJson(request);
      if (body === null || typeof body.excluded !== "boolean") {
        return json(response, 400, { messageKey: "errors.validation" });
      }
      item.excluded = body.excluded;
      return json(response, 200, { id: item.id, excluded: item.excluded });
    }
    if (request.method === "PATCH" && url.pathname.endsWith("/source-exclusion")) {
      const body = await readJson(request);
      if (body === null || typeof body.excluded !== "boolean") {
        return json(response, 400, { messageKey: "errors.validation" });
      }
      item.sourceExclusion.excluded = body.excluded;
      return json(response, 200, {
        id: item.id,
        sourceExcluded: item.sourceExclusion.excluded,
      });
    }
    if (request.method === "PUT" && url.pathname.endsWith("/project-link")) {
      const body = await readJson(request);
      if (body === null || body.projectId !== projectId || typeof body.reason !== "string") {
        return json(response, 400, { messageKey: "errors.validation" });
      }
      item.projectId = projectId;
      return json(response, 200, { id: item.id, projectId, linked: true });
    }
    if (request.method === "DELETE" && url.pathname.endsWith("/project-link")) {
      const body = await readJson(request);
      if (body === null || typeof body.reason !== "string") {
        return json(response, 400, { messageKey: "errors.validation" });
      }
      item.projectId = null;
      return json(response, 200, { id: item.id, linked: false });
    }
  }

  if (request.method === "GET" && url.pathname === "/api/v1/daily-work/manager/operations") {
    if (accessToken !== managerAccessToken) {
      return json(response, 403, { messageKey: "errors.forbidden" });
    }
    return json(response, 200, managerOperations());
  }

  if (
    request.method === "GET" &&
    url.pathname === `/api/v1/evaluation-cycles/${evaluationCycleId}/employees/${ownerId}/facts`
  ) {
    if (accessToken !== ownerAccessToken && accessToken !== managerAccessToken) {
      return json(response, 403, { messageKey: "errors.forbidden" });
    }
    return json(response, 200, evaluationFactView());
  }

  if (
    request.method === "GET" &&
    url.pathname === `/api/v1/employee-evaluation/cycles/${evaluationCycleId}/journey`
  ) {
    if (accessToken !== ownerAccessToken && accessToken !== managerAccessToken) {
      return json(response, 403, { messageKey: "errors.forbidden" });
    }
    return json(
      response,
      200,
      employeeEvaluationJourney(accessToken === ownerAccessToken ? "self" : "assigned_manager"),
    );
  }

  if (
    request.method === "GET" &&
    url.pathname === `/api/v1/manager-evaluation/cycles/${managerEvaluationCycleId}/manager-view`
  ) {
    if (accessToken !== managerAccessToken) {
      return json(response, 403, { messageKey: "errors.forbidden" });
    }
    return json(response, 200, identifiedManagerEvaluationView());
  }

  if (request.method === "GET" && url.pathname === "/api/v1/me") {
    const roles =
      accessToken === managerAccessToken
        ? ["manager"]
        : accessToken === systemAdministratorAccessToken
          ? ["system_administrator"]
          : [];
    return json(response, 200, {
      active: true,
      email: "synthetic-shell-user@example.invalid",
      oidcSubject: "synthetic-shell-user",
      roles,
      userId: accessToken === managerAccessToken ? evaluationManagerId : ownerId,
    });
  }

  if (request.method === "GET" && url.pathname === "/api/v1/experience-orchestration/prepared") {
    if (accessToken !== ownerAccessToken)
      return json(response, 403, { messageKey: "errors.forbidden" });
    return json(response, 200, experiencePrepared());
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/v1/experience-orchestration/capture/understand"
  ) {
    if (accessToken !== ownerAccessToken)
      return json(response, 403, { messageKey: "errors.forbidden" });
    const body = await readJson(request);
    if (body === null || typeof body.rawText !== "string")
      return json(response, 400, { messageKey: "errors.validation" });
    if (body.rawText.includes("[provider-unavailable]"))
      return json(response, 503, { messageKey: "errors.ai.unavailable" });
    return json(response, 200, {
      schemaVersion: "capture-understanding.v1",
      likelyProject: {
        id: projectId,
        name: "Atlas Delivery",
        confidence: "high",
      },
      likelyMeaning: "suggested_evidence",
      relatedWorkItemId: workItems[0]?.id ?? null,
      relatedComponentId: "e3333333-3333-4333-8333-333333333333",
      sourceRefs: [
        {
          kind: "github",
          label: "GitHub PR #184",
          observedAt: "2026-08-13T08:00:00.000Z",
          freshness: "fresh",
        },
      ],
      clarification: {
        question: "What measured API error rate did you observe, and where can it be verified?",
        missingField: "measured_result",
      },
      confidence: "high",
      createsOfficialRecord: false,
    });
  }

  if (request.method === "GET" && url.pathname === "/api/v1/experience/what-changed") {
    if (accessToken !== ownerAccessToken)
      return json(response, 200, { items: [], nextCursor: null });
    return json(response, 200, whatChanged(url.searchParams.get("afterCursor")));
  }

  if (accessToken === managerAccessToken) {
    if (request.method === "GET" && url.pathname === "/api/v1/daily-work/my-work") {
      return json(response, 200, {
        needsMyAction: [],
        today: [],
        overdue: [],
        reviewQueue: [],
        inbox: [],
        projectPulse: [],
        upcoming: [],
      });
    }
    if (request.method === "GET" && url.pathname === "/api/v1/daily-work/update-context") {
      return json(response, 200, { projects: [] });
    }
    if (request.method === "GET" && url.pathname === "/api/v1/daily-work/check-ins") {
      return json(response, 200, []);
    }
  }

  if (accessToken !== ownerAccessToken) {
    return json(response, 403, { messageKey: "errors.forbidden" });
  }

  if (request.method === "GET" && url.pathname === "/api/v1/projects") {
    return json(response, 200, [project, dogfoodProject, contextProject]);
  }
  if (
    request.method === "POST" &&
    /^\/api\/v1\/context\/project-suggestions\/[0-9a-f-]+\/(?:confirm|correct)$/u.test(url.pathname)
  ) {
    const body = await readJson(request);
    const segments = url.pathname.split("/");
    const suggestionId = segments[5];
    const action = segments[6];
    const suggestionIndex = contextReviewItems.findIndex(
      (item) =>
        item.kind === "PROJECT_SUGGESTION" &&
        item.id === suggestionId &&
        item.reviewStatus === "PENDING",
    );
    const suggestion = contextReviewItems[suggestionIndex];
    if (
      body === null ||
      suggestionIndex < 0 ||
      suggestion === undefined ||
      body.expectedRevision !== suggestion.revision ||
      typeof body.reason !== "string"
    ) {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    const targetProjectId = action === "confirm" ? suggestion.projectId : body.projectId;
    if (
      targetProjectId !== null &&
      targetProjectId !== projectId &&
      targetProjectId !== dogfoodProjectId &&
      targetProjectId !== contextProjectId
    ) {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    const source = connectedWorkItems.find(({ id }) => id === suggestion.sourceItemId);
    if (source === undefined) return json(response, 404, { messageKey: "errors.notFound" });
    source.projectId = targetProjectId ?? null;
    suggestion.reviewStatus = action === "confirm" ? "CONFIRMED" : "CORRECTED";
    return json(response, 200, { accepted: true });
  }
  if (
    request.method === "POST" &&
    url.pathname === `/api/v1/context/task-drafts/${contextTaskDraftId}/confirm`
  ) {
    const body = await readJson(request);
    const draftIndex = contextReviewItems.findIndex(
      (item) =>
        item.kind === "TASK_DRAFT" &&
        item.id === contextTaskDraftId &&
        ["PENDING", "CORRECTED"].includes(item.reviewStatus),
    );
    if (
      body === null ||
      draftIndex < 0 ||
      body.expectedRevision !== 1 ||
      typeof body.reason !== "string" ||
      body.draft?.projectId !== contextProjectId ||
      body.draft?.assigneeId !== ownerId ||
      typeof body.draft?.title !== "string" ||
      typeof body.draft?.description !== "string"
    ) {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    const item = {
      ...workItem(workItems.length + 1, "planned", body.draft.dueAt ?? null, null),
      id: randomUUID(),
      projectId: body.draft.projectId,
      workstreamId: body.draft.workstreamId ?? null,
      title: body.draft.title,
      description: body.draft.description,
      assigneeId: body.draft.assigneeId,
      acceptanceConditions: body.draft.acceptanceConditions ?? [],
    };
    workItems.unshift(item);
    contextReviewItems[draftIndex].reviewStatus = "CONFIRMED";
    return json(response, 200, { workItem: item });
  }
  if (request.method === "POST" && url.pathname === "/api/v1/research/source-reviews") {
    const body = await readJson(request);
    if (body === null) return json(response, 400, { messageKey: "errors.validation" });
    if (body.source?.url === "http://127.0.0.1/private") {
      return json(response, 400, { messageKey: "errors.research.sourceBlocked" });
    }
    if (!researchAiAvailable) {
      return json(response, 503, { messageKey: "errors.research.aiUnavailable" });
    }
    return json(response, 200, researchSourceReview());
  }
  if (
    request.method === "POST" &&
    url.pathname === `/api/v1/research/source-reviews/${researchReviewId}/disposition`
  ) {
    const body = await readJson(request);
    if (body === null || body.expectedVersion !== 2) {
      return json(response, 409, { messageKey: "errors.research.sourceReviewVersionConflict" });
    }
    if (
      body.disposition !== "CONFIRM" ||
      !Array.isArray(body.proposalIds) ||
      !body.proposalIds.includes(researchProposalId) ||
      !body.proposalIds.includes(experimentProposalId) ||
      body.proposalIds.includes(workItemProposalId)
    ) {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    confirmResearchCheckpoint();
    return json(response, 200, researchSourceReview("CONFIRMED", 3));
  }
  if (request.method === "GET" && url.pathname === `/api/v1/research/${researchId}`) {
    return json(response, 200, researchDetail());
  }
  if (
    request.method === "GET" &&
    (url.pathname === `/api/v1/experiments/${unsupportedExperimentId}` ||
      url.pathname === `/api/v1/experiments/${supportedExperimentId}`)
  ) {
    return json(
      response,
      200,
      experimentDetail(
        url.pathname.endsWith(unsupportedExperimentId) ? "unsupported" : "supported",
      ),
    );
  }
  if (request.method === "GET" && url.pathname === "/api/v1/daily-work/my-work") {
    return json(response, 200, dailyWorkspace());
  }
  if (request.method === "GET" && url.pathname === "/api/v1/daily-work/home") {
    return json(response, 200, employeeHome());
  }
  if (
    request.method === "GET" &&
    url.pathname === `/api/v1/daily-work/projects/${projectId}/experience`
  ) {
    return json(response, 200, employeeProjectExperience());
  }
  if (
    request.method === "GET" &&
    url.pathname === `/api/v1/daily-work/projects/${dogfoodProjectId}/experience`
  ) {
    return json(response, 200, codexProjectExperience());
  }
  if (request.method === "GET" && url.pathname === "/api/v1/work-items") {
    const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
    const projectFilter = url.searchParams.get("projectId");
    const statusFilter = url.searchParams.get("status");
    const baseItems = workItems.filter(
      (item) =>
        (projectFilter === null || item.projectId === projectFilter) &&
        (search === "" || `${item.title} ${item.description}`.toLowerCase().includes(search)),
    );
    const visibleItems = baseItems.filter(
      (item) => statusFilter === null || item.status === statusFilter,
    );
    const sort = url.searchParams.get("sort") ?? "due_asc";
    const priorityRank = { urgent: 4, high: 3, normal: 2, low: 1 };
    visibleItems.sort((left, right) => {
      if (sort === "updated_desc") return right.updatedAt.localeCompare(left.updatedAt);
      if (sort === "priority_desc")
        return priorityRank[right.priority] - priorityRank[left.priority];
      return (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999");
    });
    const statuses = [
      "planned",
      "ready",
      "in_progress",
      "blocked",
      "in_review",
      "done",
      "cancelled",
    ];
    return json(response, 200, {
      view: url.searchParams.get("view") ?? "my",
      layout: url.searchParams.get("layout") ?? "list",
      items: visibleItems,
      nextCursor: null,
      counts: Object.fromEntries([
        ["all", baseItems.length],
        ...statuses.map((status) => [
          status,
          baseItems.filter((item) => item.status === status).length,
        ]),
      ]),
    });
  }
  if (request.method === "GET" && /^\/api\/v1\/work-items\/[0-9a-f-]+$/u.test(url.pathname)) {
    const workItemId = url.pathname.split("/")[4];
    const item = workItems.find(({ id }) => id === workItemId);
    return item === undefined
      ? json(response, 404, { messageKey: "errors.notFound" })
      : json(response, 200, item);
  }
  if (request.method === "GET" && url.pathname === "/api/v1/daily-work/projects") {
    return json(response, 200, [
      {
        id: dogfoodProjectId,
        name: dogfoodProject.name,
        status: "active",
        progress: { state: "awaiting_contract" },
      },
      {
        id: projectId,
        name: project.name,
        status: "active",
        progress: { state: "accepted", percent: 62.5, updatedAt: "2026-07-18T12:00:00.000Z" },
      },
    ]);
  }
  if (request.method === "GET" && url.pathname === "/api/v1/daily-work/update-context") {
    return json(response, 200, {
      projects: [
        {
          id: dogfoodProjectId,
          name: dogfoodProject.name,
          workstreams: [],
          workItems: codexWorkItems.map((item) => ({
            id: item.id,
            title: item.title,
            workstreamId: item.workstreamId,
          })),
        },
        {
          id: projectId,
          name: "Atlas Delivery",
          workstreams: [{ id: workstreamId, name: "API readiness" }],
          workItems: workItems.map((item) => ({
            id: item.id,
            title: item.title,
            workstreamId: item.workstreamId,
          })),
        },
      ],
    });
  }
  if (request.method === "POST" && url.pathname === "/api/v1/private-inbox") {
    const body = await readJson(request);
    if (body === null || typeof body.text !== "string") {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    const item = {
      id: randomUUID(),
      employeeId: ownerId,
      text: body.text,
      projectId: body.projectId ?? null,
      sourceType: body.sourceType ?? "text",
      sourceUploadId: body.sourceUploadId ?? null,
      status: "open",
      promotedWorkItemId: null,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    privateInboxItems.unshift(item);
    experienceReceipts.push({
      receiptId: randomUUID(),
      cursor: String(experienceReceipts.length + 1),
      type: "user.capture_submitted",
      source: "work",
      entityRefs: { privateInboxItemId: item.id },
      occurredAt: item.createdAt,
      freshness: { status: "fresh", occurredAt: item.createdAt },
      state: "delivered",
    });
    return json(response, 200, item);
  }
  if (request.method === "POST" && url.pathname === "/api/v1/work-items") {
    const body = await readJson(request);
    if (
      body === null ||
      typeof body.title !== "string" ||
      typeof body.projectId !== "string" ||
      body.assigneeId !== ownerId
    ) {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    const item = {
      ...workItem(workItems.length + 1, "planned", body.dueAt ?? null, body.nextAction ?? null),
      id: randomUUID(),
      projectId: body.projectId,
      workstreamId: body.workstreamId ?? null,
      title: body.title,
      description: body.description ?? "",
      assigneeId: body.assigneeId,
      priority: body.priority ?? "normal",
      requirements: body.requirements ?? [],
      acceptanceConditions: body.acceptanceConditions ?? [],
      blocker: body.blocker ?? null,
    };
    workItems.unshift(item);
    return json(response, 200, item);
  }
  if (request.method === "PATCH" && /^\/api\/v1\/work-items\/[0-9a-f-]+$/u.test(url.pathname)) {
    const body = await readJson(request);
    const workItemId = url.pathname.split("/")[4];
    const item = workItems.find(({ id }) => id === workItemId);
    if (body === null || item === undefined || typeof body.title !== "string") {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    if (body.expectedVersion !== item.version) {
      return json(response, 409, { messageKey: "errors.workItems.versionConflict" });
    }
    item.title = body.title;
    if (["low", "normal", "high", "urgent"].includes(body.priority)) {
      item.priority = body.priority;
    }
    if (body.dueAt === null || typeof body.dueAt === "string") item.dueAt = body.dueAt;
    item.version += 1;
    item.updatedAt = new Date().toISOString();
    return json(response, 200, item);
  }
  if (
    request.method === "POST" &&
    /^\/api\/v1\/work-items\/[0-9a-f-]+\/transitions$/u.test(url.pathname)
  ) {
    const body = await readJson(request);
    const workItemId = url.pathname.split("/")[4];
    const item = workItems.find(({ id }) => id === workItemId);
    if (
      body === null ||
      item === undefined ||
      body.expectedVersion !== item.version ||
      typeof body.reason !== "string" ||
      !["ready", "in_progress", "blocked", "in_review", "done", "cancelled"].includes(body.status)
    ) {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    item.status = body.status;
    item.allowedTransitions = workItemTransitions(item.status);
    item.version += 1;
    item.updatedAt = new Date().toISOString();
    return json(response, 200, item);
  }
  if (
    request.method === "POST" &&
    /^\/api\/v1\/private-inbox\/[0-9a-f-]+\/promote$/u.test(url.pathname)
  ) {
    const body = await readJson(request);
    const inboxId = url.pathname.split("/")[4];
    const inbox = privateInboxItems.find(({ id }) => id === inboxId);
    if (
      body === null ||
      inbox === undefined ||
      typeof body.title !== "string" ||
      typeof body.projectId !== "string"
    ) {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    const item = {
      ...workItem(workItems.length + 1, "planned", body.dueAt ?? null, body.nextAction ?? null),
      id: randomUUID(),
      projectId: body.projectId,
      workstreamId: body.workstreamId ?? null,
      title: body.title,
      description: body.description ?? "",
      assigneeId: body.assigneeId ?? ownerId,
      priority: body.priority ?? "normal",
      requirements: body.requirements ?? [],
      acceptanceConditions: body.acceptanceConditions ?? [],
      blocker: body.blocker ?? null,
    };
    workItems.unshift(item);
    inbox.status = "promoted";
    inbox.promotedWorkItemId = item.id;
    inbox.version += 1;
    inbox.updatedAt = new Date().toISOString();
    return json(response, 200, item);
  }
  if (request.method === "GET" && url.pathname === `/api/v1/daily-work/projects/${projectId}`) {
    return json(response, 200, projectProgress);
  }
  if (
    request.method === "GET" &&
    url.pathname === `/api/v1/daily-work/projects/${dogfoodProjectId}`
  ) {
    return json(response, 200, dogfoodProgress);
  }
  if (
    request.method === "GET" &&
    url.pathname === `/api/v1/projects/${dogfoodProjectId}/progress-contract-drafts`
  ) {
    return json(response, 200, dogfoodDraft());
  }
  if (
    request.method === "GET" &&
    url.pathname === `/api/v1/projects/${projectId}/progress-contract-drafts`
  ) {
    return json(response, 200, null);
  }
  if (
    request.method === "POST" &&
    url.pathname === `/api/v1/projects/${dogfoodProjectId}/progress-contract-drafts`
  ) {
    return json(response, 200, dogfoodDraft());
  }
  if (
    request.method === "GET" &&
    url.pathname ===
      `/api/v1/projects/${dogfoodProjectId}/progress-contract-drafts/${dogfoodDraftRequestId}`
  ) {
    return json(response, 200, dogfoodDraft());
  }
  if (
    request.method === "POST" &&
    url.pathname ===
      `/api/v1/projects/${dogfoodProjectId}/progress-contract-drafts/${dogfoodDraftRequestId}/revisions`
  ) {
    const body = await readJson(request);
    if (body === null || body.expectedRevision !== dogfoodDraftRevision) {
      return json(response, 409, { messageKey: "errors.validation" });
    }
    dogfoodDraftRevision += 1;
    return json(response, 200, dogfoodDraft());
  }
  if (
    request.method === "POST" &&
    url.pathname ===
      `/api/v1/projects/${dogfoodProjectId}/progress-contract-drafts/${dogfoodDraftRequestId}/apply`
  ) {
    const body = await readJson(request);
    if (
      body === null ||
      body.expectedRevision !== dogfoodDraftRevision ||
      body.selectedRevision !== dogfoodDraftRevision ||
      dogfoodContractState !== null
    ) {
      return json(response, 409, { messageKey: "errors.validation" });
    }
    dogfoodContractState = "draft";
    dogfoodContractVersion = 1;
    return json(response, 200, {
      requestId: dogfoodDraftRequestId,
      selectedRevision: dogfoodDraftRevision,
      contract: {
        id: dogfoodContractId,
        state: dogfoodContractState,
        version: dogfoodContractVersion,
      },
    });
  }
  if (
    request.method === "POST" &&
    url.pathname ===
      `/api/v1/projects/${dogfoodProjectId}/progress-contracts/${dogfoodContractId}/submit`
  ) {
    const body = await readJson(request);
    if (
      body === null ||
      body.expectedVersion !== dogfoodContractVersion ||
      dogfoodContractState !== "draft"
    ) {
      return json(response, 409, { messageKey: "errors.validation" });
    }
    dogfoodContractState = "pending_approval";
    dogfoodContractVersion += 1;
    return json(response, 200, {
      id: dogfoodContractId,
      state: dogfoodContractState,
      version: dogfoodContractVersion,
    });
  }
  if (
    request.method === "POST" &&
    url.pathname ===
      `/api/v1/projects/${dogfoodProjectId}/progress-contracts/${dogfoodContractId}/approve`
  ) {
    const body = await readJson(request);
    if (
      body === null ||
      body.expectedVersion !== dogfoodContractVersion ||
      dogfoodContractState !== "pending_approval"
    ) {
      return json(response, 409, { messageKey: "errors.validation" });
    }
    dogfoodContractState = "active";
    dogfoodContractVersion += 1;
    return json(response, 200, {
      id: dogfoodContractId,
      state: dogfoodContractState,
      version: dogfoodContractVersion,
    });
  }
  if (request.method === "GET" && url.pathname === "/api/v1/daily-work/check-ins") {
    return json(response, 200, [
      {
        projectId,
        projectName: "Atlas Delivery",
        workstreamId,
        workstreamName: "API readiness",
        weekStartsAt: "2026-08-03T00:00:00.000Z",
        weekEndsAt: "2026-08-09T23:59:59.999Z",
        state: "required",
        capture: { projectId, workstreamId, workItemId: null },
      },
    ]);
  }
  if (
    request.method === "GET" &&
    url.pathname === `/api/v1/daily-work/projects/${projectId}/readiness`
  ) {
    return json(response, 200, {
      project: { id: projectId, name: "Atlas Delivery" },
      month: "2026-08",
      state: "attention",
      messageKey: "readiness.recordMayBeInsufficient",
      gaps: [
        {
          kind: "artifact_criterion_without_source",
          scopeId: workstreamId,
          scopeKind: "workstream",
          scopeName: "API readiness",
          correctiveAction: "attach_source",
        },
      ],
    });
  }
  if (request.method === "POST" && url.pathname === "/api/v1/updates/text") {
    const body = await readJson(request);
    if (body === null) return json(response, 400, { messageKey: "errors.validation" });
    currentUpdateContext = {
      projectId: body.projectId,
      workstreamId: body.workstreamId,
      workItemId: body.workItemId,
    };
    capturedUpdateSourceKinds = (body.sources ?? []).map((source) => source.kind);
    updateLocale = /[\u0600-\u06ff]/u.test(body.rawText) ? "ar" : "en";
    clarificationTurn = 1;
    updateDraftRevision = 1;
    if (!timelineItems.some((item) => item.id === "eb311111-1111-4111-8111-111111111111")) {
      timelineItems.unshift(aiDraftTimeline());
    }
    return json(response, 200, {
      state: "draft_with_question",
      sessionId: updateSessionId,
      sessionVersion: 2,
      draft: structuredDraft({
        summary: updateLocale === "ar" ? "تم تسجيل تحديث النشر." : "Deployment update recorded.",
        result:
          updateLocale === "ar"
            ? "تحتاج نتيجة فحص القبول إلى توضيح."
            : "The acceptance-check result still needs clarification.",
        nextAction:
          updateLocale === "ar"
            ? "توضيح نتيجة فحص القبول."
            : "Clarify the acceptance-check result.",
        documentationNeeds: [
          updateLocale === "ar" ? "نتيجة فحص القبول المعتمد" : "Approved acceptance-check result",
        ],
      }),
      turnId: firstTurnId,
      turnNumber: 1,
      question:
        updateLocale === "ar"
          ? "ما النتيجة القابلة للتحقق التي تحققت؟"
          : "What verifiable result was achieved?",
      affects: ["result", "progress_context"],
      remainingFieldCount: 2,
    });
  }
  if (request.method === "POST" && url.pathname === "/api/v1/voice-updates") {
    voiceRevision = 1;
    voiceTranscriptConfirmed = false;
    return json(response, 200, voiceSession());
  }
  if (
    request.method === "POST" &&
    url.pathname === `/api/v1/voice-updates/${voiceSessionId}/revisions`
  ) {
    const body = await readJson(request);
    if (body === null || typeof body.transcript !== "string") {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    voiceRevision += 1;
    voiceTranscript = body.transcript;
    return json(response, 200, voiceSession());
  }
  if (
    request.method === "POST" &&
    url.pathname === `/api/v1/voice-updates/${voiceSessionId}/confirm`
  ) {
    voiceTranscriptConfirmed = true;
    return json(response, 200, voiceSession());
  }
  if (request.method === "POST" && url.pathname === `/api/v1/updates/${updateSessionId}/answers`) {
    const body = await readJson(request);
    if (body === null) return json(response, 400, { messageKey: "errors.validation" });
    if (clarificationTurn === 1) {
      clarificationTurn = 2;
      updateDraftRevision = 2;
      return json(response, 200, {
        state: "draft_with_question",
        sessionId: updateSessionId,
        sessionVersion: 3,
        draft: structuredDraft({
          summary: updateLocale === "ar" ? "اكتمل فحص القبول." : "Acceptance check completed.",
          result:
            updateLocale === "ar"
              ? "نجحت 12 من 12 حالة قبول."
              : "All 12 acceptance scenarios passed.",
          nextAction:
            updateLocale === "ar"
              ? "إرفاق دليل النتيجة وتحديد خطوة الإغلاق."
              : "Attach the result evidence and define the closure step.",
          documentationNeeds:
            updateLocale === "ar"
              ? ["دليل نتيجة القبول", "اعتماد خطوة الإغلاق"]
              : ["Acceptance-result evidence", "Closure-step approval"],
        }),
        turnId: secondTurnId,
        turnNumber: 2,
        question:
          updateLocale === "ar"
            ? "ما الدليل الذي يثبت هذه النتيجة وما الخطوة التالية؟"
            : "What evidence supports this result, and what is the next step?",
        affects: ["evidence", "next_action"],
        remainingFieldCount: 1,
      });
    }
    updateDraftRevision = 3;
    return json(response, 200, {
      state: "ready_for_review",
      sessionId: updateSessionId,
      sessionVersion: 4,
      draft: structuredDraft(),
    });
  }
  if (request.method === "GET" && url.pathname === `/api/v1/updates/${updateSessionId}/draft`) {
    return json(response, 200, structuredDraft());
  }
  if (
    request.method === "POST" &&
    url.pathname === `/api/v1/updates/${updateSessionId}/revisions`
  ) {
    const body = await readJson(request);
    if (body === null) return json(response, 400, { messageKey: "errors.validation" });
    updateDraftRevision += 1;
    return json(response, 200, structuredDraft(body));
  }
  if (request.method === "POST" && url.pathname === `/api/v1/updates/${updateSessionId}/confirm`) {
    const draftIndex = timelineItems.findIndex(
      (item) => item.id === "eb311111-1111-4111-8111-111111111111",
    );
    if (draftIndex >= 0) timelineItems.splice(draftIndex, 1);
    if (!timelineItems.some((item) => item.id === acceptedUpdateId)) {
      timelineItems.unshift({
        id: acceptedUpdateId,
        kind: "update",
        projectId: currentUpdateContext.projectId,
        workstreamId: currentUpdateContext.workstreamId,
        workItemId: currentUpdateContext.workItemId,
        employeeId: ownerId,
        occurredAt: "2026-07-18T14:05:00.000Z",
        title:
          updateLocale === "ar"
            ? "اكتملت رحلة التحديث والأدلة"
            : "Update and evidence flow completed",
        detail:
          updateLocale === "ar"
            ? "نجحت 12 من 12 حالة قبول واتُفق على خطوة الإغلاق."
            : "All 12 acceptance scenarios passed and the closure step was agreed.",
        sourceReferences: [`update-source:${updateSourceId}`],
        sourceProvenance: "employee_mixed",
        reviewState: "employee_confirmed",
        project: { id: projectId, name: "Atlas Delivery" },
        workstream:
          currentUpdateContext.workstreamId === null
            ? null
            : { id: workstreamId, name: "API readiness" },
        workItem:
          currentUpdateContext.workItemId === null
            ? null
            : {
                id: currentUpdateContext.workItemId,
                title:
                  workItems.find((item) => item.id === currentUpdateContext.workItemId)?.title ??
                  "Delivery task",
              },
        relatedKpiComponents: [],
        relatedCriteria: [],
        verificationState: null,
        decisionOutcome: null,
      });
    }
    return json(response, 200, {
      id: acceptedUpdateId,
      updateSourceId,
      draftRevisionId,
      projectId: currentUpdateContext.projectId,
      workstreamId: currentUpdateContext.workstreamId,
      workItemId: currentUpdateContext.workItemId,
      employeeId: ownerId,
      confirmedAt: "2026-07-18T14:05:00.000Z",
      sourceReferences: [`update-source:${updateSourceId}`],
    });
  }
  if (request.method === "GET" && url.pathname === `/api/v1/updates/${acceptedUpdateId}/result`) {
    return json(response, 200, {
      acceptedEventId: acceptedUpdateId,
      project: { id: projectId, name: "Atlas Delivery" },
      workstream:
        currentUpdateContext.workstreamId === null
          ? null
          : { id: workstreamId, name: "API readiness" },
      workItem:
        currentUpdateContext.workItemId === null
          ? null
          : {
              id: currentUpdateContext.workItemId,
              title:
                workItems.find((item) => item.id === currentUpdateContext.workItemId)?.title ??
                "عنصر العمل",
            },
      summary:
        updateLocale === "ar"
          ? "اكتملت رحلة التحديث والأدلة"
          : "Update and evidence flow completed",
      result:
        updateLocale === "ar"
          ? "نجحت 12 من 12 حالة قبول متفق عليها."
          : "All 12 agreed acceptance scenarios passed.",
      sourceReferences: [`update-source:${updateSourceId}`],
      comparison: {
        previousAcceptedEventId: null,
        explanation:
          updateLocale === "ar"
            ? "هذا أول تحديث مؤكد للمشروع."
            : "This is the first confirmed update for the project.",
      },
      blocker: null,
      nextAction:
        updateLocale === "ar"
          ? "اعتماد الإغلاق مع مالك المنتج."
          : "Confirm closure with the product owner.",
      documentationNeeds:
        updateLocale === "ar" ? ["سجل اعتماد مالك المنتج"] : ["Product-owner approval record"],
      progressImpact: {
        state: "insufficient_information",
        missing:
          updateLocale === "ar" ? ["سجل اعتماد مالك المنتج"] : ["Product-owner approval record"],
      },
      confirmedAt: "2026-07-18T14:05:00.000Z",
    });
  }
  if (request.method === "POST" && url.pathname === "/api/v1/documents/uploads") {
    return json(response, 200, {
      id: uploadedSourceId,
      kind: "workstream",
      resourceId: workstreamId,
      filename: request.headers["x-document-filename"] ?? "acceptance-proof.png",
      detectedMime: request.headers["content-type"] ?? "image/png",
      detectedType: "png",
      byteSize: 128,
      sha256: "b".repeat(64),
      createdAt: "2026-07-18T14:00:00.000Z",
    });
  }
  if (request.method === "POST" && url.pathname === "/api/v1/evidence") {
    const body = await readJson(request);
    if (body === null) return json(response, 400, { messageKey: "errors.validation" });
    evidenceRevision = 1;
    latestEvidenceInput = body;
    return json(response, 200, evidenceDetail(body));
  }
  if (request.method === "POST" && url.pathname === "/api/v1/evidence/github-suggestions") {
    const body = await readJson(request);
    if (body === null) return json(response, 400, { messageKey: "errors.validation" });
    evidenceRevision = 1;
    latestEvidenceInput = {
      ...body,
      githubSourceEventId: body.sourceEventId,
      source: { kind: "url", url: "https://github.com/example/atlas/pull/125" },
    };
    return json(response, 200, evidenceDetail(latestEvidenceInput));
  }
  if (request.method === "GET" && url.pathname === `/api/v1/evidence/${evidenceId}`) {
    return json(response, 200, evidenceReview());
  }
  if (request.method === "POST" && url.pathname === `/api/v1/evidence/${evidenceId}/revisions`) {
    const body = await readJson(request);
    if (body === null) return json(response, 400, { messageKey: "errors.validation" });
    evidenceRevision += 1;
    latestEvidenceInput = { ...latestEvidenceInput, ...body };
    return json(response, 200, evidenceDetail(body));
  }
  if (request.method === "POST" && url.pathname === `/api/v1/evidence/${evidenceId}/confirm`) {
    if (!timelineItems.some((item) => item.id === acceptedEvidenceId)) {
      timelineItems.unshift({
        id: acceptedEvidenceId,
        kind: "evidence",
        projectId,
        workstreamId,
        workItemId: workItems[0].id,
        employeeId: ownerId,
        occurredAt: "2026-07-18T14:04:00.000Z",
        title:
          updateLocale === "ar"
            ? "نجحت سيناريوهات القبول المتفق عليها"
            : "The agreed acceptance scenarios passed",
        detail:
          updateLocale === "ar"
            ? "نفذت السيناريوهات وراجعت سجل الاختبار."
            : "The employee ran the scenarios and reviewed the test log.",
        sourceReferences: [`evidence:${evidenceId}`],
        sourceProvenance:
          latestEvidenceInput.githubSourceEventId === undefined
            ? "employee_code"
            : "github_automated",
        reviewState: "employee_confirmed",
        project: { id: projectId, name: "Atlas Delivery" },
        workstream: { id: workstreamId, name: "API readiness" },
        workItem: { id: workItems[0].id, title: workItems[0].title },
        relatedKpiComponents: [
          { id: "e3333333-3333-4333-8333-333333333333", name: "Acceptance readiness" },
        ],
        relatedCriteria: [],
        verificationState: "unverified",
        decisionOutcome: null,
      });
    }
    return json(response, 200, {
      id: acceptedEvidenceId,
      evidenceId,
      projectId,
      workstreamId,
      sourceReferences: [`evidence:${evidenceId}`],
      confirmedAt: "2026-07-18T14:04:00.000Z",
    });
  }
  if (request.method === "POST" && url.pathname === `/api/v1/evidence/${evidenceId}/reject`) {
    return json(response, 200, { ...evidenceDetail({}), state: "rejected" });
  }
  if (request.method === "GET" && url.pathname === "/api/v1/timeline") {
    return json(response, 200, { items: timelineItems, nextCursor: null });
  }
  if (request.method === "GET" && url.pathname === `/api/v1/projects/${projectId}/workspace`) {
    return json(response, 200, { project, people, workstreams: [workstream] });
  }
  if (
    request.method === "GET" &&
    url.pathname === `/api/v1/projects/${dogfoodProjectId}/workspace`
  ) {
    return json(response, 200, { project: dogfoodProject, people, workstreams: [] });
  }
  if (
    request.method === "GET" &&
    url.pathname === `/api/v1/projects/${projectId}/workstreams/${historicalWorkstreamId}/workspace`
  ) {
    return json(response, 403, { messageKey: "errors.forbidden" });
  }
  if (
    request.method === "GET" &&
    url.pathname === `/api/v1/projects/${projectId}/workstreams/${workstreamId}/workspace`
  ) {
    return json(response, 200, { workstream, people });
  }
  if (request.method === "GET" && url.pathname === "/api/v1/documents/resource") {
    const kind = url.searchParams.get("kind");
    const resourceId = url.searchParams.get("resourceId");
    if (kind === "project" && resourceId === projectId) {
      return json(response, 200, document("project"));
    }
    if (kind === "workstream" && resourceId === workstreamId) {
      return json(response, 200, document("workstream"));
    }
    if (kind === "project" && resourceId === dogfoodProjectId) {
      return json(response, 200, null);
    }
    return json(response, 404, { messageKey: "errors.notFound" });
  }
  if (
    request.method === "GET" &&
    /^\/api\/v1\/documents\/[0-9a-f-]+\/readiness-checks\/latest$/u.test(url.pathname)
  ) {
    return json(response, 403, { messageKey: "errors.forbidden" });
  }
  if (
    request.method === "GET" &&
    /^\/api\/v1\/documents\/[0-9a-f-]+\/readiness-checks\/latest\/operational-state$/u.test(
      url.pathname,
    )
  ) {
    return json(response, 200, { state: "needs_attention" });
  }
  if (request.method === "GET" && url.pathname === "/api/v1/dynamic-criteria/workspace") {
    const kind = url.searchParams.get("kind");
    const resourceId = url.searchParams.get("resourceId");
    if (kind === "project" && resourceId === projectId) {
      return json(response, 200, projectCriteria);
    }
    if (kind === "workstream" && resourceId === workstreamId) {
      return json(response, 200, workstreamCriteria);
    }
    if (kind === "workstream" && resourceId === historicalWorkstreamId) {
      return json(response, 200, historicalWorkstreamCriteria);
    }
    if (kind === "project" && resourceId === dogfoodProjectId) {
      return json(response, 200, projectCriteria);
    }
    return json(response, 404, { messageKey: "errors.notFound" });
  }
  if (
    request.method === "POST" &&
    (url.pathname === "/api/v1/dynamic-criteria/proposals" ||
      /^\/api\/v1\/dynamic-criteria\/[0-9a-f-]+\/(?:owner-reviews|publish|responses|manager-resolutions|activate)$/u.test(
        url.pathname,
      ))
  ) {
    const body = await readJson(request);
    if (body === null) return json(response, 400, { messageKey: "errors.validation" });
    if (url.pathname === `/api/v1/dynamic-criteria/${proposalId}/responses`) {
      if (workstreamCriteria.proposal.viewerResponse !== null) {
        return json(response, 409, { messageKey: "errors.validation" });
      }
      if (body.action !== "acknowledge" && body.action !== "object") {
        return json(response, 400, { messageKey: "errors.validation" });
      }
      workstreamCriteria.proposal.viewerResponse = {
        action: body.action,
        reason: body.action === "object" ? body.reason : null,
      };
      workstreamCriteria.proposal.completedResponses = 2;
      if (body.action === "object") workstreamCriteria.proposal.objectionCount += 1;
      workstreamCriteria.allowedActions = [];
    }
    return json(response, 200, { accepted: true });
  }
  return json(response, 404, { messageKey: "errors.notFound" });
});

server.listen(Number(process.env.E2E_API_PORT ?? "3101"), "127.0.0.1");

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function empty(response, status) {
  response.writeHead(status, { "cache-control": "no-store" });
  response.end();
}

function evaluationFactView() {
  const responsibilitySource = {
    sourceType: "responsibility_window",
    sourceId: responsibilityFactId,
    sourceVersion: 1,
    occurredAt: "2026-07-01T06:00:00.000Z",
    url: null,
  };
  const contributionSource = {
    sourceType: "github_event",
    sourceId: acceptedUpdateId,
    sourceVersion: 1,
    occurredAt: "2026-07-20T09:00:00.000Z",
    url: "https://github.com/example/atlas/pull/42",
  };
  const evidenceSource = {
    sourceType: "evidence",
    sourceId: acceptedEvidenceId,
    sourceVersion: 1,
    occurredAt: "2026-07-20T09:05:00.000Z",
    url: "https://github.com/example/atlas/actions/runs/42",
  };
  const criterionSource = {
    sourceType: "criterion_version",
    sourceId: criterionFactId,
    sourceVersion: 2,
    occurredAt: "2026-07-01T06:00:00.000Z",
    url: null,
  };

  return {
    schemaVersion: 2,
    cycle: {
      id: evaluationCycleId,
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-09-30T23:59:59.000Z",
      rubricVersionId: evaluationRubricVersionId,
    },
    subjectEmployeeId: ownerId,
    generatedAt: "2026-08-05T09:00:00.000Z",
    responsibilityWindows: [
      {
        kind: "source_fact",
        sourceType: "responsibility_window",
        sourceId: responsibilityFactId,
        sourceOccurredAt: responsibilitySource.occurredAt,
        projectId,
        workstreamId: null,
        sourceReferences: [responsibilitySource],
        responsibilityType: "original_owner",
        startedAt: "2026-07-01T06:00:00.000Z",
        endedAt: null,
      },
    ],
    projectFacts: [
      {
        kind: "source_fact",
        sourceType: "project_contribution",
        sourceId: contributionFactId,
        sourceOccurredAt: contributionSource.occurredAt,
        projectId,
        workstreamId,
        sourceReferences: [contributionSource],
        relatedWorkItemId: null,
        criterionStableId: "project-delivery-quality",
        criterionVersionId: criterionFactId,
        summary: "Release acceptance checks completed and linked to the Project.",
        result: "The approved acceptance suite passed with traceable source evidence.",
        verificationState: "source_supported",
        attributionState: "employee_confirmed",
        responsibilityWindowIds: [responsibilityFactId],
      },
    ],
    confirmedEvidence: [
      {
        kind: "source_fact",
        sourceType: "confirmed_evidence",
        sourceId: acceptedEvidenceId,
        sourceOccurredAt: evidenceSource.occurredAt,
        projectId,
        workstreamId,
        sourceReferences: [evidenceSource],
        relatedWorkItemId: null,
        relatedCriterionStableId: "project-delivery-quality",
        supportedClaim: "The acceptance suite passed for the approved release scope.",
        contributionContext: "Codex confirmed this GitHub suggestion before it became evidence.",
        verificationState: "source_supported",
        attributionState: "employee_confirmed",
      },
    ],
    checkInFacts: [],
    dynamicCriteriaVersions: [
      {
        kind: "source_fact",
        sourceType: "criterion_version",
        sourceId: criterionFactId,
        sourceOccurredAt: criterionSource.occurredAt,
        projectId,
        workstreamId: null,
        sourceReferences: [criterionSource],
        criterionStableId: "project-delivery-quality",
        criterionVersionId: criterionFactId,
        locale: "en",
        name: "Deliver the approved release with traceable acceptance evidence",
        effectiveFrom: "2026-07-01T06:00:00.000Z",
        effectiveUntil: null,
      },
    ],
    researchFacts: researchConfirmed
      ? [
          {
            kind: "source_fact",
            sourceType: "research",
            factType: "research_decision",
            sourceId: "f3888888-8888-4888-8888-888888888888",
            sourceOccurredAt: "2026-08-06T14:30:00.000Z",
            projectId,
            workstreamId,
            relatedWorkItemId: workItems[0].id,
            humanConfirmationState: "human_decision",
            verificationState: "source_supported",
            responsibilityWindowIds: [],
            summary: "The employee confirmed the bounded retrieval decision.",
            limitations: ["The deterministic fixture does not represent production traffic."],
            uncertainty: "Production-scale latency remains to be observed.",
            sourceReferences: [
              {
                sourceType: "research_conclusion",
                sourceId: "f3999999-9999-4999-8999-999999999999",
                sourceVersion: null,
                occurredAt: "2026-08-06T14:30:00.000Z",
                url: null,
              },
            ],
          },
          {
            kind: "source_fact",
            sourceType: "research",
            factType: "applied_learning",
            sourceId: "f3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            sourceOccurredAt: "2026-08-06T14:35:00.000Z",
            projectId,
            workstreamId,
            relatedWorkItemId: workItems[0].id,
            humanConfirmationState: "employee_confirmed",
            verificationState: "source_supported",
            responsibilityWindowIds: [],
            summary: "Applied learning linked the confirmed decision to an existing Task.",
            limitations: [],
            uncertainty: null,
            sourceReferences: [
              {
                sourceType: "applied_learning",
                sourceId: "f3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                sourceVersion: null,
                occurredAt: "2026-08-06T14:35:00.000Z",
                url: null,
              },
            ],
          },
        ]
      : [],
    employeeInterpretations: [
      {
        kind: "employee_interpretation",
        id: interpretationId,
        originalText: "I resolved the release risk and confirmed the acceptance evidence.",
        normalizedText:
          "Employee interpretation: release risk was resolved and evidence confirmed.",
        sourceFactIds: [contributionFactId, acceptedEvidenceId],
        createdAt: "2026-07-20T09:15:00.000Z",
      },
    ],
    sourceCoverageNotes: [
      {
        kind: "coverage_note",
        code: "partial_period",
        scope: "cycle",
        projectId,
        workstreamId: null,
        messageKey: "evaluationFacts.coverage.partialPeriod",
        sourceFactIds: [responsibilityFactId],
        neutral: true,
      },
    ],
  };
}

function employeeEvaluationJourney(audience) {
  const factView = evaluationFactView();
  const entry = {
    criterionId: "project-contribution",
    rating: 3,
    justification: "The human reviewer recorded a source-linked assessment.",
  };
  return {
    schemaVersion: 1,
    audience,
    cycle: {
      id: evaluationCycleId,
      type: "CALIBRATION_NON_BASELINE",
      state: "CLOSED",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-09-30T23:59:59.000Z",
      version: 8,
    },
    assignment: {
      id: evaluationAssignmentId,
      employeeId: ownerId,
      managerId: evaluationManagerId,
      version: 7,
    },
    templateSnapshot: { schemaVersion: 1, localeAvailability: ["en"] },
    factViewFirst: {
      responsibilityWindows: factView.responsibilityWindows,
      workFacts: [...factView.projectFacts, ...factView.confirmedEvidence],
      researchFacts: factView.researchFacts,
      sourceCoverageNotes: factView.sourceCoverageNotes,
    },
    submissions: [
      {
        kind: "SELF",
        submittedAt: "2026-08-01T09:00:00.000Z",
        entries: [entry],
      },
      {
        kind: "MANAGER_INITIAL",
        submittedAt: "2026-08-01T10:00:00.000Z",
        entries: [entry],
      },
    ],
    comparison: { schemaVersion: 1, rows: [{ criterionId: entry.criterionId }] },
    discussion: [
      {
        id: "ed111111-1111-4111-8111-111111111111",
        body: "The employee and manager discussed the source-supported delivery context.",
        sourceReferences: [],
        createdAt: "2026-08-02T09:00:00.000Z",
      },
    ],
    finalDecision: {
      humanManagerDecision: true,
      entries: [entry],
      finalComment: "Final rating recorded by the assigned human manager.",
      finalizedAt: "2026-08-03T09:00:00.000Z",
    },
    acknowledgment: {
      kind: "ACKNOWLEDGED_WITH_RESERVATION",
      reservation: "Employee asked that delivery constraints remain on record.",
      recordedAt: "2026-08-04T09:00:00.000Z",
    },
    immutableClosedSnapshot: {
      id: evaluationSnapshotId,
      schemaVersion: 2,
      closedAt: "2026-08-05T09:00:00.000Z",
    },
    independenceGate: { managerSubmittedBeforeSelfProjection: true },
  };
}

function identifiedManagerEvaluationView() {
  const responseId = "ed222222-2222-4222-8222-222222222222";
  return {
    schemaVersion: 1,
    cycleId: managerEvaluationCycleId,
    managerId: evaluationManagerId,
    visibilityMode: "IDENTIFIED",
    period: { startsAt: "2026-07-01T00:00:00.000Z", endsAt: "2026-10-01T00:00:00.000Z" },
    completion: {
      schemaVersion: 1,
      cycleId: managerEvaluationCycleId,
      managerId: evaluationManagerId,
      visibilityMode: "IDENTIFIED",
      eligible: 3,
      submitted: 1,
      pending: 1,
      approvedLeave: 1,
      postponed: 0,
      excluded: 0,
      entries: [
        {
          evaluatorId: ownerId,
          evaluatorDisplayName: "Sarah Ahmed",
          state: "SUBMITTED",
          responseId,
          submittedAt: "2026-08-05T09:00:00.000Z",
        },
        {
          evaluatorId: contributorId,
          evaluatorDisplayName: "Omar Ali",
          state: "ELIGIBLE_PENDING",
          responseId: null,
          submittedAt: null,
        },
        {
          evaluatorId: "ed333333-3333-4333-8333-333333333333",
          evaluatorDisplayName: "Lina Salem",
          state: "APPROVED_LEAVE",
          responseId: null,
          submittedAt: null,
        },
      ],
      generatedAt: "2026-08-05T09:05:00.000Z",
    },
    responses: [
      {
        schemaVersion: 1,
        responseId,
        cycleId: managerEvaluationCycleId,
        managerId: evaluationManagerId,
        submitterId: ownerId,
        submitterDisplayName: "Sarah Ahmed",
        visibilityMode: "IDENTIFIED",
        state: "SUBMITTED",
        submittedAt: "2026-08-05T09:00:00.000Z",
        responses: [
          {
            criterionId: "ed444444-4444-4444-8444-444444444444",
            rating: 4,
            comment: "Priorities were clear during the delivery period.",
          },
          {
            criterionId: "ed555555-5555-4555-8555-555555555555",
            rating: 3,
            comment: "More context before scope changes would help.",
          },
          {
            criterionId: "ed666666-6666-4666-8666-666666666666",
            rating: 4,
            comment: "Decisions were timely.",
          },
          {
            criterionId: "ed777777-7777-4777-8777-777777777777",
            rating: 4,
            comment: "The manager supported cross-team work.",
          },
          {
            criterionId: "ed888888-8888-4888-8888-888888888888",
            rating: 3,
            comment: "More regular development conversations would help.",
          },
        ],
      },
    ],
    summaryRevision: null,
    generatedAt: "2026-08-05T09:05:00.000Z",
  };
}

function resetContextAcceptanceState() {
  contextAiAvailable = true;
  connectedWorkConnected = true;
  workItems.splice(0, workItems.length, ...baseWorkItems);
  privateInboxItems.splice(0, privateInboxItems.length, ...structuredClone(basePrivateInboxItems));
  experienceReceipts.splice(0, experienceReceipts.length);
  connectedWorkItems.splice(
    0,
    connectedWorkItems.length,
    ...structuredClone(baseConnectedWorkItems),
  );
  contextReviewItems.splice(
    0,
    contextReviewItems.length,
    ...structuredClone(baseContextReviewItems),
  );
}

function resetResearchAcceptanceState() {
  researchAiAvailable = true;
  researchConfirmed = false;
  for (let index = timelineItems.length - 1; index >= 0; index -= 1) {
    if (["research", "experiment", "applied_learning"].includes(timelineItems[index].kind)) {
      timelineItems.splice(index, 1);
    }
  }
}

function confirmResearchCheckpoint() {
  if (researchConfirmed) return;
  researchConfirmed = true;
  timelineItems.unshift(
    researchTimelineItem({
      id: "f3bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      kind: "applied_learning",
      occurredAt: "2026-08-06T14:35:00.000Z",
      title: "Applied learning linked to an existing Task",
      detail: "The confirmed result changed the existing implementation Task.",
      sourceReference: "applied-learning:f3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    researchTimelineItem({
      id: "f3cccccc-cccc-4ccc-8ccc-cccccccccccc",
      kind: "research",
      occurredAt: "2026-08-06T14:30:00.000Z",
      title: "Research decision confirmed",
      detail: "The employee adopted the bounded cited approach and retained the failed result.",
      sourceReference: "research-conclusion:f3999999-9999-4999-8999-999999999999",
    }),
  );
}

function researchTimelineItem({ id, kind, occurredAt, title, detail, sourceReference }) {
  return {
    id,
    kind,
    projectId,
    workstreamId,
    workItemId: workItems[0].id,
    employeeId: ownerId,
    occurredAt,
    title,
    detail,
    sourceReferences: [sourceReference],
    sourceProvenance: "human_decision",
    reviewState: "human_decision",
    project: { id: projectId, name: "Atlas Delivery" },
    workstream: { id: workstreamId, name: "API readiness" },
    workItem: { id: workItems[0].id, title: workItems[0].title },
    relatedKpiComponents: [],
    relatedCriteria: [],
    verificationState: null,
    decisionOutcome: null,
  };
}

function researchCheckpoint() {
  if (!researchConfirmed) {
    return {
      research: null,
      experiments: [],
      evidence: null,
      appliedLearning: null,
      officialTaskCount: 0,
    };
  }
  return {
    research: { id: researchId, state: "CONCLUDED", decisionConfirmed: true },
    experiments: [
      { id: unsupportedExperimentId, outcome: "NOT_SUPPORTED", retained: true },
      {
        id: supportedExperimentId,
        outcome: "SUPPORTED",
        baselinePinned: true,
        measuresPinned: true,
        testCasesPinned: true,
        limitationsPinned: true,
      },
    ],
    evidence: { state: "CONFIRMED" },
    appliedLearning: { targetKind: "WORK_ITEM" },
    officialTaskCount: 0,
  };
}

function researchSourceReview(state = "READY_FOR_REVIEW", version = 2) {
  return {
    id: researchReviewId,
    scope: { projectId, workstreamId: null, workItemId: null },
    ownerId,
    state,
    version,
    source: { kind: "URL", url: "https://github.com/example/atlas-research" },
    displayUrl: "https://github.com/example/atlas-research",
    retrievalState: "RETRIEVED",
    retrievalReason: null,
    contentFingerprint: "sha256:research-e2e-fixture",
    output: {
      schemaVersion: "research-source-review-output.v1",
      summary: "Cited Project relevance review",
      relevance: "The repository directly addresses the Project retrieval decision.",
      citations: [
        {
          sourceReference: "retrieved-source:atlas-research",
          locator: "README#retrieval",
        },
      ],
      benefits: ["Provides a bounded implementation pattern to test."],
      risks: ["Repository behavior may differ from the Project environment."],
      mismatches: ["The source does not cover production-scale latency."],
      uncertainties: ["Long-term behavior remains unknown."],
      disposition: "OPEN_OR_REFINE_RESEARCH",
      proposals: [
        {
          id: researchProposalId,
          kind: "RESEARCH",
          title: "Evaluate bounded retrieval",
          rationale: "The source maps to the approved Project question.",
          sourceReferences: ["retrieved-source:atlas-research"],
          question: "Does bounded retrieval improve grounded answers?",
          objective: "Choose a reproducible Project approach.",
        },
        {
          id: experimentProposalId,
          kind: "EXPERIMENT",
          title: "Compare retrieval approaches",
          rationale: "A controlled comparison can expose benefit and limitations.",
          sourceReferences: ["retrieved-source:atlas-research"],
          question: "Which approach meets the grounded-answer threshold?",
          baseline: "Current Project-approved baseline",
          measureNames: ["Grounded answer ratio"],
        },
        {
          id: workItemProposalId,
          kind: "WORK_ITEM",
          title: "Replace retrieval immediately",
          rationale: "This proposal is intentionally unsuitable before experiments conclude.",
          sourceReferences: ["retrieved-source:atlas-research"],
          description: "Replace the current approach without a confirmed experiment.",
          proposedAssigneeId: ownerId,
          acceptanceConditions: ["Employee confirms the source-supported change"],
        },
      ],
    },
    outputProvenance: {
      promptVersion: "research-source-review.v1",
      routeTrace: {
        aiRunId: "f3dddddd-dddd-4ddd-8ddd-dddddddddddd",
        routeKey: "research.source-review.v1",
        routeConfigId: "f3eeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        routeConfigVersion: 1,
      },
    },
    recoveryOptions: [],
    createdAt: "2026-08-06T14:00:00.000Z",
    updatedAt: "2026-08-06T14:00:00.000Z",
  };
}

function researchDetail() {
  return {
    detail: {
      id: researchId,
      scope: { projectId, workstreamId, workItemId: workItems[0].id },
      ownerId,
      state: "CONCLUDED",
      revision: 1,
      version: 3,
      currentRevision: {
        id: "f3fffff1-ffff-4fff-8fff-fffffffffff1",
        revision: 1,
        question: "Does bounded retrieval improve grounded answers?",
        objective: "Choose a reproducible Project approach.",
      },
    },
    participantEvents: [],
    transitions: [],
    sourceReferences: [
      {
        id: "f3fffff2-ffff-4fff-8fff-fffffffffff2",
        title: "Atlas retrieval reference",
        canonicalUrl: "https://github.com/example/atlas-research",
      },
    ],
  };
}

function experimentDetail(kind) {
  const unsupported = kind === "unsupported";
  const experimentId = unsupported ? unsupportedExperimentId : supportedExperimentId;
  const summary = unsupported
    ? "The approach omitted required citations and did not meet the pinned threshold."
    : "The bounded cited approach met the pinned threshold.";
  return {
    detail: {
      id: experimentId,
      researchId,
      scope: { projectId, workstreamId, workItemId: workItems[0].id },
      title: unsupported ? "Unsupported retrieval shortcut" : "Bounded retrieval with citations",
      state: "CONCLUDED",
      methodRevision: 1,
      version: 5,
      currentMethod: {
        id: unsupported
          ? "f3fffff3-ffff-4fff-8fff-fffffffffff3"
          : "f3fffff4-ffff-4fff-8fff-fffffffffff4",
        revision: 1,
        question: "Does the approach meet the grounded-answer threshold?",
        baseline: {
          description: "Current Project-approved baseline",
          value: "0.70",
          sourceReference: null,
        },
        measures: [],
        testCases: [],
        controls: [],
        conditions: [],
        reproducibilityInstructions: "Run the pinned fixture with the recorded inputs.",
        knownRisks: [],
        failureCases: [],
        sourceReferences: ["retrieved-source:atlas-research"],
        executionMode: "manual",
        origin: "EMPLOYEE",
        aiRunId: null,
        promptVersion: null,
        routeTrace: null,
        authorId: ownerId,
        createdAt: "2026-08-06T14:00:00.000Z",
      },
    },
    methodRevisions: [],
    runs: [
      {
        id: unsupported
          ? "f3fffff5-ffff-4fff-8fff-fffffffffff5"
          : "f3fffff6-ffff-4fff-8fff-fffffffffff6",
        resultStatus: unsupported ? "FAILED" : "COMPLETED",
        executionNotes: summary,
      },
    ],
    aiDrafts: [],
    conclusions: [
      {
        id: unsupported
          ? "f3fffff7-ffff-4fff-8fff-fffffffffff7"
          : "f3fffff8-ffff-4fff-8fff-fffffffffff8",
        summary,
        limitations: ["Deterministic acceptance fixture only"],
      },
    ],
  };
}

function resetSliceFourAcceptanceState() {
  clarificationTurn = 0;
  updateDraftRevision = 1;
  evidenceRevision = 1;
  voiceRevision = 1;
  voiceTranscript = "The automated GitHub checks passed and the closure evidence is attached.";
  voiceTranscriptConfirmed = false;
  latestEvidenceInput = {};
  capturedUpdateSourceKinds = [];
  officialProjectProgressPercent = 62.5;
  ambiguousProgressReviewQueued = false;
  employeePerformanceWrites = [];
  currentUpdateContext = { projectId, workstreamId: null, workItemId: null };
  timelineItems.splice(0, timelineItems.length, ...initialSliceFourTimeline());
}

function resetSliceFiveAcceptanceState() {
  dogfoodDraftRevision = 1;
  dogfoodContractState = null;
  dogfoodContractVersion = 0;
}

function managerOperations() {
  return {
    approvalsWaiting: [
      {
        id: "f1111111-1111-4111-8111-111111111111",
        projectId: dogfoodProjectId,
        projectName: "Evidence Performance System — Phase 2",
        detailKey: "approval_waiting",
      },
    ],
    blockedProjects: [
      {
        id: "f2222222-2222-4222-8222-222222222222",
        projectId,
        projectName: "Atlas Delivery",
        detailKey: "project_paused",
      },
    ],
    ambiguousProgressEvidence: [
      {
        id: "f3333333-3333-4333-8333-333333333333",
        projectId,
        projectName: "Atlas Delivery",
        label: "Release evidence needs one owner decision",
        detailKey: "progress_source_ambiguous",
      },
    ],
    ownershipGaps: [
      {
        id: "f4444444-4444-4444-8444-444444444444",
        projectId,
        projectName: "Atlas Delivery",
        detailKey: "ownership_missing",
      },
    ],
    upcomingCommitments: [
      {
        id: "f5555555-5555-4555-8555-555555555555",
        projectId,
        projectName: "Atlas Delivery",
        label: "Product owner acceptance",
        detailKey: "commitment_upcoming",
        dueAt: "2026-08-07T12:00:00.000Z",
      },
    ],
    readinessHref: "/manager/readiness",
    evaluationHref: "/manager/evaluations",
  };
}

function initialSliceFourTimeline(includeExamples = false) {
  return includeExamples
    ? [
        {
          id: "eb111111-1111-4111-8111-111111111111",
          kind: "project_fact",
          projectId,
          workstreamId: null,
          workItemId: null,
          employeeId: null,
          occurredAt: "2026-07-18T13:00:00.000Z",
          title: "Required checks passed",
          detail:
            "A verified GitHub check suite matched one measurable rule in the active Progress Contract.",
          sourceReferences: ["github-source-event:eb211111-1111-4111-8111-111111111111"],
          sourceProvenance: "github_automated",
          reviewState: "automated_project_fact",
          project: { id: projectId, name: "Atlas Delivery" },
          workstream: null,
          workItem: null,
          relatedKpiComponents: [
            { id: "e3333333-3333-4333-8333-333333333333", name: "Acceptance readiness" },
          ],
          relatedCriteria: [],
          verificationState: null,
          decisionOutcome: null,
        },
        {
          id: "eb311111-1111-4111-8111-111111111111",
          kind: "update",
          projectId,
          workstreamId: null,
          workItemId: null,
          employeeId: ownerId,
          occurredAt: "2026-07-18T13:01:00.000Z",
          title: "AI-prepared closure draft",
          detail: "Private draft awaiting the employee's review and confirmation.",
          sourceReferences: ["update-source:eb411111-1111-4111-8111-111111111111"],
          sourceProvenance: "employee_mixed",
          reviewState: "ai_draft",
          project: { id: projectId, name: "Atlas Delivery" },
          workstream: null,
          workItem: null,
          relatedKpiComponents: [],
          relatedCriteria: [],
          verificationState: null,
          decisionOutcome: null,
        },
        {
          id: "eb511111-1111-4111-8111-111111111111",
          kind: "decision",
          projectId,
          workstreamId: null,
          workItemId: null,
          employeeId: ownerId,
          occurredAt: "2026-07-18T13:02:00.000Z",
          title: "Project owner kept official progress at 42%",
          detail:
            "An ambiguous GitHub event remains queued for review; raw commit and file volume did not change progress.",
          sourceReferences: ["progress-human-confirmation:eb611111-1111-4111-8111-111111111111"],
          sourceProvenance: "human_decision",
          reviewState: "human_decision",
          project: { id: projectId, name: "Atlas Delivery" },
          workstream: null,
          workItem: null,
          relatedKpiComponents: [
            { id: "e3333333-3333-4333-8333-333333333333", name: "Acceptance readiness" },
          ],
          relatedCriteria: [],
          verificationState: null,
          decisionOutcome: "not_satisfied",
        },
      ]
    : [];
}

function githubProjectFact() {
  return structuredClone(initialSliceFourTimeline(true)[0]);
}

function aiDraftTimeline() {
  return structuredClone(initialSliceFourTimeline(true)[1]);
}

function ownerProgressDecision(sourceRef, satisfied) {
  const decision = structuredClone(initialSliceFourTimeline(true)[2]);
  decision.title = `Project owner kept official progress at ${officialProjectProgressPercent}%`;
  decision.sourceReferences = [sourceRef];
  decision.decisionOutcome = satisfied ? "satisfied" : "not_satisfied";
  return decision;
}

function voiceSession() {
  return {
    sessionId: voiceSessionId,
    state: voiceTranscriptConfirmed ? "transcript_confirmed" : "transcript_ready",
    transcript: voiceTranscript,
    revision: voiceRevision,
    language: "en",
    dialect: "english",
    transcriptConfirmed: voiceTranscriptConfirmed,
  };
}

function structuredDraft(overrides = {}) {
  const isArabic = updateLocale === "ar";
  return {
    id: draftRevisionId,
    sessionId: updateSessionId,
    revision: updateDraftRevision,
    summary:
      overrides.summary ??
      (isArabic ? "اكتملت رحلة التحديث والأدلة" : "Update and evidence flow completed"),
    result:
      overrides.result ??
      (isArabic
        ? "نجحت 12 من 12 حالة قبول متفق عليها."
        : "All 12 agreed acceptance scenarios passed."),
    blocker: overrides.blocker ?? null,
    nextAction:
      overrides.nextAction ??
      (isArabic ? "اعتماد الإغلاق مع مالك المنتج." : "Confirm closure with the product owner."),
    contributionContext:
      overrides.contributionContext ??
      (isArabic
        ? "نفذت السيناريوهات وراجعت النتائج."
        : "Ran the scenarios and reviewed the results."),
    executionMode: updateDraftRevision === 1 ? "ai_assisted" : "mixed",
    sourceReferences: [
      `update-source:${updateSourceId}`,
      `accepted-update-event:e4444444-4444-4444-8444-444444444444`,
      `progress-component:e3333333-3333-4333-8333-333333333333`,
    ],
    evidenceIds: [],
    documentationNeeds:
      overrides.documentationNeeds ??
      (isArabic ? ["سجل اعتماد مالك المنتج"] : ["Product-owner approval record"]),
    relatedProgressComponentIds: ["e3333333-3333-4333-8333-333333333333"],
    comparison: {
      previousAcceptedEventId: "e4444444-4444-4444-8444-444444444444",
      changedFields: ["result", "nextAction"],
      explanation: isArabic
        ? "ارتفعت النتيجة من مسودة غير مكتملة إلى 12 حالة قبول ناجحة."
        : "The result moved from an incomplete draft to 12 passing acceptance scenarios.",
    },
  };
}

function evidenceDetail(overrides) {
  const sourceKind = overrides.source?.kind ?? latestEvidenceInput.source?.kind ?? "cli_snapshot";
  return {
    id: evidenceId,
    revisionId: evidenceRevisionId,
    projectId,
    workstreamId,
    workItemId: workItems[0].id,
    state: "draft",
    revision: evidenceRevision,
    revisionKind:
      evidenceRevision === 1
        ? latestEvidenceInput.githubSourceEventId === undefined
          ? "manual_draft"
          : "ai_draft"
        : "employee_edit",
    sourceKind,
    supportedClaim: overrides.supportedClaim ?? "نجحت سيناريوهات القبول المتفق عليها.",
    contributionContext: overrides.contributionContext ?? "نفذت السيناريوهات وراجعت النتيجة.",
    executionMode: latestEvidenceInput.githubSourceEventId === undefined ? "manual" : "ai_assisted",
  };
}

function evidenceReview() {
  const detail = evidenceDetail(latestEvidenceInput);
  const source = latestEvidenceInput.source ?? {};
  return {
    ...detail,
    sourceText: typeof source.text === "string" ? source.text : null,
    sourceUrl: typeof source.url === "string" ? source.url : null,
    mediaType: "uploadedSourceId" in source ? "application/octet-stream" : null,
    sourceProvenance:
      latestEvidenceInput.githubSourceEventId !== undefined
        ? "github_automated"
        : detail.sourceKind === "pasted_text"
          ? "employee_text"
          : detail.sourceKind === "url"
            ? "employee_url"
            : ["pasted_code", "cli_snapshot"].includes(detail.sourceKind)
              ? "employee_code"
              : "employee_file",
    project: { id: projectId, name: "Atlas Delivery" },
    workstream: { id: workstreamId, name: "API readiness" },
    workItem: { id: workItems[0].id, title: workItems[0].title },
    relatedKpiComponents: [
      { id: "e3333333-3333-4333-8333-333333333333", name: "Acceptance readiness" },
    ],
    relatedCriteria: [],
    verificationState: evidenceRevision > 1 ? "supported" : "pending",
  };
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}
