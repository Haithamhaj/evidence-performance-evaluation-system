import { describe, expect, it, vi } from "vitest";

import { ReadinessQueryService } from "./readiness-query.service.js";

const employeeId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const projectScopeId = `project:${projectId}`;
const workstreamId = crypto.randomUUID();
const workstreamScopeId = `workstream:${workstreamId}`;

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
    const service = new ReadinessQueryService(source);

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
    const service = new ReadinessQueryService({
      loadEmployeeMonth: vi.fn(),
      loadManagerProjectMonth: vi.fn(async () => ({
        project: { id: projectId, name: "Customer workspace" },
        gapKinds: ["silent_active_scope" as const],
      })),
    });

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
});
