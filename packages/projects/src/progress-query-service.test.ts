import { describe, expect, it, vi } from "vitest";

import { ProgressQueryService } from "./progress-query-service.js";

describe("ProgressQueryService Update scopes", () => {
  it("returns named Projects and only authorized Workstreams", async () => {
    const projectId = crypto.randomUUID();
    const workstreamId = crypto.randomUUID();
    const database = {
      project: {
        findMany: vi.fn(async () => [
          {
            id: projectId,
            name: "Atlas Delivery",
            workstreams: [{ id: workstreamId, name: "API readiness" }],
          },
        ]),
      },
    };
    const service = new ProgressQueryService(database as never);

    await expect(service.listUpdateScopes({ actorId: crypto.randomUUID() })).resolves.toEqual([
      {
        id: projectId,
        name: "Atlas Delivery",
        workstreams: [{ id: workstreamId, name: "API readiness" }],
      },
    ]);
  });
});

describe("ProgressQueryService Project pulse", () => {
  it("retains the last official percentage while newer source coverage is incomplete", async () => {
    const projectId = crypto.randomUUID();
    const componentId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    const database = projectProgressDatabase({
      projectId,
      componentId,
      snapshots: [
        {
          id: snapshotId,
          previousPercent: 50,
          percent: 64,
          reason: "The approved test baseline reached 64 percent.",
          componentState: [{ componentId, percent: 64 }],
          sources: [],
          createdAt: new Date("2026-08-01T10:00:00.000Z"),
        },
      ],
      recalculationRequests: [
        { state: "pending", createdAt: new Date("2026-08-02T10:00:00.000Z") },
      ],
    });
    const service = new ProgressQueryService(database as never);

    const result = (await service.getProjectProgress({
      actorId: crypto.randomUUID(),
      projectId,
    })) as any;

    expect(result.progress).toMatchObject({ state: "accepted", percent: 64 });
    expect(result.pulse).toMatchObject({
      officialProgress: 64,
      previousOfficialProgress: 50,
      sourceCoverage: "INSUFFICIENT",
    });
    expect(result.pulse.nextRequiredEvidence).toEqual([
      expect.objectContaining({ componentId, label: "Acceptance record" }),
    ]);
    expect(result.pendingChange).toEqual({
      state: "pending",
      requestedAt: "2026-08-02T10:00:00.000Z",
    });
    expect(result.contractProposal).toEqual({
      state: "ready",
      revision: 2,
      origin: "human",
      sourceDocumentVersion: 6,
      componentCount: 4,
      ambiguityCount: 1,
      requestedAt: "2026-08-03T10:00:00.000Z",
    });
  });

  it("explains a source-supported decrease from append-only snapshot history", async () => {
    const projectId = crypto.randomUUID();
    const componentId = crypto.randomUUID();
    const sourceId = crypto.randomUUID();
    const database = projectProgressDatabase({
      projectId,
      componentId,
      snapshots: [
        {
          id: crypto.randomUUID(),
          previousPercent: 70,
          percent: 55,
          reason: "The approved measured value decreased after verified rework.",
          componentState: [{ componentId, percent: 55 }],
          sources: [
            {
              componentId,
              sourceKind: "kpi_measurement",
              sourceId,
              sourceVersion: 2,
              measuredValue: 1.8,
              observedAt: new Date("2026-08-02T09:55:00.000Z"),
            },
          ],
          createdAt: new Date("2026-08-02T10:00:00.000Z"),
        },
      ],
      recalculationRequests: [
        { state: "completed", createdAt: new Date("2026-08-02T09:00:00.000Z") },
      ],
    });
    const service = new ProgressQueryService(database as never);

    const result = (await service.getProjectProgress({
      actorId: crypto.randomUUID(),
      projectId,
    })) as any;

    expect(result.pulse).toMatchObject({
      officialProgress: 55,
      previousOfficialProgress: 70,
      sourceCoverage: "SUFFICIENT",
      explanation: [
        expect.objectContaining({
          kind: "decrease",
          text: "The approved measured value decreased after verified rework.",
        }),
      ],
    });
    expect(result.pulse.milestoneStates).toEqual([
      expect.objectContaining({
        componentId,
        percent: 55,
        state: "in_progress",
        measuredValue: 1.8,
        observedAt: "2026-08-02T09:55:00.000Z",
      }),
    ]);
    expect(result.pendingChange).toBeNull();
  });
});

function projectProgressDatabase(input: {
  projectId: string;
  componentId: string;
  snapshots: any[];
  recalculationRequests: any[];
}) {
  return {
    project: {
      findFirst: vi.fn(async () => ({
        id: input.projectId,
        name: "Atlas Delivery",
        description: "Deliver the approved pilot.",
        status: "active",
      })),
    },
    progressContract: {
      findFirst: vi.fn(async () => ({
        id: crypto.randomUUID(),
        contractVersion: 2,
        version: 3,
        state: "active",
        calculationKind: "weighted",
        effectiveAt: new Date("2026-07-20T00:00:00.000Z"),
        components: [
          {
            id: input.componentId,
            kind: "kpi",
            name: "Accepted quality gate",
            description: "The source-supported accepted quality gate.",
            weight: 100,
            baseline: 0,
            target: 100,
            unit: "percent",
            direction: "increase",
            requiredEvidence: ["Acceptance record"],
          },
        ],
        snapshots: input.snapshots,
        recalculationRequests: input.recalculationRequests,
      })),
    },
    progressContractAiDraftRequest: {
      findFirst: vi.fn(async () => ({
        state: "ready",
        createdAt: new Date("2026-08-03T10:00:00.000Z"),
        documentVersion: { version: 6 },
        revisions: [
          {
            revision: 2,
            origin: "human",
            content: {
              components: [{}, {}, {}, {}],
              ambiguities: ["Confirm the pilot acceptance source"],
            },
          },
        ],
      })),
    },
  };
}
