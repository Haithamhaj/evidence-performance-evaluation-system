import { describe, expect, it, vi } from "vitest";

import { ResearchTimelineReader } from "./timeline-reader.js";

describe("ResearchTimelineReader", () => {
  it("emits confirmed lifecycle events and excludes AI drafts", async () => {
    const projectId = crypto.randomUUID();
    const researchId = crypto.randomUUID();
    const transitionId = crypto.randomUUID();
    const client = {
      researchTransition: {
        findMany: vi.fn(async () => [
          {
            id: transitionId,
            researchId,
            toState: "ACTIVE",
            reason: "Approved",
            actorId: crypto.randomUUID(),
            effectiveAt: new Date("2026-08-01T10:00:00Z"),
            research: scope(projectId),
          },
        ]),
      },
      experiment: { findMany: vi.fn(async () => []) },
      experimentRun: { findMany: vi.fn(async () => []) },
      experimentConclusion: { findMany: vi.fn(async () => []) },
      researchConclusion: { findMany: vi.fn(async () => []) },
      appliedLearning: { findMany: vi.fn(async () => []) },
    };
    const reader = new ResearchTimelineReader(client as never);

    const rows = await reader.readTimeline({
      actorId: crypto.randomUUID(),
      projectId,
      workstreamId: null,
      limit: 20,
      cursor: null,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        id: transitionId,
        kind: "research",
        reviewState: "human_decision",
      }),
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/aiDraft|autosave|draft_revision/iu);
  });

  it("preserves every meaningful Experiment transition from append-only audit history", async () => {
    const projectId = crypto.randomUUID();
    const researchId = crypto.randomUUID();
    const experimentId = crypto.randomUUID();
    const actorId = crypto.randomUUID();
    const states = ["READY", "RUNNING", "RESULT_RECORDED", "CONCLUDED"] as const;
    const history = states.map((toState, index) => ({
      id: crypto.randomUUID(),
      experimentId,
      actorId,
      toState,
      reason: index === 0 ? "Method approved" : null,
      occurredAt: new Date(Date.UTC(2026, 7, 1, 10 + index)).toISOString(),
    }));
    const client = {
      researchTransition: { findMany: vi.fn(async () => []) },
      researchRevision: { findMany: vi.fn(async () => []) },
      experiment: {
        findMany: vi.fn(async () => [
          {
            id: experimentId,
            researchId,
            title: "Bounded experiment",
            workstreamId: null,
            workItemId: null,
            research: scope(projectId),
            workstream: null,
            workItem: null,
          },
        ]),
      },
      experimentRun: { findMany: vi.fn(async () => []) },
      experimentConclusion: { findMany: vi.fn(async () => []) },
      researchConclusion: { findMany: vi.fn(async () => []) },
      appliedLearning: { findMany: vi.fn(async () => []) },
    };
    const transitionHistory = { readTransitions: vi.fn(async () => history) };
    const reader = new ResearchTimelineReader(client as never, transitionHistory);

    const rows = await reader.readTimeline({
      actorId,
      projectId,
      workstreamId: null,
      limit: 20,
      cursor: null,
    });

    expect(rows.map(({ title }) => title)).toEqual([
      "Experiment concluded",
      "Experiment result recorded",
      "Experiment running",
      "Experiment ready",
    ]);
    expect(rows.map(({ id }) => id)).toEqual(history.toReversed().map(({ id }) => id));
  });
});

function scope(projectId: string) {
  return {
    projectId,
    workstreamId: null,
    workItemId: null,
    project: { id: projectId, name: "Atlas" },
    workstream: null,
    workItem: null,
  };
}
