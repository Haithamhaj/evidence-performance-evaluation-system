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
    progress: { state: "accepted", percent: 62, source, explanation: "Approved contract rule" },
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
