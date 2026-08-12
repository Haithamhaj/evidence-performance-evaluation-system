import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connected = vi.hoisted(() => ({
  linkContextProject: vi.fn(),
  listConnectedWorkContext: vi.fn(),
  setContextExclusion: vi.fn(),
  unlinkContextProject: vi.fn(),
}));

vi.mock("./connected-work-context-api.js", () => connected);

import { sourceReviewGateway } from "./source-review-api.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const sourceEventId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  connected.listConnectedWorkContext.mockResolvedValue({
    mode: "live",
    synthetic: false,
    connection: { status: "connected", lastSuccessfulSyncAt: null },
    items: [],
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("sourceReviewGateway", () => {
  it("reads only principal-bound source routes and maps verified GitHub facts as suggestions", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        items: [
          {
            id: crypto.randomUUID(),
            kind: "project_fact",
            projectId,
            workstreamId: null,
            workItemId: null,
            employeeId: null,
            occurredAt: "2026-08-12T09:00:00.000Z",
            title: "PR #184",
            detail: "Verified GitHub fact",
            sourceReferences: [`github-source-event:${sourceEventId}`],
            sourceProvenance: "github_automated",
            reviewState: "automated_project_fact",
            project: { id: projectId, name: "Atlas Delivery" },
            workstream: null,
            workItem: null,
            relatedKpiComponents: [],
            relatedCriteria: [],
            verificationState: null,
            decisionOutcome: null,
          },
        ],
        nextCursor: null,
      }),
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(
      sourceReviewGateway.load([{ id: projectId, name: "Atlas Delivery" }]),
    ).resolves.toEqual([expect.objectContaining({ kind: "github", id: sourceEventId, projectId })]);
    expect(fetcher).toHaveBeenCalledWith(
      `/api/daily-work/timeline?projectId=${projectId}&limit=10`,
      { cache: "no-store" },
    );
    expect(JSON.stringify(fetcher.mock.calls)).not.toMatch(/actor|employeeId|userId/u);
  });

  it("uses the existing protected Project-link and exclusion commands", async () => {
    const sourceId = crypto.randomUUID();
    await sourceReviewGateway.correctGoogleProject({
      sourceId,
      previousProjectId: crypto.randomUUID(),
      projectId,
      reason: "Employee confirmed source Project during evidence review",
    });
    await sourceReviewGateway.excludeGoogleSource(sourceId);

    expect(connected.unlinkContextProject).toHaveBeenCalledWith({
      id: sourceId,
      reason: "Employee corrected the source Project before evidence review",
    });
    expect(connected.unlinkContextProject.mock.invocationCallOrder[0]).toBeLessThan(
      connected.linkContextProject.mock.invocationCallOrder[0]!,
    );
    expect(connected.linkContextProject).toHaveBeenCalledWith({
      id: sourceId,
      projectId,
      reason: "Employee confirmed source Project during evidence review",
    });
    expect(connected.setContextExclusion).toHaveBeenCalledWith(sourceId, true);
  });

  it("reports an explicit unlinked recovery state when corrected Project relinking fails", async () => {
    connected.unlinkContextProject.mockResolvedValue({ linked: false });
    connected.linkContextProject.mockRejectedValueOnce(new Error("upstream failed"));

    await expect(
      sourceReviewGateway.correctGoogleProject({
        sourceId: crypto.randomUUID(),
        previousProjectId: crypto.randomUUID(),
        projectId,
        reason: "Employee confirmed source Project during evidence review",
      }),
    ).rejects.toMatchObject({ code: "SOURCE_REVIEW_RELINK_FAILED", previousLinkRemoved: true });
  });

  it("does not expose excluded private Google items to review", async () => {
    connected.listConnectedWorkContext.mockResolvedValue({
      mode: "live",
      synthetic: false,
      connection: { status: "connected", lastSuccessfulSyncAt: null },
      items: [
        {
          id: crypto.randomUUID(),
          provider: "GOOGLE_GMAIL",
          occurredAt: "2026-08-12T08:00:00.000Z",
          title: "Excluded message",
          summary: null,
          sourceUrl: null,
          privacy: "PRIVATE",
          excluded: true,
          projectId: null,
          sourceExclusion: null,
        },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ items: [], nextCursor: null })),
    );

    await expect(
      sourceReviewGateway.load([{ id: projectId, name: "Atlas Delivery" }]),
    ).resolves.toEqual([]);
  });
});
