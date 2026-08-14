import { describe, expect, it } from "vitest";

import { buildProjectExperienceModel } from "./project-experience-model.js";

describe("buildProjectExperienceModel", () => {
  it("preserves accepted progress and selects the current milestone", () => {
    const model = buildProjectExperienceModel(fixture());
    expect(model.progress).toEqual({ kind: "accepted", label: "62%", value: 62 });
    expect(model.currentMilestone).toBe("API authentication");
    expect(model.collections.work).toHaveLength(1);
    expect(model.overview).toMatchObject({
      current: { name: "API authentication" },
      next: { name: "Pilot readiness" },
      blocker: { title: "Owner decision on PR #184" },
      latestChange: { title: "PR #182 merged" },
      nextAction: { label: "Review decision" },
    });
    expect(model.plan).toMatchObject({
      ownerName: "Codex",
      workstreams: [{ name: "API readiness" }],
    });
    expect(model.plan.milestones.map(({ name }) => name)).toEqual([
      "Discovery",
      "API authentication",
      "Pilot readiness",
    ]);
    expect(model.progressReview).toMatchObject({
      contract: { contractVersion: 2, calculationKind: "weighted" },
      latestSnapshot: { percent: 62, previousPercent: 50 },
      pendingChange: { state: "pending" },
      ambiguities: ["Owner confirmation"],
    });
    expect(model.documentWorkspace).toMatchObject({
      currentVersion: 2,
      sourceAvailability: "available",
      history: [{ version: 2 }, { version: 1 }],
    });
    expect(model.criteriaContract).toMatchObject({
      status: "review_required",
      nextAction: "review_proposal",
      actionOwner: "employee",
      proposal: { revision: 3, componentCount: 4, ambiguityCount: 1 },
    });
  });
});

export function fixture(): import("@evaluation/contracts/employee-experience").EmployeeProjectExperienceV1 {
  const projectId = "40000000-0000-4000-8000-000000000001";
  const source = {
    kind: "progress_contract" as const,
    label: "Approved Project contract",
    observedAt: "2026-08-13T07:00:00.000Z",
    freshness: "fresh" as const,
  };
  return {
    schemaVersion: "employee-project-experience.v1",
    generatedAt: "2026-08-13T07:05:00.000Z",
    project: {
      id: projectId,
      name: "Atlas Delivery",
      description: "Deliver secure API access and pilot integration for Atlas.",
      status: "active",
      ownerName: "Codex",
      workstreams: [{ id: "40000000-0000-4000-8000-000000000002", name: "API readiness" }],
    },
    document: {
      id: "40000000-0000-4000-8000-000000000003",
      title: "Project Document",
      version: 2,
      source: { ...source, kind: "project_document" },
      href: `/en/projects/${projectId}`,
    },
    documentWorkspace: {
      currentVersion: 2,
      sourceAvailability: "available",
      history: [
        {
          version: 2,
          reason: "Approved delivery revision",
          createdAt: "2026-07-20T08:00:00.000Z",
          sourceCount: 2,
        },
        {
          version: 1,
          reason: "Initial approved scope",
          createdAt: "2026-07-01T08:00:00.000Z",
          sourceCount: 1,
        },
      ],
      sources: [
        {
          kind: "github",
          label: "github.com/atlas/project",
          href: "https://github.com/atlas/project",
        },
        { kind: "upload", label: "requirements.pdf", href: null },
      ],
    },
    progress: { state: "accepted", percent: 62, source, explanation: "Approved contract rule" },
    progressReview: {
      contract: {
        contractVersion: 2,
        calculationKind: "weighted",
        effectiveAt: "2026-07-20T00:00:00.000Z",
        components: [
          {
            componentId: "40000000-0000-4000-8000-000000000007",
            name: "API error rate",
            kind: "operational_kpi",
            weight: 100,
            requiredEvidence: ["Verified KPI measurement"],
          },
        ],
      },
      latestSnapshot: {
        percent: 62,
        previousPercent: 50,
        reason: "Approved contract rule",
        observedAt: "2026-08-13T07:00:00.000Z",
        source,
      },
      pendingChange: { state: "pending", requestedAt: "2026-08-13T08:00:00.000Z" },
      ambiguities: ["Owner confirmation"],
    },
    criteriaContract: {
      sourceDocumentVersion: 2,
      status: "review_required",
      proposal: {
        state: "ready",
        revision: 3,
        origin: "human",
        componentCount: 4,
        ambiguityCount: 1,
        requestedAt: "2026-08-13T08:30:00.000Z",
      },
      nextAction: "review_proposal",
      actionOwner: "employee",
    },
    milestones: [
      {
        componentId: "40000000-0000-4000-8000-000000000004",
        name: "Discovery",
        kind: "milestone",
        state: "complete",
        percent: 100,
      },
      {
        componentId: "40000000-0000-4000-8000-000000000005",
        name: "API authentication",
        kind: "milestone",
        state: "current",
        percent: 62,
      },
      {
        componentId: "40000000-0000-4000-8000-000000000006",
        name: "Pilot readiness",
        kind: "milestone",
        state: "next",
        percent: null,
      },
    ],
    kpi: {
      componentId: "40000000-0000-4000-8000-000000000007",
      name: "API error rate",
      baseline: 4.1,
      current: 1.8,
      target: 1,
      unit: "%",
      direction: "decrease",
      source,
    },
    attention: [
      {
        id: "attention:1",
        title: "Owner decision on PR #184",
        subtitle: "API authentication",
        href: `/en/projects/${projectId}`,
        source,
      },
    ],
    collections: {
      work: [
        {
          id: "work:1",
          title: "Validate streaming fallback",
          subtitle: "Ready · Due today",
          href: "/en/tasks",
          source: { ...source, kind: "work_item" },
        },
      ],
      updates: [
        {
          id: "update:1",
          title: "Authentication fallback verified",
          subtitle: "Confirmed",
          href: `/en/projects/${projectId}`,
          source: { ...source, kind: "update" },
        },
      ],
      evidence: [
        {
          id: "evidence:1",
          title: "PR #182 merged",
          subtitle: "Suggested evidence",
          href: `/en/projects/${projectId}`,
          source: { ...source, kind: "github" },
        },
      ],
      documents: [
        {
          id: "document:1",
          title: "Project Document",
          subtitle: "Version 2",
          href: `/en/projects/${projectId}`,
          source: { ...source, kind: "project_document" },
        },
      ],
    },
    timeline: [
      {
        id: "timeline:1",
        kind: "verified_change",
        occurredAt: "2026-08-13T07:00:00.000Z",
        title: "PR #182 merged",
        projectId,
        projectName: "Atlas Delivery",
        statusLabel: "Verified",
        href: `/en/projects/${projectId}`,
        source: { ...source, kind: "github" },
      },
    ],
    nextCursor: null,
    smartBrief: {
      title: "What needs attention?",
      body: "Owner confirmation is pending.",
      source,
      why: "Review PR #184",
      consequence: "Nothing changes until confirmed.",
      action: { label: "Review decision", href: `/en/projects/${projectId}` },
    },
  };
}
