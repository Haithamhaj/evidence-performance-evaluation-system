import { Buffer } from "node:buffer";
import { createServer } from "node:http";
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

const project = {
  id: projectId,
  departmentId,
  name: "منصة الأدلة",
  description: "مشروع تجريبي لإدارة الأدلة ومسارات العمل.",
  status: "active",
  version: 2,
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

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:3101");
  if (request.method === "GET" && url.pathname === "/health") {
    return json(response, 200, { status: "ok" });
  }
  if (request.headers.authorization !== "Bearer e2e-access-token") {
    return json(response, 401, { messageKey: "errors.unauthorized" });
  }

  if (request.method === "GET" && url.pathname === "/api/v1/projects") {
    return json(response, 200, [project]);
  }
  if (request.method === "GET" && url.pathname === `/api/v1/projects/${projectId}/workspace`) {
    return json(response, 200, { project, people, workstreams: [workstream] });
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

server.listen(3101, "127.0.0.1");

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
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
