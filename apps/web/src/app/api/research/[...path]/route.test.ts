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

  it("creates an employee-owned Research question through a strict Project-scoped projection", async () => {
    const researchId = "77777777-7777-4777-8777-777777777777";
    mocks.fetchProtectedUpstream.mockResolvedValue({
      id: researchId,
      scope: { projectId, workstreamId: null, workItemId: null },
      ownerId,
      state: "DRAFT",
      revision: 1,
      version: 1,
      currentRevision: {
        id: "88888888-8888-4888-8888-888888888888",
        revision: 1,
        problemStatement: "Grounding needs a Project decision.",
        context: "Relevant to the approved Atlas delivery contract.",
        question: "Should Atlas adopt retrieval for grounded answers?",
        objective: "Decide whether retrieval improves grounded answers.",
        hypothesis: { kind: "NO_HYPOTHESIS", reason: "Question framing comes first." },
        assumptions: ["The Project document remains authoritative."],
        constraints: ["Use the AI Router only."],
        knownUncertainty: ["Production latency is unknown."],
        alternatives: [],
        decisionQuestion: "Adopt, refine, or reject retrieval?",
        sourceReferences: [],
        executionMode: "ai_assisted",
        origin: "EMPLOYEE",
        aiProvenance: null,
        authorId: ownerId,
        createdAt: "2026-08-15T08:00:00Z",
      },
      createdAt: "2026-08-15T08:00:00Z",
      transitionedAt: "2026-08-15T08:00:00Z",
    });

    const response = await POST(
      new Request("http://localhost:3000/api/research/records", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          question: "Should Atlas adopt retrieval for grounded answers?",
          relevance: "Relevant to the approved Atlas delivery contract.",
          assumptions: ["The Project document remains authoritative."],
          constraints: ["Use the AI Router only."],
        }),
      }),
      { params: Promise.resolve({ path: ["records"] }) },
    );

    const responseBody = await response.json();
    expect(response.status).toBe(200);
    expect(responseBody).toMatchObject({
      handle: `opaque-research-${"x".repeat(40)}`,
      state: "DRAFT",
      question: "Should Atlas adopt retrieval for grounded answers?",
      assumptions: ["The Project document remains authoritative."],
      constraints: ["Use the AI Router only."],
    });
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      method: "POST",
      path: "/api/v1/research",
      body: expect.objectContaining({
        scope: { projectId, workstreamId: null, workItemId: null },
        question: "Should Atlas adopt retrieval for grounded answers?",
        context: "Relevant to the approved Atlas delivery contract.",
        objective: "Relevant to the approved Atlas delivery contract.",
        executionMode: "ai_assisted",
      }),
      schema: expect.anything(),
    });
    expect(JSON.stringify(responseBody)).not.toContain(researchId);
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

  it("lists the Project Research trail with opaque handles and employee-safe fields", async () => {
    const researchId = "77777777-7777-4777-8777-777777777777";
    mocks.fetchProtectedUpstream
      .mockResolvedValueOnce([
        {
          id: researchId,
          projectId,
          workstreamId: null,
          workItemId: null,
          ownerId,
          state: "ACTIVE",
          revision: 1,
          version: 2,
          createdAt: "2026-08-15T08:00:00Z",
          transitionedAt: "2026-08-15T09:00:00Z",
        },
      ])
      .mockResolvedValueOnce({
        detail: {
          id: researchId,
          scope: { projectId, workstreamId: null, workItemId: null },
          state: "ACTIVE",
          version: 2,
          currentRevision: {
            question: "Should Atlas adopt retrieval?",
            objective: "Make a grounded Project decision.",
            assumptions: ["The approved document remains authoritative."],
            constraints: ["AI Router only."],
            knownUncertainty: ["Production latency is unknown."],
            decisionQuestion: "Adopt, refine, or reject retrieval?",
          },
        },
        sourceReferences: [
          {
            title: "Atlas benchmark",
            canonicalUrl: "https://github.com/acme/atlas",
            relevanceNote: "Candidate benchmark for Atlas.",
            credibilityNote: "Conditions require verification.",
          },
        ],
        conclusions: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            synthesis: "The bounded comparison supports a narrow adoption.",
            answer: "Adopt retrieval only for the tested flow.",
            remainingUncertainty: ["Production scale remains unverified."],
            decision: "ADOPT",
            rationale: "The employee reviewed the source and retained result.",
            nextAction: "Apply the finding to the next experiment.",
            confirmerId: ownerId,
            confirmedAt: "2026-08-15T11:00:00Z",
          },
        ],
        appliedLearning: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            researchConclusionId: "66666666-6666-4666-8666-666666666666",
            targetKind: "EXPERIMENT",
            whatChanged: "The next experiment now uses the bounded retrieval path.",
            causalRationale: "The confirmed conclusion narrowed the test scope.",
            confirmerId: ownerId,
            confirmedAt: "2026-08-15T11:05:00Z",
          },
        ],
      });

    const response = await GET(
      new Request(`http://localhost:3000/api/research/records?projectId=${projectId}`),
      { params: Promise.resolve({ path: ["records"] }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      expect.objectContaining({
        handle: `opaque-research-${"x".repeat(40)}`,
        state: "ACTIVE",
        question: "Should Atlas adopt retrieval?",
        sources: [
          {
            title: "Atlas benchmark",
            url: "https://github.com/acme/atlas",
            relevance: "Candidate benchmark for Atlas.",
            credibility: "Conditions require verification.",
          },
        ],
        decision: expect.objectContaining({
          decision: "ADOPT",
          answer: "Adopt retrieval only for the tested flow.",
        }),
        appliedLearning: [
          expect.objectContaining({
            targetKind: "EXPERIMENT",
            whatChanged: "The next experiment now uses the bounded retrieval path.",
          }),
        ],
      }),
    ]);
    expect(JSON.stringify(body)).not.toContain(researchId);
    expect(mocks.fetchProtectedUpstream).toHaveBeenNthCalledWith(1, {
      path: `/api/v1/research?projectId=${encodeURIComponent(projectId)}`,
      schema: expect.anything(),
    });
  });

  it("lists reproducible Experiment methods and retained failed runs under an opaque Research handle", async () => {
    const researchId = "77777777-7777-4777-8777-777777777777";
    const experimentId = "88888888-8888-4888-8888-888888888888";
    const researchHandle = `opaque-research-${"x".repeat(40)}`;
    mocks.open.mockReturnValue({
      kind: "context_handle",
      action: "research",
      id: researchId,
      projectId,
      revision: 2,
    });
    mocks.fetchProtectedUpstream
      .mockResolvedValueOnce([
        {
          id: experimentId,
          researchId,
          projectId,
          workstreamId: null,
          workItemId: null,
          title: "Compare retrieval grounding",
          state: "RESULT_RECORDED",
          methodRevision: 1,
          version: 3,
          createdAt: "2026-08-15T08:00:00Z",
          transitionedAt: "2026-08-15T10:00:00Z",
        },
      ])
      .mockResolvedValueOnce(experimentDetail({ experimentId, researchId }));

    const response = await GET(
      new Request(`http://localhost:3000/api/research/records/${researchHandle}/experiments`),
      { params: Promise.resolve({ path: ["records", researchHandle, "experiments"] }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      expect.objectContaining({
        handle: `opaque-experiment-${"x".repeat(40)}`,
        title: "Compare retrieval grounding",
        state: "RESULT_RECORDED",
        baseline: "420 ms",
        measures: ["p95 latency"],
        testCases: ["fixed-50-requests"],
        controls: ["same prompts and runtime"],
        resultStatus: "FAILED",
        result: "Dependency timeout retained for review.",
      }),
    ]);
    expect(JSON.stringify(body)).not.toContain(experimentId);
  });

  it("creates an editable Experiment method under the employee-selected Research", async () => {
    const researchId = "77777777-7777-4777-8777-777777777777";
    const experimentId = "88888888-8888-4888-8888-888888888888";
    const researchHandle = `opaque-research-${"x".repeat(40)}`;
    mocks.open.mockReturnValue({
      kind: "context_handle",
      action: "research",
      id: researchId,
      projectId,
      revision: 2,
    });
    mocks.fetchProtectedUpstream.mockResolvedValue(
      experimentDetail({ experimentId, researchId }).detail,
    );

    const response = await POST(
      new Request(`http://localhost:3000/api/research/records/${researchHandle}/experiments`, {
        method: "POST",
        body: JSON.stringify({
          title: "Compare retrieval grounding",
          hypothesis: "Retrieval improves grounded answers under the fixed sample.",
          baseline: "420 ms",
          measure: "p95 latency",
          testCase: "fixed-50-requests",
          control: "same prompts and runtime",
          versions: "Node 24 / model snapshot v1",
          reproducibility: "Run the same fixture with pinned versions.",
        }),
      }),
      { params: Promise.resolve({ path: ["records", researchHandle, "experiments"] }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      handle: `opaque-experiment-${"x".repeat(40)}`,
      title: "Compare retrieval grounding",
      baseline: "420 ms",
      measures: ["p95 latency"],
    });
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith({
      method: "POST",
      path: `/api/v1/research/${researchId}/experiments`,
      body: expect.objectContaining({
        input: expect.objectContaining({ researchId, title: "Compare retrieval grounding" }),
        method: expect.objectContaining({
          question: "Retrieval improves grounded answers under the fixed sample.",
          reproducibilityInstructions: "Run the same fixture with pinned versions.",
        }),
      }),
      schema: expect.anything(),
    });
  });

  it("records an employee decision and applied learning only after explicit confirmation", async () => {
    const researchId = "77777777-7777-4777-8777-777777777777";
    const conclusionId = "66666666-6666-4666-8666-666666666666";
    const researchHandle = `opaque-research-${"x".repeat(40)}`;
    mocks.open.mockReturnValue({
      kind: "context_handle",
      action: "research",
      id: researchId,
      projectId,
      revision: 1,
    });
    mocks.fetchProtectedUpstream
      .mockResolvedValueOnce({
        detail: {
          id: researchId,
          scope: { projectId, workstreamId: null, workItemId: null },
          state: "DRAFT",
          version: 1,
          currentRevision: {
            question: "Should Atlas adopt retrieval?",
            objective: "Make a grounded Project decision.",
            assumptions: [],
            constraints: [],
            knownUncertainty: [],
            decisionQuestion: "Adopt, refine, or reject retrieval?",
          },
        },
        sourceReferences: [],
        conclusions: [],
        appliedLearning: [],
      })
      .mockResolvedValueOnce({ version: 2 })
      .mockResolvedValueOnce({
        sourceReferenceId: "44444444-4444-4444-8444-444444444444",
        sourceReference: "research-source:44444444-4444-4444-8444-444444444444",
        version: 3,
      })
      .mockResolvedValueOnce({
        id: conclusionId,
        researchId,
        decision: "ADOPT",
        answer: "Adopt only for the tested flow.",
      })
      .mockResolvedValueOnce({
        id: "55555555-5555-4555-8555-555555555555",
        researchId,
        researchConclusionId: conclusionId,
        targetKind: "RESEARCH",
      });

    const response = await POST(
      new Request(`http://localhost:3000/api/research/records/${researchHandle}/decision`, {
        method: "POST",
        body: JSON.stringify({
          synthesis: "The bounded source and comparison support a narrow adoption.",
          answer: "Adopt only for the tested flow.",
          remainingUncertainty: ["Production scale remains unverified."],
          decision: "ADOPT",
          rationale: "The employee reviewed the source and retained result.",
          nextAction: "Apply the finding to the next experiment.",
          source: {
            url: "https://github.com/acme/atlas",
            title: "Atlas retrieval benchmark",
            relevance: "Directly informs the Atlas decision.",
            credibility: "Repository reviewed by the employee; conditions remain bounded.",
          },
          appliedChange: "The Project decision now adopts retrieval only for the tested flow.",
        }),
      }),
      { params: Promise.resolve({ path: ["records", researchHandle, "decision"] }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      state: "confirmed",
      decision: "ADOPT",
      appliedLearning: true,
    });
    expect(mocks.fetchProtectedUpstream).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: "POST",
        path: `/api/v1/research/${researchId}/transitions`,
      }),
    );
    expect(mocks.fetchProtectedUpstream).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        method: "POST",
        path: `/api/v1/research/${researchId}/conclusions`,
        body: expect.objectContaining({
          expectedVersion: 3,
          sourceReferences: ["research-source:44444444-4444-4444-8444-444444444444"],
        }),
      }),
    );
    expect(mocks.fetchProtectedUpstream).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        method: "POST",
        path: `/api/v1/research/${researchId}/applied-learning`,
        body: expect.objectContaining({
          expectedVersion: 4,
          researchConclusionId: conclusionId,
          target: { kind: "RESEARCH", id: researchId },
        }),
      }),
    );
  });

  it("recovers a confirmed decision when applied learning was interrupted", async () => {
    const researchId = "77777777-7777-4777-8777-777777777777";
    const conclusionId = "66666666-6666-4666-8666-666666666666";
    const researchHandle = `opaque-research-${"x".repeat(40)}`;
    mocks.open.mockReturnValue({
      kind: "context_handle",
      action: "research",
      id: researchId,
      projectId,
      revision: 3,
    });
    mocks.fetchProtectedUpstream
      .mockResolvedValueOnce({
        detail: {
          id: researchId,
          scope: { projectId, workstreamId: null, workItemId: null },
          state: "CONCLUDED",
          version: 4,
          currentRevision: {
            question: "Should Atlas adopt retrieval?",
            objective: "Make a grounded Project decision.",
            assumptions: [],
            constraints: [],
            knownUncertainty: [],
            decisionQuestion: "Adopt, refine, or reject retrieval?",
          },
        },
        sourceReferences: [],
        conclusions: [
          {
            id: conclusionId,
            synthesis: "The bounded source and comparison support a narrow adoption.",
            answer: "Adopt only for the tested flow.",
            remainingUncertainty: ["Production scale remains unverified."],
            decision: "ADOPT",
            rationale: "The employee reviewed the source and retained result.",
            nextAction: "Apply the finding to the next experiment.",
            confirmerId: ownerId,
            confirmedAt: "2026-08-15T11:00:00Z",
          },
        ],
        appliedLearning: [],
      })
      .mockResolvedValueOnce({
        id: "55555555-5555-4555-8555-555555555555",
        researchId,
        researchConclusionId: conclusionId,
        targetKind: "RESEARCH",
      });

    const response = await POST(
      new Request(`http://localhost:3000/api/research/records/${researchHandle}/decision`, {
        method: "POST",
        body: JSON.stringify({
          synthesis: "The bounded source and comparison support a narrow adoption.",
          answer: "Adopt only for the tested flow.",
          remainingUncertainty: ["Production scale remains unverified."],
          decision: "ADOPT",
          rationale: "The employee reviewed the source and retained result.",
          nextAction: "Apply the finding to the next experiment.",
          source: {
            url: "https://github.com/acme/atlas",
            title: "Atlas retrieval benchmark",
            relevance: "Directly informs the Atlas decision.",
            credibility: "Repository reviewed by the employee; conditions remain bounded.",
          },
          appliedChange: "The Project decision now adopts retrieval only for the tested flow.",
        }),
      }),
      { params: Promise.resolve({ path: ["records", researchHandle, "decision"] }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledTimes(2);
    expect(mocks.fetchProtectedUpstream).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: "POST",
        path: `/api/v1/research/${researchId}/applied-learning`,
        body: expect.objectContaining({ expectedVersion: 4, researchConclusionId: conclusionId }),
      }),
    );
  });
});

