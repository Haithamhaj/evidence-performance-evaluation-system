import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchProtectedUpstream: vi.fn(),
  open: vi.fn(),
  seal: vi.fn((input: { action: string }) => `opaque-${input.action}-${"x".repeat(40)}`),
}));

vi.mock("../../../../platform/workspace-api.js", () => ({
  fetchProtectedUpstream: mocks.fetchProtectedUpstream,
  safeWorkspaceError: (error: unknown) => error,
}));

vi.mock("../../../../auth/oidc.js", () => ({
  oidcSettings: () => ({ sessionSecret: "test-secret-that-is-long-enough" }),
  openAuthCookie: mocks.open,
  sealAuthCookie: mocks.seal,
}));

import { DELETE, GET, PATCH, POST, PUT } from "./route.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const reviewId = "22222222-2222-4222-8222-222222222222";
const proposalId = "33333333-3333-4333-8333-333333333333";
const ownerId = "44444444-4444-4444-8444-444444444444";
const routeConfigId = "55555555-5555-4555-8555-555555555555";
const aiRunId = "66666666-6666-4666-8666-666666666666";

afterEach(() => vi.clearAllMocks());

describe("research same-origin gateway", () => {
  it("starts a URL review through a strict token-free public projection", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue(reviewDetail());

    const response = await POST(
      new Request("http://localhost:3000/api/research/source-reviews", {
        method: "POST",
        body: JSON.stringify({ projectId, url: "https://github.com/acme/atlas" }),
      }),
      { params: Promise.resolve({ path: ["source-reviews"] }) },
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      method: "POST",
      path: "/api/v1/research/source-reviews",
      body: {
        scope: { projectId, workstreamId: null, workItemId: null },
        idempotencyKey: expect.any(String),
        source: { kind: "URL", url: "https://github.com/acme/atlas" },
      },
      schema: expect.anything(),
    });
    expect(body).toMatchObject({
      handle: `opaque-source_review-${"x".repeat(40)}`,
      state: "READY_FOR_REVIEW",
      displayUrl: "https://github.com/acme/atlas",
      output: {
        summary: "A compact cited review.",
        citations: [{ label: "Source 1", locator: "README", url: "https://github.com/acme/atlas" }],
        proposals: [{ handle: `opaque-proposal-${"x".repeat(40)}`, title: "Verify latency" }],
      },
    });
    for (const forbidden of [
      reviewId,
      proposalId,
      ownerId,
      routeConfigId,
      aiRunId,
      "routeTrace",
      "schemaVersion",
      "sourceReference",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("rejects duplicate query keys, extra segments, unsupported methods, and malformed bodies", async () => {
    const duplicate = await GET(
      new Request(
        `http://localhost:3000/api/research/records?projectId=${projectId}&projectId=${projectId}`,
      ),
      { params: Promise.resolve({ path: ["records"] }) },
    );
    const extra = await GET(new Request("http://localhost:3000/api/research/source-reviews/a/b"), {
      params: Promise.resolve({ path: ["source-reviews", "a", "b"] }),
    });
    const malformed = await POST(
      new Request("http://localhost:3000/api/research/source-reviews", {
        method: "POST",
        body: JSON.stringify({ projectId, url: "javascript:alert(1)", extra: true }),
      }),
      { params: Promise.resolve({ path: ["source-reviews"] }) },
    );
    const unsupported = await Promise.all([PATCH(), PUT(), DELETE()]);

    expect([duplicate.status, extra.status, malformed.status]).toEqual([404, 404, 400]);
    expect(unsupported.map(({ status }) => status)).toEqual([404, 404, 404]);
    expect(mocks.fetchProtectedUpstream).not.toHaveBeenCalled();
  });

  it("fails closed when an upstream response contains an unexpected field", async () => {
    mocks.fetchProtectedUpstream.mockImplementation(({ schema }) =>
      Promise.resolve(schema.parse({ ...reviewDetail(), leakedSecret: "must-not-pass" })),
    );

    const response = await POST(
      new Request("http://localhost:3000/api/research/source-reviews", {
        method: "POST",
        body: JSON.stringify({ projectId, url: "https://example.com/research" }),
      }),
      { params: Promise.resolve({ path: ["source-reviews"] }) },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ messageKey: "errors.internal" });
  });

  it("confirms only employee-selected opaque proposals without creating an official Task", async () => {
    const reviewHandle = `opaque-source_review-${"x".repeat(40)}`;
    const proposalHandle = `opaque-proposal-${"x".repeat(40)}`;
    mocks.open.mockImplementation((handle: string) =>
      handle === reviewHandle
        ? {
            kind: "context_handle",
            action: "source_review",
            id: reviewId,
            projectId,
            revision: 1,
          }
        : {
            kind: "context_handle",
            action: "proposal",
            id: proposalId,
            projectId,
            revision: 1,
          },
    );
    mocks.fetchProtectedUpstream.mockResolvedValue({
      ...reviewDetail(),
      state: "CONFIRMED",
      version: 2,
    });

    const response = await POST(
      new Request("http://localhost:3000/api/research/source-reviews/confirm", {
        method: "POST",
        body: JSON.stringify({
          reviewHandle,
          expectedVersion: 1,
          proposalHandles: [proposalHandle],
          reason: "Employee reviewed the editable proposal.",
        }),
      }),
      { params: Promise.resolve({ path: ["source-reviews", "confirm"] }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ state: "confirmed", officialTaskCreated: false });
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledTimes(1);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      method: "POST",
      path: `/api/v1/research/source-reviews/${reviewId}/disposition`,
      body: {
        expectedVersion: 1,
        disposition: "CONFIRM",
        proposalIds: [proposalId],
        reason: "Employee reviewed the editable proposal.",
      },
      schema: expect.anything(),
    });
    expect(mocks.fetchProtectedUpstream.mock.calls[0]?.[0].path).not.toContain("confirm-work-item");
  });

  it("loads confirmed Research and failed Experiment detail through opaque handles", async () => {
    const researchId = "77777777-7777-4777-8777-777777777777";
    const experimentId = "88888888-8888-4888-8888-888888888888";
    const researchHandle = `opaque-research-${"x".repeat(40)}`;
    const experimentHandle = `opaque-experiment-${"x".repeat(40)}`;
    mocks.open.mockImplementation((handle: string) => ({
      kind: "context_handle",
      action: handle === researchHandle ? "research" : "experiment",
      id: handle === researchHandle ? researchId : experimentId,
      projectId,
      revision: 3,
    }));
    mocks.fetchProtectedUpstream
      .mockResolvedValueOnce({
        detail: {
          id: researchId,
          scope: { projectId, workstreamId: null, workItemId: null },
          state: "CONCLUDED",
          version: 3,
          currentRevision: {
            question: "Should Atlas adopt the benchmark?",
            objective: "Make a source-supported decision.",
          },
        },
        sourceReferences: [
          { title: "Atlas benchmark", canonicalUrl: "https://github.com/acme/atlas" },
        ],
      })
      .mockResolvedValueOnce({
        detail: {
          id: experimentId,
          researchId,
          scope: { projectId, workstreamId: null, workItemId: null },
          state: "RESULT_RECORDED",
          version: 3,
          currentMethod: { question: "Does recovery remain bounded?" },
        },
        runs: [
          {
            resultStatus: "FAILED",
            executionNotes: "Dependency timeout prevented a valid comparison.",
          },
        ],
        conclusions: [],
      });

    const research = await GET(
      new Request(`http://localhost:3000/api/research/records/${researchHandle}`),
      { params: Promise.resolve({ path: ["records", researchHandle] }) },
    );
    const experiment = await GET(
      new Request(`http://localhost:3000/api/research/experiments/${experimentHandle}`),
      { params: Promise.resolve({ path: ["experiments", experimentHandle] }) },
    );

    const researchBody = await research.json();
    const experimentBody = await experiment.json();
    expect(researchBody).toMatchObject({
      handle: expect.stringContaining("opaque-research"),
      state: "CONCLUDED",
      question: "Should Atlas adopt the benchmark?",
      sources: [{ title: "Atlas benchmark", url: "https://github.com/acme/atlas" }],
    });
    expect(experimentBody).toMatchObject({
      handle: expect.stringContaining("opaque-experiment"),
      state: "RESULT_RECORDED",
      resultStatus: "FAILED",
      result: "Dependency timeout prevented a valid comparison.",
      humanConclusion: null,
    });
    expect(JSON.stringify(researchBody)).not.toContain(researchId);
    expect(JSON.stringify(experimentBody)).not.toContain(experimentId);
  });
});

