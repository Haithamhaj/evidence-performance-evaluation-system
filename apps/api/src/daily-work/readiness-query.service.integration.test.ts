import { describe, expect, it, vi } from "vitest";

import { ReadinessQueryService } from "./readiness-query.service.js";

const employeeId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const projectScopeId = `project:${projectId}`;
const workstreamId = crypto.randomUUID();
const workstreamScopeId = `workstream:${workstreamId}`;
const noLeave = { findApprovedLeave: vi.fn(async () => null) };

describe("ReadinessQueryService", () => {
  it("identifies thin source records using boolean gaps, not quotas or penalties", async () => {
    const source = {
      loadEmployeeMonth: vi.fn(async () => ({
        project: { id: projectId, name: "Customer workspace" },
        scopes: [
          { id: projectScopeId, kind: "project" as const, name: "Customer workspace" },
          { id: workstreamScopeId, kind: "workstream" as const, name: "Daily operations" },
        ],
        substantiveScopeIds: [projectScopeId],
        evidenceScopeIds: [],
        artifactRequiredScopeIds: [workstreamScopeId],
      })),
    };
    const service = new ReadinessQueryService(source, null, noLeave);

    const result = await service.employeeProjectMonth(
      employeeId,
      projectId,
      new Date("2026-08-20"),
    );

    expect(result.state).toBe("attention");
    expect(result.gaps).toEqual([
      expect.objectContaining({ kind: "silent_active_scope", scopeId: workstreamScopeId }),
      expect.objectContaining({
        kind: "artifact_criterion_without_source",
        scopeId: workstreamScopeId,
      }),
    ]);
    expect(JSON.stringify(result)).not.toMatch(/percentage|percent|quota|penalty|rating|rank/iu);
  });

  it("returns a manager-safe coarse projection without employee correction detail", async () => {
    const service = new ReadinessQueryService(
      {
        loadEmployeeMonth: vi.fn(),
        loadManagerProjectMonth: vi.fn(async () => ({
          project: { id: projectId, name: "Customer workspace" },
          gapKinds: ["silent_active_scope" as const],
        })),
      },
      null,
      noLeave,
    );

    const result = await service.managerProjectMonth(
      crypto.randomUUID(),
      projectId,
      new Date("2026-08-20"),
    );

    expect(result).toEqual({
      project: { id: projectId, name: "Customer workspace" },
      month: "2026-08",
      state: "attention",
      gapKinds: ["silent_active_scope"],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /employee|instruction|corrective|percentage|percent|rank|score|quota/iu,
    );
  });

  it("composes employee-only Research actions without scoring", async () => {
    const researchId = crypto.randomUUID();
    const service = new ReadinessQueryService(
      {
        loadEmployeeMonth: vi.fn(async () => ({
          project: { id: projectId, name: "Customer workspace" },
          scopes: [{ id: projectScopeId, kind: "project" as const, name: "Customer workspace" }],
          substantiveScopeIds: [projectScopeId],
          evidenceScopeIds: [],
          artifactRequiredScopeIds: [],
        })),
      },
      {
        readEmployeeProjectGaps: vi.fn(async () => [
          {
            actionCode: "RESEARCH_DECISION_MISSING" as const,
            projectId,
            workstreamId: null,
            workItemId: null,
            researchId,
            experimentId: null,
          },
        ]),
      },
      noLeave,
    );

    const result = await service.employeeProjectMonth(
      employeeId,
      projectId,
      new Date("2026-08-20"),
    );

    expect(result.gaps).toEqual([
      expect.objectContaining({
        kind: "RESEARCH_DECISION_MISSING",
        correctiveAction: "RESEARCH_DECISION_MISSING",
        researchId,
      }),
    ]);
    expect(result.state).toBe("attention");
  });

  it("excludes approved leave from silence while preserving source and research gaps", async () => {
    const researchId = crypto.randomUUID();
    const service = new ReadinessQueryService(
      {
        loadEmployeeMonth: vi.fn(async () => ({
          project: { id: projectId, name: "Customer workspace" },
          scopes: [{ id: projectScopeId, kind: "project" as const, name: "Customer workspace" }],
          substantiveScopeIds: [],
          evidenceScopeIds: [],
          artifactRequiredScopeIds: [projectScopeId],
        })),
      },
      {
        readEmployeeProjectGaps: vi.fn(async () => [
          {
            actionCode: "RESEARCH_DECISION_MISSING" as const,
            projectId,
            workstreamId: null,
            workItemId: null,
            researchId,
            experimentId: null,
          },
        ]),
      },
      { findApprovedLeave: vi.fn(async () => ({ leaveId: crypto.randomUUID() })) },
    );

    const result = await service.employeeProjectMonth(
      employeeId,
      projectId,
      new Date("2026-08-20"),
    );

    expect(result.approvedLeaveExcluded).toBe(true);
    expect(result.gaps.map((gap) => gap.kind)).toEqual([
      "artifact_criterion_without_source",
      "RESEARCH_DECISION_MISSING",
    ]);
  });
});
