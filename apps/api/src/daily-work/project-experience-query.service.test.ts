import { describe, expect, it } from "vitest";

import { ProjectExperienceQueryService } from "./project-experience-query.service.js";

const actor = { userId: "20000000-0000-4000-8000-000000000001", active: true };
const projectId = "20000000-0000-4000-8000-000000000002";
const documentVersionId = "20000000-0000-4000-8000-000000000003";

describe("ProjectExperienceQueryService", () => {
  it("composes one authorized Project without recalculating progress", async () => {
    const service = new ProjectExperienceQueryService({
      project: async () => projectView(),
      document: async () => documentDetail(),
      myWork: async () => ({
        groups: [{ key: "today", items: [workItem()], collapsedByDefault: false }],
      }),
      timeline: async () => ({ items: [timelineItem()], nextCursor: null }),
    });

    const result = await service.load(actor, projectId);

    expect(result).toMatchObject({
      project: { id: projectId, name: "Atlas Delivery", ownerName: "Codex" },
      document: { id: documentVersionId, version: 2 },
      progress: { state: "accepted", percent: 62 },
      kpi: { name: "API error rate", current: 1.8, target: 1 },
      progressReview: {
        contract: { contractVersion: 2, calculationKind: "weighted" },
        latestSnapshot: { percent: 62, previousPercent: 50 },
        pendingChange: { state: "pending" },
        ambiguities: ["Owner confirmation"],
      },
      documentWorkspace: {
        currentVersion: 2,
        sourceAvailability: "available",
        history: [{ version: 2 }, { version: 1 }],
        sources: [
          { kind: "github", label: "github.com/atlas/project" },
          { kind: "upload", label: "requirements.pdf" },
        ],
      },
    });
    expect(result.collections.work).toHaveLength(1);
    expect(result.timeline).toHaveLength(1);
  });

  it("keeps missing progress and document states honest", async () => {
    const service = new ProjectExperienceQueryService({
      project: async () => ({
        ...projectView(),
        contract: null,
        progress: { state: "awaiting_contract" },
        pulse: { milestoneStates: [], nextRequiredEvidence: [], explanation: [] },
        contractDraftSourceRequest: null,
        document: null,
        pendingChange: null,
      }),
      document: async () => null,
      myWork: async () => ({ groups: [] }),
      timeline: async () => ({ items: [], nextCursor: null }),
    });

    const result = await service.load(actor, projectId);

    expect(result.progress).toEqual({ state: "awaiting_contract" });
    expect(result.document).toBeNull();
    expect(result.kpi).toBeNull();
    expect(result.progressReview).toEqual({
      contract: null,
      latestSnapshot: null,
      pendingChange: null,
      ambiguities: [],
    });
    expect(result.attention.map(({ title }) => title)).toContain("Project document is missing");
  });

  it("rejects inactive actors before protected readers", async () => {
    const service = new ProjectExperienceQueryService({
      project: async () => {
        throw new Error("must not read");
      },
      document: async () => null,
      myWork: async () => ({ groups: [] }),
      timeline: async () => ({ items: [], nextCursor: null }),
    });
    await expect(service.load({ ...actor, active: false }, projectId)).rejects.toMatchObject({
      status: 403,
    });
  });
});