function experimentDetail({
  experimentId,
  researchId,
}: {
  experimentId: string;
  researchId: string;
}) {
  const methodId = "99999999-9999-4999-8999-999999999999";
  return {
    detail: {
      id: experimentId,
      researchId,
      scope: { projectId, workstreamId: null, workItemId: null },
      state: "RESULT_RECORDED",
      methodRevision: 1,
      version: 3,
      currentMethod: {
        id: methodId,
        revision: 1,
        question: "Does retrieval improve grounding under the fixed sample?",
        baseline: { description: "Current p95", value: "420 ms", sourceReference: null },
        measures: [
          {
            stableId: "p95_latency",
            name: "p95 latency",
            kind: "NUMERIC",
            unit: "ms",
            direction: "LOWER",
            baselineValue: "420",
            baselineReference: null,
            interpretationRule: "Lower is better under the same conditions.",
          },
        ],
        testCases: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            inputIdentity: "fixed-50-requests",
            expectedObservation: "Record p95 latency.",
            category: "benchmark",
            inclusionReason: "Stable comparison.",
          },
        ],
        controls: [
          {
            comparisonTarget: "current implementation",
            constantConditions: "same prompts and runtime",
          },
        ],
        conditions: ["Node 24 / model snapshot v1"],
        reproducibilityInstructions: "Run the same fixture with the pinned versions.",
        knownRisks: ["External dependency timeout"],
        failureCases: ["No valid comparison"],
        sourceReferences: [],
        executionMode: "manual",
        origin: "EMPLOYEE",
        aiProvenance: null,
        authorId: ownerId,
        createdAt: "2026-08-15T08:00:00Z",
      },
      createdAt: "2026-08-15T08:00:00Z",
      transitionedAt: "2026-08-15T10:00:00Z",
    },
    methodRevisions: [],
    runs: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        experimentId,
        methodRevisionId: methodId,
        sequence: 1,
        executorId: ownerId,
        startedAt: "2026-08-15T09:00:00Z",
        completedAt: "2026-08-15T09:05:00Z",
        resultStatus: "FAILED",
        environment: [{ name: "runtime", value: "Node 24" }],
        inputs: [],
        modelConfigurations: [{ name: "model", value: "snapshot-v1" }],
        unexpectedConditions: ["Dependency timeout"],
        executionNotes: "Dependency timeout retained for review.",
        sourceReferences: [],
        observations: [],
        createdAt: "2026-08-15T09:05:00Z",
      },
    ],
    aiDrafts: [],
    conclusions: [],
  };
}

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