function reviewDetail() {
  return {
    id: reviewId,
    scope: { projectId, workstreamId: null, workItemId: null },
    ownerId,
    state: "READY_FOR_REVIEW",
    version: 1,
    source: { kind: "URL", url: "https://github.com/acme/atlas" },
    displayUrl: "https://github.com/acme/atlas",
    retrievalState: "RETRIEVED",
    retrievalReason: null,
    contentFingerprint: "sha256:abcdef",
    output: {
      schemaVersion: "research-source-review-output.v1",
      summary: "A compact cited review.",
      relevance: "It may help validate the current Project question.",
      citations: [
        { sourceReference: "research-source:01ARZ3NDEKTSV4RRFFQ69G5FAV", locator: "README" },
      ],
      benefits: ["Reusable benchmark setup"],
      risks: ["Different runtime"],
      mismatches: ["The source uses another database"],
      uncertainties: ["Production load is unknown"],
      disposition: "DRAFT_EXPERIMENT",
      proposals: [
        {
          id: proposalId,
          kind: "EXPERIMENT",
          title: "Verify latency",
          rationale: "Measure before adoption.",
          sourceReferences: ["research-source:01ARZ3NDEKTSV4RRFFQ69G5FAV"],
          question: "Does this reduce p95 latency?",
          baseline: "Current p95 is 420 ms",
          measureNames: ["p95 latency"],
        },
      ],
    },
    outputProvenance: {
      promptVersion: "research-source-review-prompt.v1",
      routeTrace: {
        aiRunId,
        routeKey: "research.source-review.v1",
        routeConfigId,
        routeConfigVersion: 1,
      },
    },
    recoveryOptions: [],
    createdAt: "2026-08-06T08:00:00Z",
    updatedAt: "2026-08-06T08:01:00Z",
  };
}
