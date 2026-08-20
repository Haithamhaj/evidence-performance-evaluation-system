import { describe, expect, it, vi } from "vitest";

import { ContinuityExperienceQueryService } from "./continuity-experience-query.service.js";

describe("ContinuityExperienceQueryService", () => {
  it("returns the manager queue without handover body content", async () => {
    const source = {
      load: vi.fn(async () => ({
        mode: "manager" as const,
        leaves: [
          {
            id: "20000000-0000-4000-8000-000000000001",
            employeeId: "20000000-0000-4000-8000-000000000002",
            employeeName: "Codex",
            state: "SUBMITTED" as const,
            startsAt: "2026-08-20T00:00:00.000Z",
            endsAt: "2026-08-22T00:00:00.000Z",
            affectedScopeCount: 1,
            version: 1,
            handover: null,
          },
        ],
        availableScopes: [],
        delegationCandidates: [],
        delegations: [
          {
            id: "20000000-0000-4000-8000-000000000010",
            leaveId: "20000000-0000-4000-8000-000000000001",
            role: "manager" as const,
            ownerName: "Codex",
            delegateName: "Eva",
            state: "ACTIVE" as const,
            startsAt: "2026-08-20T00:00:00.000Z",
            endsAt: "2026-08-22T00:00:00.000Z",
            scopes: [
              {
                kind: "PROJECT" as const,
                id: "20000000-0000-4000-8000-000000000011",
                name: "Evaluation System",
                actions: ["project.update"],
              },
            ],
            delegateConfirmed: true,
            openAccessGapCount: 0,
            returnHandover: null,
          },
        ],
      })),
    };
    const service = new ContinuityExperienceQueryService(
      source,
      () => new Date("2026-08-15T08:00:00Z"),
    );

    const result = await service.load("20000000-0000-4000-8000-000000000003");

    expect(result.mode).toBe("manager");
    expect(result.leaves[0]?.state).toBe("SUBMITTED");
    expect(JSON.stringify(result)).not.toContain("completedWork");
    expect(JSON.stringify(result)).not.toContain("blockersAndRisks");
    expect(result.delegations[0]?.endsAt).toBe("2026-08-22T00:00:00.000Z");
    expect(JSON.stringify(result)).not.toMatch(/score|rating|rank/iu);
  });

  it("projects elapsed acting access as expired even before a background state refresh", async () => {
    const service = new ContinuityExperienceQueryService(
      {
        load: vi.fn(async () => ({
          mode: "employee" as const,
          leaves: [],
          availableScopes: [],
          delegationCandidates: [],
          delegations: [
            {
              id: "20000000-0000-4000-8000-000000000010",
              leaveId: "20000000-0000-4000-8000-000000000001",
              role: "delegate" as const,
              ownerName: "Eva",
              delegateName: "Codex",
              state: "ACTIVE" as const,
              startsAt: "2026-08-10T00:00:00.000Z",
              endsAt: "2026-08-14T00:00:00.000Z",
              scopes: [],
              delegateConfirmed: true,
              openAccessGapCount: 0,
              returnHandover: null,
            },
          ],
        })),
      },
      () => new Date("2026-08-15T09:00:00.000Z"),
    );

    await expect(service.load("20000000-0000-4000-8000-000000000002")).resolves.toMatchObject({
      delegations: [{ state: "EXPIRED" }],
    });
  });
});
