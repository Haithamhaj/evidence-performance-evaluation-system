import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchProtectedUpstream: vi.fn(),
  uploadProtectedSource: vi.fn(),
}));

vi.mock("../../../../platform/workspace-api.js", () => ({
  fetchProtectedUpstream: mocks.fetchProtectedUpstream,
  safeWorkspaceError: (error: unknown) => error,
  uploadProtectedSource: mocks.uploadProtectedSource,
}));

import { GET, POST } from "./route.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";

afterEach(() => vi.clearAllMocks());

describe("daily-work same-origin gateway", () => {
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
});
