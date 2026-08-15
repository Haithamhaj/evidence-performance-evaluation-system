import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareCaptureEvidence, prepareCaptureUpdate } from "./capture-update-api.js";

afterEach(() => vi.restoreAllMocks());

describe("Capture Update gateway", () => {
  it("forwards typed file and URL sources with the private Update draft", async () => {
    const sessionId = "10000000-0000-4000-8000-000000000006";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          state: "draft_with_question",
          sessionId,
          sessionVersion: 1,
          draft: {
            id: "10000000-0000-4000-8000-000000000007",
            sessionId,
            revision: 1,
            summary: "Source-backed Update",
            result: "Result needs one detail.",
            blocker: null,
            nextAction: "Record the accepted Update.",
            contributionContext: "Employee-provided context.",
            executionMode: "ai_assisted",
            sourceReferences: ["update-source:10000000-0000-4000-8000-000000000008"],
            evidenceClaimDrafts: [],
            evidenceIds: [],
            documentationNeeds: [],
            relatedProgressComponentIds: [],
            comparison: {
              previousAcceptedEventId: null,
              changedFields: [],
              explanation: "First Update.",
            },
          },
          turnId: "10000000-0000-4000-8000-000000000009",
          turnNumber: 1,
          question: "What result was verified?",
          affects: ["result"],
          remainingFieldCount: 1,
        }),
        { headers: { "content-type": "application/json" }, status: 200 },
      ),
    );

    await prepareCaptureUpdate({
      idempotencyKey: "10000000-0000-4000-8000-000000000002",
      projectId: "10000000-0000-4000-8000-000000000003",
      workItemId: null,
      rawText: "See the attached result.",
      sources: [
        {
          kind: "image",
          uploadedSourceId: "10000000-0000-4000-8000-000000000004",
        },
        { kind: "url", url: "https://example.invalid/result" },
      ],
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      sources: [
        {
          kind: "image",
          uploadedSourceId: "10000000-0000-4000-8000-000000000004",
        },
        { kind: "url", url: "https://example.invalid/result" },
      ],
    });
  });

  it("prepares a private source-backed Evidence draft for employee review", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "10000000-0000-4000-8000-000000000001",
          revision: 1,
          supportedClaim: "The Capture journey is verified by the linked commit.",
          contributionContext: "Codex implemented and verified the employee journey.",
          verificationState: "unverified",
        }),
        { headers: { "content-type": "application/json" }, status: 200 },
      ),
    );

    await prepareCaptureEvidence({
      idempotencyKey: "10000000-0000-4000-8000-000000000002",
      projectId: "10000000-0000-4000-8000-000000000003",
      workItemId: "10000000-0000-4000-8000-000000000004",
      updateSourceId: "10000000-0000-4000-8000-000000000005",
      source: { kind: "url", url: "https://github.com/example/repository/commit/abc123" },
      supportedClaim: "The Capture journey is verified by the linked commit.",
      contributionContext: "Codex implemented and verified the employee journey.",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/daily-work/evidence",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual(
      expect.objectContaining({
        capturedFromWorkItem: true,
        executionMode: "ai_assisted",
        projectId: "10000000-0000-4000-8000-000000000003",
        source: { kind: "url", url: "https://github.com/example/repository/commit/abc123" },
        updateSourceId: "10000000-0000-4000-8000-000000000005",
        workItemId: "10000000-0000-4000-8000-000000000004",
      }),
    );
  });
});
