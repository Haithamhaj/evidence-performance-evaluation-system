import { afterEach, describe, expect, it, vi } from "vitest";

import {
  executeSelectedActions,
  rejectEvidenceDraft,
  ReviewCommandError,
} from "./review-confirmation-api.js";

afterEach(() => vi.restoreAllMocks());

describe("review confirmation commands", () => {
  it("reports Update success and Evidence failure independently", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(200, { revision: 2 }))
      .mockResolvedValueOnce(
        response(200, {
          id: "10000000-0000-4000-8000-000000000011",
          updateSourceId: "10000000-0000-4000-8000-000000000012",
          draftRevisionId: "10000000-0000-4000-8000-000000000013",
          employeeId: "10000000-0000-4000-8000-000000000014",
          projectId: "10000000-0000-4000-8000-000000000001",
          workstreamId: null,
          workItemId: null,
          confirmedAt: "2026-08-13T10:00:00Z",
          sourceReferences: ["github:pr:184"],
        }),
      )
      .mockResolvedValueOnce(response(503, { messageKey: "errors.unavailable" }))
      .mockResolvedValueOnce(response(503, { messageKey: "errors.unavailable" }));

    const result = await executeSelectedActions([
      {
        kind: "update",
        id: "10000000-0000-4000-8000-000000000005",
        expectedVersion: 1,
        summary: "Update",
        result: "Result",
        nextAction: "Next",
        relatedProgressComponentIds: [],
      },
      {
        kind: "evidence",
        id: "10000000-0000-4000-8000-000000000006",
        expectedVersion: 2,
        supportedClaim: "Claim",
        contributionContext: "Contribution",
      },
    ]);

    expect(result.outcomes.map(({ kind, state }) => [kind, state])).toEqual([
      ["update", "confirmed"],
      ["evidence", "retryable_error"],
    ]);
    const calls = vi.mocked(globalThis.fetch).mock.calls;
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({
      expectedDraftRevision: 2,
      reason: "Employee confirmed the selected review action.",
    });
  });

  it("sends the Evidence confirmation contract without Update-only fields", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(200, { revision: 2 }))
      .mockResolvedValueOnce(
        response(200, {
          id: "10000000-0000-4000-8000-000000000011",
        }),
      );

    await executeSelectedActions([
      {
        kind: "evidence",
        id: "10000000-0000-4000-8000-000000000006",
        expectedVersion: 1,
        supportedClaim: "Claim",
        contributionContext: "Contribution",
      },
    ]);

    const calls = vi.mocked(globalThis.fetch).mock.calls;
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({
      expectedRevision: 2,
      reason: "Employee confirmed the selected review action.",
    });
  });

  it("maps stale commands without discarding independent edits", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(409, { messageKey: "errors.stale" }));
    const result = await executeSelectedActions([
      {
        kind: "update",
        id: "10000000-0000-4000-8000-000000000005",
        expectedVersion: 1,
        summary: "Update",
        result: "Result",
        nextAction: "Next",
        relatedProgressComponentIds: [],
      },
    ]);
    expect(result.outcomes[0]?.state).toBe("stale");
  });

  it("does not expose an official progress mutation command", () => {
    expect(new ReviewCommandError(403).status).toBe(403);
  });

  it("rejects an Evidence suggestion only through the explicit human decision route", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response(200, { revision: 2, state: "rejected" }),
    );

    await rejectEvidenceDraft({
      expectedRevision: 1,
      id: "10000000-0000-4000-8000-000000000006",
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/daily-work/evidence/10000000-0000-4000-8000-000000000006/reject",
      expect.objectContaining({
        body: JSON.stringify({
          expectedRevision: 1,
          reason: "Employee dismissed the Evidence suggestion during review.",
        }),
        method: "POST",
      }),
    );
  });
});

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}
