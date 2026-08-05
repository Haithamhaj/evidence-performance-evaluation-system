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
const ownerAccessToken = "e2e-access-token";
const managerAccessToken = "e2e-manager-access-token";
const otherEmployeeAccessToken = "e2e-other-employee-access-token";
const connectedWorkAccessTokens = new Set([
  ownerAccessToken,
  managerAccessToken,
  otherEmployeeAccessToken,
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
  name: "Evidence Performance System — Phase 2",
  description: "Real Codex employee acceptance Project.",
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
  };
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
    status: "open",
    promotedWorkItemId: null,
    version: 1,
    createdAt: "2026-07-20T07:30:00.000Z",
    updatedAt: "2026-07-20T07:30:00.000Z",
  },
];

const baseWorkItems = [...workItems];
const basePrivateInboxItems = structuredClone(privateInboxItems);
const baseConnectedWorkItems = structuredClone(connectedWorkItems);

function dailyWorkspace() {
  return {
    needsMyAction: myWork.groups[0].items,
    today: myWork.groups[1].items,
    overdue: myWork.groups[2].items,
    reviewQueue: [],
    inbox: privateInboxItems.filter(({ status }) => status === "open"),
    projectPulse: [
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
    name: "Evidence Performance System — Phase 2",
    description: "Real Codex employee acceptance Project.",
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
  const accessToken = request.headers.authorization?.replace(/^Bearer /u, "") ?? "";
  if (!connectedWorkAccessTokens.has(accessToken)) {
    return json(response, 401, { messageKey: "errors.unauthorized" });
  }

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
  if (request.method === "GET" && url.pathname === "/api/v1/me") {
    return json(response, 200, { userId: ownerId });
  }
  if (request.method === "GET" && url.pathname === "/api/v1/daily-work/my-work") {
    return json(response, 200, dailyWorkspace());
  }
  if (request.method === "GET" && url.pathname === "/api/v1/work-items") {
    return json(response, 200, {
      view: url.searchParams.get("view") ?? "my",
      layout: url.searchParams.get("layout") ?? "list",
      items: workItems,
      nextCursor: null,
    });
  }
  if (request.method === "GET" && url.pathname === "/api/v1/daily-work/projects") {
    return json(response, 200, [
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
      status: "open",
      promotedWorkItemId: null,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    privateInboxItems.unshift(item);
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
    if (
      body === null ||
      item === undefined ||
      typeof body.title !== "string" ||
      body.expectedVersion !== item.version
    ) {
      return json(response, 400, { messageKey: "errors.validation" });
    }
    item.title = body.title;
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

function resetContextAcceptanceState() {
  contextAiAvailable = true;
  connectedWorkConnected = true;
  workItems.splice(0, workItems.length, ...baseWorkItems);
  privateInboxItems.splice(0, privateInboxItems.length, ...structuredClone(basePrivateInboxItems));
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