function projectView() {
  return {
    project: {
      id: projectId,
      name: "Atlas Delivery",
      description: "Deliver secure API access.",
      status: "active",
    },
    workspace: {
      project: {
        id: projectId,
        name: "Atlas Delivery",
        description: "Deliver secure API access.",
        status: "active",
      },
      people: [
        {
          person: { id: actor.userId, displayName: "Codex" },
          responsibilityType: "original",
          endsAt: null,
        },
      ],
      workstreams: [{ id: "20000000-0000-4000-8000-000000000010", name: "API readiness" }],
    },
    document: { id: documentVersionId, title: "Project Document", version: 2 },
    contract: {
      contractVersion: 2,
      calculationKind: "weighted",
      effectiveAt: "2026-07-20T00:00:00.000Z",
      components: [
        {
          id: "20000000-0000-4000-8000-000000000004",
          kind: "operational_kpi",
          name: "API error rate",
          baseline: 4.1,
          target: 1,
          unit: "%",
          direction: "decrease",
        },
      ],
    },
    progress: {
      state: "accepted",
      snapshotId: "20000000-0000-4000-8000-000000000008",
      percent: 62,
      reason: "Approved contract rule",
      updatedAt: "2026-08-13T07:00:00.000Z",
    },
    pendingChange: {
      state: "pending",
      requestedAt: "2026-08-13T08:00:00.000Z",
    },
    pulse: {
      milestoneStates: [
        {
          componentId: "20000000-0000-4000-8000-000000000005",
          name: "Discovery",
          kind: "milestone",
          percent: 100,
          state: "complete",
        },
        {
          componentId: "20000000-0000-4000-8000-000000000006",
          name: "API authentication",
          kind: "milestone",
          percent: 62,
          state: "in_progress",
        },
        {
          componentId: "20000000-0000-4000-8000-000000000004",
          name: "API error rate",
          kind: "operational_kpi",
          percent: 62,
          measuredValue: 1.8,
          observedAt: "2026-08-13T07:00:00.000Z",
          state: "in_progress",
        },
      ],
      nextRequiredEvidence: [
        {
          componentId: "20000000-0000-4000-8000-000000000006",
          componentName: "API authentication",
          label: "Owner confirmation",
        },
      ],
      explanation: [],
      officialProgress: 62,
      previousOfficialProgress: 50,
    },
    contractDraftSourceRequest: {
      documentVersionId,
      sourceVersion: 2,
      sourceChecksum: "a".repeat(64),
    },
  };
}

function workItem() {
  return {
    id: "20000000-0000-4000-8000-000000000020",
    projectId,
    title: "Validate streaming fallback",
    status: "ready",
    dueAt: "2026-08-13T12:00:00.000Z",
  };
}

function timelineItem() {
  return {
    id: "20000000-0000-4000-8000-000000000030",
    kind: "update",
    projectId,
    workstreamId: null,
    workItemId: null,
    employeeId: actor.userId,
    occurredAt: "2026-08-13T07:00:00.000Z",
    title: "Authentication fallback verified",
    detail: "Staging result confirmed",
    sourceReferences: ["update:1"],
    sourceProvenance: "employee_text",
    reviewState: "employee_confirmed",
    project: { id: projectId, name: "Atlas Delivery" },
    workstream: null,
    workItem: null,
    relatedKpiComponents: [],
    relatedCriteria: [],
    verificationState: "unverified",
    decisionOutcome: null,
  };
}

function documentDetail() {
  return {
    id: documentVersionId,
    kind: "project",
    resourceId: projectId,
    templateVersionId: "20000000-0000-4000-8000-000000000040",
    currentVersion: 2,
    createdAt: "2026-07-01T08:00:00.000Z",
    versions: [
      {
        id: "20000000-0000-4000-8000-000000000041",
        documentId: documentVersionId,
        version: 1,
        templateVersionId: "20000000-0000-4000-8000-000000000040",
        createdById: actor.userId,
        reason: "Initial approved scope",
        createdAt: "2026-07-01T08:00:00.000Z",
        sources: [
          {
            id: "20000000-0000-4000-8000-000000000042",
            position: 1,
            sourceType: "upload",
            uploadedSource: {
              id: "20000000-0000-4000-8000-000000000043",
              kind: "project",
              resourceId: projectId,
              filename: "requirements.pdf",
              detectedMime: "application/pdf",
              detectedType: "pdf",
              byteSize: 1200,
              sha256: "a".repeat(64),
              createdAt: "2026-07-01T08:00:00.000Z",
            },
          },
        ],
      },
      {
        id: "20000000-0000-4000-8000-000000000044",
        documentId: documentVersionId,
        version: 2,
        templateVersionId: "20000000-0000-4000-8000-000000000040",
        createdById: actor.userId,
        reason: "Approved delivery revision",
        createdAt: "2026-07-20T08:00:00.000Z",
        sources: [
          {
            id: "20000000-0000-4000-8000-000000000045",
            position: 1,
            sourceType: "github",
            url: "https://github.com/atlas/project",
            sourceId: "atlas/project",
          },
        ],
      },
    ],
  };
}
