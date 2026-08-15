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

  it("forwards a bounded delegation approval while rejecting manager identity injection", async () => {
    const delegationId = "30000000-0000-4000-8000-000000000004";
    const body = {
      id: delegationId,
      leaveId,
      ownerId: "30000000-0000-4000-8000-000000000005",
      delegateId: "30000000-0000-4000-8000-000000000006",
      departmentId: "30000000-0000-4000-8000-000000000007",
      startsAt: "2026-08-20T00:00:00.000Z",
      endsAt: "2026-08-22T00:00:00.000Z",
      projectIds: ["30000000-0000-4000-8000-000000000008"],
      workstreamIds: [],
      actions: ["project.update"],
      emergency: false,
      emergencyReason: null,
    };
    mocks.fetchProtectedUpstream.mockResolvedValue({ id: delegationId });

    const response = await POST(
      new Request("http://localhost/api/continuity/delegations/approve", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ path: ["delegations", "approve"] }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      path: "/api/v1/continuity/delegations/approve",
      schema: expect.anything(),
      method: "POST",
      body,
    });

    mocks.fetchProtectedUpstream.mockClear();
    const rejected = await POST(
      new Request("http://localhost/api/continuity/delegations/approve", {
        method: "POST",
        body: JSON.stringify({ ...body, managerId: body.delegateId }),
      }),
      { params: Promise.resolve({ path: ["delegations", "approve"] }) },
    );
    expect(rejected.status).toBe(400);
    expect(mocks.fetchProtectedUpstream).not.toHaveBeenCalled();
  });

  it("forwards return confirmation and final return without browser actor authority", async () => {
    const delegationId = "30000000-0000-4000-8000-000000000004";
    const returnId = "30000000-0000-4000-8000-000000000009";
    mocks.fetchProtectedUpstream.mockResolvedValue({ id: returnId });

    const confirmation = await POST(
      new Request("http://localhost/api/continuity/delegations/return/confirm", {
        method: "POST",
        body: JSON.stringify({ returnId, expectedVersion: 1 }),
      }),
      {
        params: Promise.resolve({
          path: ["delegations", delegationId, "return", "confirm"],
        }),
      },
    );
    expect(confirmation.status).toBe(200);

    const finalization = await POST(
      new Request("http://localhost/api/continuity/delegations/return/finalize", {
        method: "POST",
        body: JSON.stringify({
          returnId,
          expectedVersion: 2,
          choice: "RETURN",
          occurredAt: "2026-08-22T08:00:00.000Z",
          reason: "Original owner has resumed responsibility.",
        }),
      }),
      {
        params: Promise.resolve({
          path: ["delegations", delegationId, "return", "finalize"],
        }),
      },
    );
    expect(finalization.status).toBe(200);
  });
});
