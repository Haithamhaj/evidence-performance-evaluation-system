import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchProtectedUpstream: vi.fn() }));

vi.mock("../../../../platform/workspace-api.js", () => ({
  fetchProtectedUpstream: mocks.fetchProtectedUpstream,
  safeWorkspaceError: (error: unknown) => ({
    status: 400,
    messageKey: "errors.validation",
    correlationId: "test",
    cause: error,
  }),
}));

import { POST } from "./route.js";

const leaveId = "30000000-0000-4000-8000-000000000001";

afterEach(() => vi.clearAllMocks());

describe("continuity same-origin gateway", () => {
  it("forwards only a bounded human leave decision", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({ id: leaveId, state: "APPROVED" });
    const response = await POST(
      new Request(`http://localhost/api/continuity/leaves/${leaveId}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision: "APPROVED", reason: "Coverage is confirmed." }),
      }),
      { params: Promise.resolve({ path: ["leaves", leaveId, "decision"] }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      path: `/api/v1/continuity/leaves/${leaveId}/decision`,
      schema: expect.anything(),
      method: "POST",
      body: { decision: "APPROVED", reason: "Coverage is confirmed." },
    });
  });

  it("rejects browser-supplied manager authority", async () => {
    const response = await POST(
      new Request(`http://localhost/api/continuity/leaves/${leaveId}/decision`, {
        method: "POST",
        body: JSON.stringify({
          decision: "APPROVED",
          reason: "Attempted authority injection.",
          managerId: "30000000-0000-4000-8000-000000000002",
        }),
      }),
      { params: Promise.resolve({ path: ["leaves", leaveId, "decision"] }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.fetchProtectedUpstream).not.toHaveBeenCalled();
  });

  it("forwards a handover confirmation without allowing browser employee identity", async () => {
    const handoverId = "30000000-0000-4000-8000-000000000003";
    mocks.fetchProtectedUpstream.mockResolvedValue({ handoverId, confirmedRevision: 2 });
    const response = await POST(
      new Request(`http://localhost/api/continuity/handovers/${handoverId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ expectedRevision: 2 }),
      }),
      { params: Promise.resolve({ path: ["handovers", handoverId, "confirm"] }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      path: `/api/v1/continuity/handovers/${handoverId}/confirm`,
      schema: expect.anything(),
      method: "POST",
      body: { expectedRevision: 2 },
    });
  });
});
