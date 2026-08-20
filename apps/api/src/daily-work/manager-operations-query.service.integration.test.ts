import { describe, expect, it, vi } from "vitest";

import {
  createDatabaseManagerOperationsQueryService,
  ManagerOperationsQueryService,
} from "./manager-operations-query.service.js";

const managerId = crypto.randomUUID();
const projectId = crypto.randomUUID();

describe("ManagerOperationsQueryService", () => {
  it("returns bounded operational queues without score-like employee fields", async () => {
    const source = {
      load: vi.fn(async () => ({
        approvalsWaiting: [
          {
            id: crypto.randomUUID(),
            projectId,
            projectName: "Customer workspace",
            detailKey: "approval_waiting" as const,
            observedAt: "2026-08-15T08:55:00.000Z",
          },
        ],
        blockedProjects: [
          {
            id: projectId,
            projectId,
            projectName: "Customer workspace",
            detailKey: "project_paused" as const,
            observedAt: "2026-08-15T08:50:00.000Z",
          },
        ],
        ambiguousProgressEvidence: [],
        ownershipGaps: [],
        upcomingCommitments: [],
      })),
    };
    const service = new ManagerOperationsQueryService(
      source,
      () => new Date("2026-08-15T09:00:00.000Z"),
    );

    const result = await service.load(managerId);
    const serialized = JSON.stringify(result);

    expect(result.approvalsWaiting).toHaveLength(1);
    expect(result.blockedProjects).toHaveLength(1);
    expect(result.generatedAt).toBe("2026-08-15T09:00:00.000Z");
    expect(result.approvalsWaiting[0]?.observedAt).toBe("2026-08-15T08:55:00.000Z");
    expect(result.readinessHref).toBe("/manager/readiness");
    expect(result.evaluationHref).toBe("/manager/evaluations");
    expect(serialized).not.toMatch(
      /employeeId|readinessPercentage|productivityScore|predictedRating|rank|leaderboard|completionRate/iu,
    );
  });

  it("does not grant employee quick actions from the manager role", async () => {
    const service = new ManagerOperationsQueryService({
      load: vi.fn(async () => ({
        approvalsWaiting: [],
        blockedProjects: [],
        ambiguousProgressEvidence: [],
        ownershipGaps: [],
        upcomingCommitments: [],
      })),
    });

    await expect(service.load(managerId)).resolves.not.toHaveProperty("quickAdd");
    await expect(service.load(managerId)).resolves.not.toHaveProperty("quickUpdate");
  });

  it("fails closed before reading operations when no department manager scope exists", async () => {
    const protectedRead = vi.fn();
    const service = createDatabaseManagerOperationsQueryService({
      roleAssignment: { findMany: vi.fn(async () => []) },
      progressContract: { findMany: protectedRead },
      project: { findMany: protectedRead },
      workItem: { findMany: protectedRead },
    } as never);

    await expect(service.load(managerId)).rejects.toMatchObject({ code: "AUTH_FORBIDDEN" });
    expect(protectedRead).not.toHaveBeenCalled();
  });

  it("projects an authoritative deactivation reassignment case as an operational ownership action", async () => {
    const departmentId = crypto.randomUUID();
    const observedAt = new Date("2026-08-15T08:40:00.000Z");
    const service = createDatabaseManagerOperationsQueryService({
      roleAssignment: {
        findMany: vi.fn(async () => [{ scope: { departmentId } }]),
      },
      progressContract: { findMany: vi.fn(async () => []) },
      project: { findMany: vi.fn(async () => []) },
      progressRecalculationRequest: { findMany: vi.fn(async () => []) },
      workItem: { findMany: vi.fn(async () => []) },
      reassignmentQueueItem: {
        findMany: vi.fn(async () => [
          {
            id: crypto.randomUUID(),
            createdAt: observedAt,
            case: {
              project: { id: projectId, name: "Customer workspace" },
              workstream: null,
            },
          },
        ]),
      },
    } as never);

    const result = await service.load(managerId);

    expect(result.ownershipGaps).toEqual([
      expect.objectContaining({
        projectId,
        projectName: "Customer workspace",
        detailKey: "ownership_missing",
        observedAt: observedAt.toISOString(),
      }),
    ]);
  });
});
