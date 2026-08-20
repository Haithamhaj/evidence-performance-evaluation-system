import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchProtectedUpstream: vi.fn() }));

vi.mock("../../../../platform/workspace-api.js", () => ({
  fetchProtectedUpstream: mocks.fetchProtectedUpstream,
  safeWorkspaceError: (error: unknown) => error,
}));

import { POST } from "./route.js";

const assignmentId = "20000000-0000-4000-8000-000000000001";
const criterionId = "30000000-0000-4000-8000-000000000001";

afterEach(() => vi.clearAllMocks());

describe("evaluation same-origin gateway", () => {
  it("requests optional wording only after the employee selected an approved anchor", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({
      schemaVersion: "evaluation-justification.v1",
      draft: "I delivered the protected flow and verified the recovery path.",
      sourceReferences: ["40000000-0000-4000-8000-000000000001"],
      limitations: ["Review and edit this wording before saving."],
    });

    const response = await POST(
      new Request(
        `http://localhost:3000/api/evaluation/assignments/${assignmentId}/wording-draft`,
        {
          method: "POST",
          body: JSON.stringify({
            criterionId,
            selectedRating: 3,
            selectedAnchor: "Consistently meets the approved expectation",
            sourceReferences: ["40000000-0000-4000-8000-000000000001"],
            userDraft: "",
          }),
        },
      ),
      { params: Promise.resolve({ path: ["assignments", assignmentId, "wording-draft"] }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        draft: "I delivered the protected flow and verified the recovery path.",
      }),
    );
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      method: "POST",
      path: `/api/v1/employee-evaluation/assignments/${assignmentId}/justification-drafts`,
      body: {
        schemaVersion: "evaluation-justification.v1",
        criterionId,
        selectedRating: 3,
        selectedAnchor: "Consistently meets the approved expectation",
        sourceReferences: ["40000000-0000-4000-8000-000000000001"],
        userDraft: "",
        locale: "en",
      },
      schema: expect.anything(),
    });
  });

  it("saves only the employee's human-selected self-assessment draft", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({
      schemaVersion: 1,
      id: "50000000-0000-4000-8000-000000000001",
      assignmentId,
      kind: "SELF",
      version: 2,
      entries: [entry()],
      updatedAt: "2026-08-15T12:00:00Z",
      submittedAt: null,
    });

    const response = await POST(
      new Request(`http://localhost:3000/api/evaluation/assignments/${assignmentId}/self-draft`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: 1, entries: [entry()] }),
      }),
      { params: Promise.resolve({ path: ["assignments", assignmentId, "self-draft"] }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "saved",
      version: 2,
      updatedAt: "2026-08-15T12:00:00Z",
    });
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      method: "POST",
      path: `/api/v1/employee-evaluation/assignments/${assignmentId}/drafts`,
      body: {
        schemaVersion: 1,
        kind: "SELF",
        expectedVersion: 1,
        idempotencyKey: expect.any(String),
        entries: [entry()],
      },
      schema: expect.anything(),
    });
    expect(JSON.stringify(mocks.fetchProtectedUpstream.mock.calls[0]?.[0].body)).not.toMatch(
      /suggestedRating|recommendedRating|aiRating/i,
    );
  });

  it("routes the independent manager draft with no employee projection or AI rating field", async () => {
    const managerEntry = { ...entry(), directObservationBasis: "Observed delivery directly." };
    mocks.fetchProtectedUpstream.mockResolvedValue({
      schemaVersion: 1,
      id: "50000000-0000-4000-8000-000000000010",
      assignmentId,
      kind: "MANAGER_INITIAL",
      version: 2,
      entries: [managerEntry],
      updatedAt: "2026-08-15T12:00:00Z",
      submittedAt: null,
    });

    const response = await POST(
      new Request(
        `http://localhost:3000/api/evaluation/assignments/${assignmentId}/manager-draft`,
        {
          method: "POST",
          body: JSON.stringify({ expectedVersion: 1, entries: [managerEntry] }),
        },
      ),
      { params: Promise.resolve({ path: ["assignments", assignmentId, "manager-draft"] }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ kind: "MANAGER_INITIAL", entries: [managerEntry] }),
      }),
    );
    expect(JSON.stringify(mocks.fetchProtectedUpstream.mock.calls[0]?.[0].body)).not.toMatch(
      /employeeSubmission|suggestedRating|recommendedRating|aiRating/i,
    );
  });

  it("rejects malformed ratings, extra fields, and unsupported paths before the protected API", async () => {
    const malformed = await POST(
      new Request(`http://localhost:3000/api/evaluation/assignments/${assignmentId}/self-draft`, {
        method: "POST",
        body: JSON.stringify({
          expectedVersion: 1,
          entries: [{ ...entry(), rating: 6 }],
          suggestedRating: 5,
        }),
      }),
      { params: Promise.resolve({ path: ["assignments", assignmentId, "self-draft"] }) },
    );
    const unsupported = await POST(new Request("http://localhost:3000/api/evaluation/manager"), {
      params: Promise.resolve({ path: ["manager"] }),
    });

    expect([malformed.status, unsupported.status]).toEqual([400, 404]);
    expect(mocks.fetchProtectedUpstream).not.toHaveBeenCalled();
  });

  it("submits only after the employee's explicit reviewed confirmation", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({
      schemaVersion: 1,
      id: "60000000-0000-4000-8000-000000000001",
      assignmentId,
      kind: "SELF",
      assessmentId: "50000000-0000-4000-8000-000000000001",
      revisionId: "50000000-0000-4000-8000-000000000002",
      cycleSnapshotId: "50000000-0000-4000-8000-000000000003",
      submittedById: "50000000-0000-4000-8000-000000000004",
      selfProjectionAccessedBeforeSubmit: false,
      confirmedAt: "2026-08-15T12:05:00Z",
    });

    const response = await POST(
      new Request(`http://localhost:3000/api/evaluation/assignments/${assignmentId}/self-submit`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: 2, reviewed: true }),
      }),
      { params: Promise.resolve({ path: ["assignments", assignmentId, "self-submit"] }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "submitted",
      confirmedAt: "2026-08-15T12:05:00Z",
    });
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      method: "POST",
      path: `/api/v1/employee-evaluation/assignments/${assignmentId}/submissions`,
      body: {
        schemaVersion: 1,
        kind: "SELF",
        expectedVersion: 2,
        idempotencyKey: expect.any(String),
        confirmedAt: expect.any(String),
      },
      schema: expect.anything(),
    });
  });

  it("forwards only the manager's explicit final decisions", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({
      schemaVersion: 2,
      id: "70000000-0000-4000-8000-000000000001",
      assignmentId,
      finalizedAt: "2026-08-15T13:00:00Z",
      version: 2,
    });
    const finalEntry = {
      criterionId,
      rating: 3,
      justification: "Manager final human judgment.",
      sourceReferences: [],
      managerInitialChangeReason: null,
    };
    const response = await POST(
      new Request(`http://localhost:3000/api/evaluation/assignments/${assignmentId}/finalize`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: 1, entries: [finalEntry], finalComment: null }),
      }),
      { params: Promise.resolve({ path: ["assignments", assignmentId, "finalize"] }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      method: "POST",
      path: `/api/v1/employee-evaluation/assignments/${assignmentId}/finalization`,
      body: {
        schemaVersion: 1,
        expectedVersion: 1,
        idempotencyKey: expect.any(String),
        entries: [finalEntry],
        finalComment: null,
      },
      schema: expect.anything(),
    });
    expect(JSON.stringify(mocks.fetchProtectedUpstream.mock.calls[0]?.[0].body)).not.toMatch(
      /aiRating|suggestedRating|recommendedRating/i,
    );
  });

  it("records acknowledgment or reservation without accepting a rating", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({
      schemaVersion: 1,
      id: "70000000-0000-4000-8000-000000000002",
      assignmentId,
      finalSnapshotId: "70000000-0000-4000-8000-000000000003",
      kind: "ACKNOWLEDGED_WITH_RESERVATION",
      reservation: "I acknowledge receipt and disagree with the context used.",
      recordedAt: "2026-08-15T14:00:00Z",
    });
    const response = await POST(
      new Request(`http://localhost:3000/api/evaluation/assignments/${assignmentId}/acknowledge`, {
        method: "POST",
        body: JSON.stringify({
          expectedVersion: 2,
          kind: "ACKNOWLEDGED_WITH_RESERVATION",
          reservation: "I acknowledge receipt and disagree with the context used.",
        }),
      }),
      { params: Promise.resolve({ path: ["assignments", assignmentId, "acknowledge"] }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `/api/v1/employee-evaluation/assignments/${assignmentId}/acknowledgment`,
        body: expect.not.objectContaining({ rating: expect.anything() }),
      }),
    );
  });

  it("queues the employee's authorized English evaluation export", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({
      request: { id: "70000000-0000-4000-8000-000000000004" },
      manifest: { id: "70000000-0000-4000-8000-000000000005" },
    });
    const response = await POST(
      new Request(`http://localhost:3000/api/evaluation/assignments/${assignmentId}/export`, {
        method: "POST",
        body: JSON.stringify({
          locale: "en",
          cycleId: "80000000-0000-4000-8000-000000000001",
        }),
      }),
      { params: Promise.resolve({ path: ["assignments", assignmentId, "export"] }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      method: "POST",
      path: "/api/v1/operations/exports",
      body: {
        idempotencyKey: expect.any(String),
        reportType: "EMPLOYEE_EVALUATION",
        audience: "EMPLOYEE_SELF",
        format: "PDF",
        locale: "en",
        cycleId: "80000000-0000-4000-8000-000000000001",
        timezone: "Asia/Riyadh",
      },
      schema: expect.anything(),
    });
  });
});

function entry() {
  return {
    criterionId,
    rating: 3,
    justification: "I delivered the protected flow and verified recovery.",
    sourceReferences: [],
    directObservationBasis: null,
  };
}
