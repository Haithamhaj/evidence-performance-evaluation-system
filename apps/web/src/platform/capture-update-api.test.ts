import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareCaptureEvidence } from "./capture-update-api.js";

afterEach(() => vi.restoreAllMocks());

describe("Capture Update gateway", () => {
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
