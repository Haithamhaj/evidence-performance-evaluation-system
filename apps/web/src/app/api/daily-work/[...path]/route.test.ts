import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchProtectedUpstream: vi.fn() }));

vi.mock("../../../../platform/workspace-api.js", () => ({
  fetchProtectedUpstream: mocks.fetchProtectedUpstream,
  safeWorkspaceError: (error: unknown) => error,
}));

import { GET, POST } from "./route.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";

afterEach(() => vi.clearAllMocks());

describe("daily-work same-origin gateway", () => {
  it("forwards a validated text update without accepting caller-controlled identity or model", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({
      state: "question",
      sessionVersion: 1,
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
    expect(rejected.status).toBe(409);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledOnce();
  });

  it("allows only bounded timeline query fields", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({ items: [], nextCursor: null });
    const response = await GET(
      new Request(
        `http://localhost:3000/api/daily-work/timeline?projectId=${projectId}&limit=20`,
      ),
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
});
