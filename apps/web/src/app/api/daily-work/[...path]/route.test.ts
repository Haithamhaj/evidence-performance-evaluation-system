import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchProtectedUpstream: vi.fn(),
  uploadProtectedSource: vi.fn(),
  seal: vi.fn((input: { action: string }) => `opaque-${input.action}-${"x".repeat(40)}`),
  open: vi.fn(),
}));

vi.mock("../../../../platform/workspace-api.js", () => ({
  fetchProtectedUpstream: mocks.fetchProtectedUpstream,
  safeWorkspaceError: (error: unknown) => error,
  uploadProtectedSource: mocks.uploadProtectedSource,
}));

vi.mock("../../../../platform/context-intelligence-handles.js", () => ({
  openContextReviewHandle: mocks.open,
  sealContextReviewHandle: mocks.seal,
}));

import { GET, PATCH, POST } from "./route.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const draftRequestId = "33333333-3333-4333-8333-333333333333";

afterEach(() => vi.clearAllMocks());

describe("daily-work same-origin gateway", () => {
  it("proxies the owner-authorized prepared experience without exposing browser credentials", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({ state: "idle", items: [] });

    const response = await GET(
      new Request("http://localhost:3000/api/daily-work/experience/prepared"),
      { params: Promise.resolve({ path: ["experience", "prepared"] }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "idle", items: [] });
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      method: "GET",
      path: "/api/v1/experience-orchestration/prepared",
      schema: expect.anything(),
    });
  });

  it("preserves an upstream Project-decision conflict for stale recovery", async () => {
    mocks.open.mockReturnValue({
      id: "44444444-4444-4444-8444-444444444444",
      revision: 1,
    });
    mocks.fetchProtectedUpstream.mockRejectedValue({
      status: 409,
      messageKey: "errors.validation",
      correlationId: "55555555-5555-4555-8555-555555555555",
    });

    const response = await POST(
      new Request("http://localhost:3000/api/daily-work/context/project-suggestions/confirm", {
        method: "POST",
        body: JSON.stringify({
          handle: `opaque-project_suggestion-${"x".repeat(40)}`,
          reason: "Employee reviewed the current Project link.",
        }),
      }),
      { params: Promise.resolve({ path: ["context", "project-suggestions", "confirm"] }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      messageKey: "errors.validation",
      correlationId: "55555555-5555-4555-8555-555555555555",
    });
  });

  it("proxies only the authenticated owner-filtered What Changed projection", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({ items: [], nextCursor: null });

    const response = await GET(
      new Request("http://localhost:3000/api/daily-work/experience/what-changed"),
      { params: Promise.resolve({ path: ["experience", "what-changed"] }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [], nextCursor: null });
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      method: "GET",
      path: "/api/v1/experience/what-changed",
      schema: expect.anything(),
    });
  });

  it("prepares Context review through the bounded analysis and draft APIs", async () => {
    const sourceItemId = "33333333-3333-4333-8333-333333333333";
    mocks.fetchProtectedUpstream.mockResolvedValue({ ignoredPrivateResult: true });

    const response = await POST(
      new Request("http://localhost:3000/api/daily-work/context/items/prepare", {
        method: "POST",
        body: JSON.stringify({ sourceItemId }),
      }),
      { params: Promise.resolve({ path: ["context", "items", "prepare"] }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(mocks.fetchProtectedUpstream).toHaveBeenNthCalledWith(1, {
      method: "POST",
      path: `/api/v1/context/items/${sourceItemId}/analyze`,
      body: {},
      schema: expect.anything(),
    });
    expect(mocks.fetchProtectedUpstream).toHaveBeenNthCalledWith(2, {
      method: "POST",
      path: "/api/v1/context/task-drafts",
      body: { sourceItemId },
      schema: expect.anything(),
    });
  });

  it("proxies only the bounded Context Intelligence review route without exposing a browser token", async () => {
    mocks.fetchProtectedUpstream
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        mode: "synthetic",
        synthetic: true,
        connection: { status: "connected", lastSuccessfulSyncAt: null },
        items: [],
      })
      .mockResolvedValueOnce([]);

    const response = await GET(
      new Request("http://localhost:3000/api/daily-work/context/review-queue"),
      { params: Promise.resolve({ path: ["context", "review-queue"] }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      method: "GET",
      path: "/api/v1/context/review-queue",
      schema: expect.anything(),
    });
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      method: "GET",
      path: "/api/v1/connected-work/items",
      schema: expect.anything(),
    });
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      method: "GET",
      path: "/api/v1/projects",
      schema: expect.anything(),
    });
  });

  it("projects the review network response to opaque handles and display-safe source context", async () => {
    const employeeId = "22222222-2222-4222-8222-222222222222";
    const sourceItemId = "33333333-3333-4333-8333-333333333333";
    const suggestionId = "44444444-4444-4444-8444-444444444444";
    const routeConfigId = "55555555-5555-4555-8555-555555555555";
    const aiRunId = "66666666-6666-4666-8666-666666666666";
    const projectId = "77777777-7777-4777-8777-777777777777";
    mocks.fetchProtectedUpstream
      .mockResolvedValueOnce({
        items: [
          {
            kind: "PROJECT_SUGGESTION",
            id: suggestionId,
            employeeId,
            sourceItemId,
            revision: 1,
            schemaVersion: "project-link-suggestion-output.v1",
            promptVersion: "context-project-match-prompt.v1",
            routeTrace: {
              aiRunId,
              routeKey: "context.project-match.v1",
              routeConfigId,
              routeConfigVersion: 1,
            },
            sourceReferences: [`connected-source:${sourceItemId}`],
            reviewStatus: "PENDING",
            revisionOrigin: "AI",
            correctionReason: null,
            createdAt: "2026-08-02T08:30:00Z",
            analysisId: "88888888-8888-4888-8888-888888888888",
            projectId,
            decision: "AUTO_LINK",
            explanation: "Two approved anchors match this Project.",
            anchors: [],
            supersedesSuggestionId: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        mode: "synthetic",
        synthetic: true,
        connection: { status: "connected", lastSuccessfulSyncAt: null },
        items: [
          {
            id: sourceItemId,
            provider: "GOOGLE_GMAIL",
            occurredAt: "2026-08-02T08:00:00Z",
            title: "Customer rollout note",
            summary: "A safe employee-visible summary.",
            sourceUrl: "https://mail.google.com/example",
            privacy: "PRIVATE",
            excluded: false,
            projectId: null,
            sourceExclusion: null,
          },
        ],
      })
      .mockResolvedValueOnce([
        {
          id: projectId,
          departmentId: "99999999-9999-4999-8999-999999999999",
          name: "Atlas Delivery",
          description: "",
          status: "active",
          version: 1,
          primaryOwnerId: null,
        },
      ]);

    const response = await GET(
      new Request("http://localhost:3000/api/daily-work/context/review-queue"),
      { params: Promise.resolve({ path: ["context", "review-queue"] }) },
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      items: [
        {
          kind: "project_match",
          handle: `opaque-project_suggestion-${"x".repeat(40)}`,
          projectName: "Atlas Delivery",
          source: { title: "Customer rollout note" },
        },
      ],
      projects: [{ handle: `opaque-project-${"x".repeat(40)}`, name: "Atlas Delivery" }],
    });
    for (const forbidden of [
      employeeId,
      sourceItemId,
      suggestionId,
      projectId,
      routeConfigId,
      aiRunId,
      "sourceReferences",
      "routeTrace",
      "employeeId",
      "sourceItemId",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("projects unexpected upstream Context fields away before strict parsing", async () => {
    const employeeId = "22222222-2222-4222-8222-222222222222";
    const sourceItemId = "33333333-3333-4333-8333-333333333333";
    const suggestionId = "44444444-4444-4444-8444-444444444444";
    const projectId = "77777777-7777-4777-8777-777777777777";
    mocks.fetchProtectedUpstream
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        mode: "synthetic",
        synthetic: true,
        connection: { status: "connected", lastSuccessfulSyncAt: null },
        items: [],
      })
      .mockResolvedValueOnce([]);

    await GET(new Request("http://localhost:3000/api/daily-work/context/review-queue"), {
      params: Promise.resolve({ path: ["context", "review-queue"] }),
    });

    const schemaFor = (path: string) => {
      const call = mocks.fetchProtectedUpstream.mock.calls.find(
        ([input]) => input.path === path,
      )?.[0] as { schema: { parse: (value: unknown) => unknown } } | undefined;
      if (call === undefined) throw new Error(`Missing upstream schema for ${path}`);
      return call.schema;
    };
    expect(
      schemaFor("/api/v1/context/review-queue").parse({
        ignoredQueueField: true,
        items: [
          {
            kind: "PROJECT_SUGGESTION",
            id: suggestionId,
            employeeId,
            sourceItemId,
            revision: 1,
            projectId,
            explanation: "A safe explanation.",
            ignoredItemField: true,
          },
        ],
      }),
    ).toEqual({
      items: [
        {
          kind: "PROJECT_SUGGESTION",
          id: suggestionId,
          employeeId,
          sourceItemId,
          revision: 1,
          projectId,
          explanation: "A safe explanation.",
        },
      ],
    });
    expect(
      schemaFor("/api/v1/connected-work/items").parse({
        mode: "synthetic",
        synthetic: true,
        connection: { status: "connected", lastSuccessfulSyncAt: null },
        items: [
          {
            id: sourceItemId,
            title: "Customer rollout note",
            summary: null,
            sourceUrl: null,
            ignoredSourceField: true,
          },
        ],
      }),
    ).toEqual({
      items: [
        {
          id: sourceItemId,
          provider: null,
          occurredAt: null,
          title: "Customer rollout note",
          summary: null,
          sourceUrl: null,
        },
      ],
    });
    expect(
      schemaFor("/api/v1/projects").parse([
        { id: projectId, name: "Atlas Delivery", ignoredProjectField: true },
      ]),
    ).toEqual([{ id: projectId, name: "Atlas Delivery" }]);

    mocks.open.mockImplementation((_: string, action: string) =>
      action === "project"
        ? { id: projectId, projectId }
        : {
            id: suggestionId,
            revision: 1,
            employeeId,
            workstreamId: null,
            dueAt: null,
            acceptanceConditions: [],
          },
    );
    mocks.fetchProtectedUpstream.mockClear();
    mocks.fetchProtectedUpstream.mockResolvedValue({ ignoredResultField: true });
    await POST(
      new Request("http://localhost:3000/api/daily-work/context/project-suggestions/confirm", {
        method: "POST",
        body: JSON.stringify({
          handle: `opaque-project_suggestion-${"x".repeat(40)}`,
          reason: "Reviewed",
        }),
      }),
      { params: Promise.resolve({ path: ["context", "project-suggestions", "confirm"] }) },
    );
    await POST(
      new Request("http://localhost:3000/api/daily-work/context/project-suggestions/correct", {
        method: "POST",
        body: JSON.stringify({
          handle: `opaque-project_suggestion-${"x".repeat(40)}`,
          projectHandle: `opaque-project-${"x".repeat(40)}`,
          reason: "Reviewed",
        }),
      }),
      { params: Promise.resolve({ path: ["context", "project-suggestions", "correct"] }) },
    );
    for (const [, [input]] of mocks.fetchProtectedUpstream.mock.calls.entries()) {
      if (input.path.includes("project-suggestions")) {
        expect(input.schema.parse({ ignoredResultField: true })).toEqual({});
      }
    }

    mocks.fetchProtectedUpstream.mockClear();
    mocks.fetchProtectedUpstream.mockResolvedValue({
      workItem: { title: "Prepare launch", projectId, ignoredWorkItemField: true },
      ignoredTaskResultField: true,
    });
    await POST(
      new Request("http://localhost:3000/api/daily-work/context/task-drafts/confirm", {
        method: "POST",
        body: JSON.stringify({
          handle: `opaque-task_draft-${"x".repeat(40)}`,
          reason: "Reviewed",
          draft: {
            title: "Prepare launch",
            description: "",
            projectHandle: `opaque-project-${"x".repeat(40)}`,
            assignToYou: true,
          },
        }),
      }),
      { params: Promise.resolve({ path: ["context", "task-drafts", "confirm"] }) },
    );
    expect(
      mocks.fetchProtectedUpstream.mock.calls[0]?.[0].schema.parse({
        workItem: { title: "Prepare launch", projectId, ignoredWorkItemField: true },
        ignoredTaskResultField: true,
      }),
    ).toEqual({ workItem: { title: "Prepare launch" } });
  });

  it("rejects direct official Task creation without one responsible assignee", async () => {
    const baseBody = {
      title: "Prepare launch evidence",
      description: "",
      projectId,
      workstreamId: null,
      dueAt: null,
      priority: "normal",
      requirements: [],
      acceptanceConditions: [],
      blocker: null,
      nextAction: null,
    };

    for (const body of [baseBody, { ...baseBody, assigneeId: null }]) {
      const response = await POST(
        new Request("http://localhost:3000/api/daily-work/work-items", {
          method: "POST",
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ path: ["work-items"] }) },
      );
      expect(response.status).toBe(400);
    }
    expect(mocks.fetchProtectedUpstream).not.toHaveBeenCalled();
  });

  it("forwards a bounded Task edit without accepting caller-controlled project or identity", async () => {
    const workItemId = "99999999-9999-4999-8999-999999999999";
    const employeeId = "88888888-8888-4888-8888-888888888888";
    mocks.fetchProtectedUpstream.mockResolvedValue({
      id: workItemId,
      projectId,
      workstreamId: null,
      title: "Updated Task title",
      description: "",
      status: "planned",
      priority: "normal",
      assigneeId: null,
      dueAt: null,
      requirements: [],
      acceptanceConditions: [],
      blocker: null,
      nextAction: null,
      version: 2,
      createdAt: "2026-07-20T08:00:00.000Z",
      updatedAt: "2026-07-20T09:00:00.000Z",
      checklist: [],
      collaboratorIds: [],
      allowedActions: ["edit"],
    });

    const response = await PATCH(
      new Request(`http://localhost:3000/api/daily-work/work-items/${workItemId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: "Updated Task title",
          expectedVersion: 1,
          reason: "Employee edited Task details",
        }),
      }),
      { params: Promise.resolve({ path: ["work-items", workItemId] }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      path: `/api/v1/work-items/${workItemId}`,
      method: "PATCH",
      body: {
        title: "Updated Task title",
        expectedVersion: 1,
        reason: "Employee edited Task details",
      },
      schema: expect.anything(),
    });

    const rejected = await PATCH(
      new Request(`http://localhost:3000/api/daily-work/work-items/${workItemId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: "Changed ownership",
          projectId,
          employeeId,
          expectedVersion: 1,
          reason: "Caller-controlled scope",
        }),
      }),
      { params: Promise.resolve({ path: ["work-items", workItemId] }) },
    );
    expect(rejected.status).toBe(400);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledOnce();
  });

  it("forwards text-only private capture without caller-controlled ownership", async () => {
    const inboxId = "77777777-7777-4777-8777-777777777777";
    const employeeId = "88888888-8888-4888-8888-888888888888";
    mocks.fetchProtectedUpstream.mockResolvedValue({
      id: inboxId,
      employeeId,
      text: "Follow up with the client",
      projectId: null,
      status: "open",
      promotedWorkItemId: null,
      version: 1,
      createdAt: "2026-07-20T08:00:00.000Z",
      updatedAt: "2026-07-20T08:00:00.000Z",
    });
    const response = await POST(
      new Request("http://localhost:3000/api/daily-work/private-inbox", {
        method: "POST",
        body: JSON.stringify({ text: "Follow up with the client", projectId: null }),
      }),
      { params: Promise.resolve({ path: ["private-inbox"] }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/private-inbox",
        method: "POST",
        body: {
          text: "Follow up with the client",
          projectId: null,
          sourceType: "text",
          sourceUploadId: null,
        },
      }),
    );

    const rejected = await POST(
      new Request("http://localhost:3000/api/daily-work/private-inbox", {
        method: "POST",
        body: JSON.stringify({
          text: "Private capture",
          projectId: null,
          employeeId,
        }),
      }),
      { params: Promise.resolve({ path: ["private-inbox"] }) },
    );
    expect(rejected.status).toBe(400);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledOnce();
  });

  it("forwards a validated text update without accepting caller-controlled identity or model", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({
      state: "draft_with_question",
      sessionId,
      sessionVersion: 1,
      draft: {
        id: "55555555-5555-4555-8555-555555555555",
        sessionId,
        revision: 1,
        summary: "مسودة أولية",
        result: "تحتاج النتيجة إلى توضيح",
        blocker: null,
        nextAction: "توضيح النتيجة",
        contributionContext: "مساهمة قيد المراجعة",
        executionMode: "ai_assisted",
        sourceReferences: [`update-source:${sessionId}`],
        evidenceIds: [],
        documentationNeeds: [],
        relatedProgressComponentIds: [],
        comparison: {
          previousAcceptedEventId: null,
          changedFields: [],
          explanation: "أول تحديث.",
        },
      },
      turnId: "33333333-3333-4333-8333-333333333333",
      turnNumber: 1,
      question: "ما النتيجة؟",
      affects: ["result"],
      remainingFieldCount: 1,
    });
    const body = {
      idempotencyKey: "44444444-4444-4444-8444-444444444444",
      projectId,
      workstreamId: null,
      workItemId: null,
      rawText: "أنجزت الاختبارات.",
      executionMode: "ai_assisted",
    };
    const response = await POST(
      new Request("http://localhost:3000/api/daily-work/updates/text", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ path: ["updates", "text"] }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/updates/text",
        method: "POST",
        body,
      }),
    );

    const rejected = await POST(
      new Request("http://localhost:3000/api/daily-work/updates/text", {
        method: "POST",
        body: JSON.stringify({ ...body, actorId: projectId, model: "gpt-5.5" }),
      }),
      { params: Promise.resolve({ path: ["updates", "text"] }) },
    );
    expect(rejected.status).toBe(400);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledOnce();
  });

  it("allows only bounded timeline query fields", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({ items: [], nextCursor: null });
    const response = await GET(
      new Request(`http://localhost:3000/api/daily-work/timeline?projectId=${projectId}&limit=20`),
      { params: Promise.resolve({ path: ["timeline"] }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `/api/v1/timeline?projectId=${projectId}&limit=20`,
      }),
    );

    const rejected = await GET(
      new Request(
        `http://localhost:3000/api/daily-work/timeline?projectId=${projectId}&actorId=${projectId}`,
      ),
      { params: Promise.resolve({ path: ["timeline"] }) },
    );
    expect(rejected.status).toBe(404);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledOnce();
  });

  it("derives the private upload scope and never accepts a caller object key", async () => {
    mocks.uploadProtectedSource.mockResolvedValue({
      id: sessionId,
      kind: "project",
      resourceId: projectId,
      filename: "proof.png",
      detectedMime: "image/png",
      detectedType: "png",
      byteSize: 3,
      sha256: "a".repeat(64),
      createdAt: "2026-07-18T12:00:00.000Z",
    });
    const form = new FormData();
    form.set("file", new File([new Uint8Array([1, 2, 3])], "proof.png", { type: "image/png" }));
    form.set(
      "metadata",
      JSON.stringify({
        projectId,
        workstreamId: null,
        reason: "Employee attached evidence for review",
      }),
    );
    const response = await POST(
      new Request("http://localhost:3000/api/daily-work/evidence/uploads", {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ path: ["evidence", "uploads"] }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.uploadProtectedSource).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceKind: "project",
        resourceId: projectId,
        filename: "proof.png",
      }),
    );
  });

  it("forwards only approved session and evidence paths", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      sessionId,
      revision: 1,
      summary: "ملخص",
      result: "نتيجة",
      blocker: null,
      nextAction: "الخطوة",
      contributionContext: "السياق",
      executionMode: "manual",
      sourceReferences: [`update-source:${sessionId}`],
      evidenceIds: [],
      documentationNeeds: [],
      relatedProgressComponentIds: [],
      comparison: {
        previousAcceptedEventId: null,
        changedFields: [],
        explanation: "أول تحديث.",
      },
    });
    const response = await GET(
      new Request(`http://localhost:3000/api/daily-work/updates/${sessionId}/draft`),
      { params: Promise.resolve({ path: ["updates", sessionId, "draft"] }) },
    );
    expect(response.status).toBe(200);

    const rejected = await GET(
      new Request(`http://localhost:3000/api/daily-work/updates/${sessionId}/raw-prompt`),
      { params: Promise.resolve({ path: ["updates", sessionId, "raw-prompt"] }) },
    );
    expect(rejected.status).toBe(404);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledOnce();
  });

  it("forwards a bounded GitHub suggestion for employee evidence review", async () => {
    const sourceEventId = "77777777-7777-4777-8777-777777777777";
    const evidenceId = "88888888-8888-4888-8888-888888888888";
    const body = {
      idempotencyKey: "99999999-9999-4999-8999-999999999999",
      sourceEventId,
      projectId,
      workstreamId: null,
      workItemId: null,
      supportedClaim: "The verified pull request completed the approved acceptance path.",
      relatedKpiComponentId: null,
      relatedCriterionId: null,
      contributionContext: "I implemented and verified the acceptance path.",
      executionMode: "ai_assisted",
    };
    mocks.fetchProtectedUpstream.mockResolvedValue({
      id: evidenceId,
      revisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      projectId,
      workstreamId: null,
      workItemId: null,
      state: "draft",
      revision: 1,
      revisionKind: "ai_draft",
      sourceKind: "url",
      supportedClaim: body.supportedClaim,
      contributionContext: body.contributionContext,
      executionMode: "ai_assisted",
    });

    const response = await POST(
      new Request("http://localhost:3000/api/daily-work/evidence/github-suggestions", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ path: ["evidence", "github-suggestions"] }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      path: "/api/v1/evidence/github-suggestions",
      schema: expect.anything(),
      method: "POST",
      body,
    });
  });

  it("forwards a confirmed Update result through its strict reader path", async () => {
    const acceptedEventId = "66666666-6666-4666-8666-666666666666";
    mocks.fetchProtectedUpstream.mockResolvedValue({
      acceptedEventId,
      project: { id: projectId, name: "Atlas Delivery" },
      workstream: null,
      workItem: null,
      summary: "Acceptance path completed",
      result: "All approved scenarios passed",
      sourceReferences: [`update-source:${sessionId}`],
      comparison: {
        previousAcceptedEventId: null,
        explanation: "This is the first confirmed update.",
      },
      blocker: null,
      nextAction: "Attach client acceptance",
      documentationNeeds: ["Client acceptance"],
      progressImpact: {
        state: "insufficient_information",
        missing: ["Client acceptance"],
      },
      confirmedAt: "2026-07-19T08:00:00.000Z",
    });

    const response = await GET(
      new Request(`http://localhost:3000/api/daily-work/updates/${acceptedEventId}/result`),
      { params: Promise.resolve({ path: ["updates", acceptedEventId, "result"] }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `/api/v1/updates/${acceptedEventId}/result`,
      }),
    );
  });

  it("forwards only strict Project Progress Contract draft commands", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({
      requestId: draftRequestId,
      state: "ready",
      revision: 1,
      origin: "ai",
      source: { label: "Approved Project document", version: 3 },
      draft: {
        components: [
          {
            position: 1,
            kind: "deliverable",
            name: "Approved release",
            description: "Release accepted by the Product Owner.",
            weight: 100,
            baseline: null,
            target: null,
            unit: null,
            direction: null,
            acceptanceConditions: ["Product Owner acceptance"],
            requiredEvidence: ["Acceptance record"],
            confirmationMode: "human_confirmed",
            sourceLabels: ["Approved Project document · version 3"],
            automationHints: [],
          },
        ],
        ambiguities: [],
        clarificationQuestions: [],
      },
      contract: null,
    });
    const body = {
      idempotencyKey: "progress-contract-draft-1",
      documentVersionId: draftRequestId,
      sourceChecksum: "a".repeat(64),
      locale: "en",
      timezone: "Asia/Riyadh",
      effectiveAt: "2026-07-20T00:00:00Z",
      reason: "Prepare the approved source for human review",
    };

    const response = await POST(
      new Request(
        `http://localhost:3000/api/daily-work/projects/${projectId}/progress-contract-drafts`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      ),
      {
        params: Promise.resolve({
          path: ["projects", projectId, "progress-contract-drafts"],
        }),
      },
    );
    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `/api/v1/projects/${projectId}/progress-contract-drafts`,
        method: "POST",
        body,
      }),
    );

    const rejected = await POST(
      new Request(
        `http://localhost:3000/api/daily-work/projects/${projectId}/progress-contract-drafts`,
        {
          method: "POST",
          body: JSON.stringify({ ...body, actorId: projectId, model: "gpt-5.5" }),
        },
      ),
      {
        params: Promise.resolve({
          path: ["projects", projectId, "progress-contract-drafts"],
        }),
      },
    );
    expect(rejected.status).toBe(400);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledOnce();
  });

  it("allows the protected draft read but not internal trace paths", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({
      requestId: draftRequestId,
      state: "pending",
      revision: null,
      origin: null,
      source: { label: "Approved Project document", version: 3 },
      draft: null,
      contract: null,
    });
    const response = await GET(
      new Request(
        `http://localhost:3000/api/daily-work/projects/${projectId}/progress-contract-drafts/${draftRequestId}`,
      ),
      {
        params: Promise.resolve({
          path: ["projects", projectId, "progress-contract-drafts", draftRequestId],
        }),
      },
    );
    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `/api/v1/projects/${projectId}/progress-contract-drafts/${draftRequestId}`,
      }),
    );

    const rejected = await GET(
      new Request(
        `http://localhost:3000/api/daily-work/projects/${projectId}/progress-contract-drafts/${draftRequestId}/trace`,
      ),
      {
        params: Promise.resolve({
          path: ["projects", projectId, "progress-contract-drafts", draftRequestId, "trace"],
        }),
      },
    );
    expect(rejected.status).toBe(404);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledOnce();
  });
});
