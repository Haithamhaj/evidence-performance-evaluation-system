import { describe, expect, it } from "vitest";

import { DevelopmentActionService } from "./action-service.js";

const employeeId = "10000000-0000-4000-8000-000000000001";
const managerId = "10000000-0000-4000-8000-000000000002";
const actionId = "10000000-0000-4000-8000-000000000003";

describe("DevelopmentActionService", () => {
  it("persists employee-owned action creation through the append-only store", async () => {
    const calls: Record<string, unknown>[] = [];
    const service = new DevelopmentActionService({
      find: async () => null,
      append: async () => undefined,
      create: async (input) => {
        calls.push(input);
        return { id: actionId, version: 1 };
      },
    });
    await service.create({
      schemaVersion: 1,
      employeeId,
      title: "Practice",
      objective: "Improve",
      expectedBenefit: "Clarity",
      activity: "Write one note",
      completionEvidenceDefinition: "Confirmed evidence",
      targetDate: null,
      privacy: "PRIVATE",
      projectId: null,
      researchId: null,
      workItemId: null,
      expectedVersion: 1,
      idempotencyKey: "10000000-0000-4000-8000-000000000009",
    });
    expect(calls).toHaveLength(1);
  });
  it("keeps private actions employee-only and prevents manager state changes", async () => {
    const service = new DevelopmentActionService({
      find: async () => ({
        id: actionId,
        employeeId,
        privacy: "PRIVATE",
        state: "DRAFT",
        version: 1,
      }),
      append: async () => undefined,
    });
    await expect(service.read({ actionId, actorId: managerId, managerId })).rejects.toMatchObject({
      code: "AUTHZ_SCOPE",
    });
    await expect(
      service.transition({
        schemaVersion: 1,
        actionId,
        employeeId: managerId,
        toState: "COMPLETED",
        expectedVersion: 1,
        idempotencyKey: "10000000-0000-4000-8000-000000000004",
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_ACTION" });
  });

  it("returns a manager allowlist for a shared action without employee-selected context", async () => {
    const service = new DevelopmentActionService({
      find: async () => ({
        id: actionId,
        employeeId,
        privacy: "SHARED",
        state: "ACTIVE",
        version: 3,
        currentRevision: {
          title: "Shared title",
          objective: "Shared objective",
          expectedBenefit: "Shared benefit",
          activity: "Shared activity",
          completionEvidenceDefinition: "Confirmed evidence",
          targetDate: null,
          projectId: null,
          researchId: null,
          workItemId: null,
          employeeSelectedContext: "PRIVATE CONTEXT",
        },
      }),
      append: async () => undefined,
      isAuthorizedManager: async () => true,
    });
    const projection = await service.read({ actionId, actorId: managerId, managerId });
    expect(projection).toMatchObject({
      id: actionId,
      employeeId,
      privacy: "SHARED",
      title: "Shared title",
      objective: "Shared objective",
    });
    expect(JSON.stringify(projection)).not.toContain("PRIVATE CONTEXT");
    expect(projection).not.toHaveProperty("currentRevision");
  });
});
