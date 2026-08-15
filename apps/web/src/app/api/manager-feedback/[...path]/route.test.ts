import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchProtectedUpstream: vi.fn() }));

vi.mock("../../../../platform/workspace-api.js", () => ({
  fetchProtectedUpstream: mocks.fetchProtectedUpstream,
  safeWorkspaceError: (error: unknown) => error,
}));

import { POST } from "./route.js";

const cycleId = "10000000-0000-4000-8000-000000009001";
const criterionIds = Array.from(
  { length: 5 },
  (_, index) => `10000000-0000-4000-8000-${String(9100 + index).padStart(12, "0")}`,
);

afterEach(() => vi.clearAllMocks());

describe("manager feedback same-origin gateway", () => {
  it("submits five human responses only after explicit identified confirmation", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({
      schemaVersion: 1,
      responseId: "10000000-0000-4000-8000-000000009099",
      cycleId,
      evaluatorId: "10000000-0000-4000-8000-000000009002",
      state: "SUBMITTED",
      submittedAt: "2026-08-15T10:00:00Z",
    });
    const responses = criterionIds.map((criterionId) => ({
      criterionId,
      rating: 3,
      comment: "A specific work-related observation.",
    }));

    const response = await POST(
      new Request(`http://localhost/api/manager-feedback/cycles/${cycleId}/submit`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: 1, identifiedNoticeConfirmed: true, responses }),
      }),
      { params: Promise.resolve({ path: ["cycles", cycleId, "submit"] }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      method: "POST",
      path: "/api/v1/manager-evaluation/submissions",
      body: {
        schemaVersion: 1,
        cycleId,
        expectedVersion: 1,
        idempotencyKey: expect.any(String),
        identifiedNoticeConfirmed: true,
        confirmedAt: expect.any(String),
        responses,
      },
      schema: expect.anything(),
    });
    expect(JSON.stringify(mocks.fetchProtectedUpstream.mock.calls[0]?.[0].body)).not.toMatch(
      /anonymous|aiRating|suggestedRating|recommendedRating/i,
    );
  });

  it("rejects a submission without the identified confirmation", async () => {
    const response = await POST(
      new Request(`http://localhost/api/manager-feedback/cycles/${cycleId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          expectedVersion: 1,
          identifiedNoticeConfirmed: false,
          responses: criterionIds.map((criterionId) => ({ criterionId, rating: 3, comment: "" })),
        }),
      }),
      { params: Promise.resolve({ path: ["cycles", cycleId, "submit"] }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.fetchProtectedUpstream).not.toHaveBeenCalled();
  });
});
