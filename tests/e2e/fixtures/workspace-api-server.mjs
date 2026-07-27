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
const dogfoodDocumentVersionId = "d2222222-2222-4222-8222-222222222222";
const dogfoodDraftRequestId = "d3333333-3333-4333-8333-333333333333";
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
const connectedGmailItemId = "ca111111-1111-4111-8111-111111111111";
const connectedCalendarItemId = "ca222222-2222-4222-8222-222222222222";
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
let updateLocale = "ar";
let connectedWorkConnected = true;
let currentUpdateContext = {
  projectId,
  workstreamId: null,
  workItemId: null,
};
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
        name: project.name,
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
  contractDraftSourceRequest: {
    documentVersionId: dogfoodDocumentVersionId,
    sourceChecksum: "c".repeat(64),
    sourceVersion: 1,
  },
};

function dogfoodDraft() {
  return {
    requestId: dogfoodDraftRequestId,
    state: "ready",
    revision: 1,
    origin: "ai",
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
    contract: null,
  };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:3101");
  if (request.method === "GET" && url.pathname === "/health") {
    return json(response, 200, { status: "ok" });
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
    /^\/api\/v1\/connected-work\/items\/[0-9a-f-]+\/(?:exclusion|project-link)$/u.test(url.pathname)
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

  if (accessToken !== ownerAccessToken) {
    return json(response, 403, { messageKey: "errors.forbidden" });
  }

  if (request.method === "GET" && url.pathname === "/api/v1/projects") {
    return json(response, 200, [project, dogfoodProject]);
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
  if (request.method === "POST" && url.pathname === "/api/v1/updates/text") {
    const body = await readJson(request);
    if (body === null) return json(response, 400, { messageKey: "errors.validation" });
    currentUpdateContext = {
      projectId: body.projectId,
      workstreamId: body.workstreamId,
      workItemId: body.workItemId,
    };
    updateLocale = /[\u0600-\u06ff]/u.test(body.rawText) ? "ar" : "en";
    clarificationTurn = 1;
    updateDraftRevision = 1;
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
    return json(response, 200, evidenceDetail(body));
  }
  if (request.method === "POST" && url.pathname === `/api/v1/evidence/${evidenceId}/revisions`) {
    const body = await readJson(request);
    if (body === null) return json(response, 400, { messageKey: "errors.validation" });
    evidenceRevision += 1;
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
        title: "نجحت سيناريوهات القبول المتفق عليها",
        detail: "نفذت السيناريوهات وراجعت سجل الاختبار.",
        sourceReferences: [`evidence:${evidenceId}`],
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
  return {
    id: evidenceId,
    revisionId: evidenceRevisionId,
    projectId,
    workstreamId,
    workItemId: workItems[0].id,
    state: "draft",
    revision: evidenceRevision,
    revisionKind: evidenceRevision === 1 ? "manual_draft" : "employee_edit",
    sourceKind: "cli_snapshot",
    supportedClaim: overrides.supportedClaim ?? "نجحت سيناريوهات القبول المتفق عليها.",
    contributionContext: overrides.contributionContext ?? "نفذت السيناريوهات وراجعت النتيجة.",
    executionMode: "manual",
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
