import { describe, expect, it } from "vitest";

import { FormalDevelopmentPlanService } from "./formal-plan-service.js";

const employeeId = "10000000-0000-4000-8000-000000000001";
const managerId = "10000000-0000-4000-8000-000000000002";
const planId = "10000000-0000-4000-8000-000000000003";

describe("FormalDevelopmentPlanService", () => {
  it("requires employee approval before a manager can activate a plan", async () => {
    const service = new FormalDevelopmentPlanService({
      find: async () => ({
        id: planId,
        employeeId,
        managerId,
        state: "DRAFT",
        version: 1,
        evidenceLinks: [],
      }),
      append: async () => undefined,
    });
    await expect(
      service.activate({
        planId,
        actorId: managerId,
        expectedVersion: 1,
        idempotencyKey: "10000000-0000-4000-8000-000000000004",
      }),
    ).rejects.toMatchObject({ code: "EMPLOYEE_APPROVAL_REQUIRED" });
  });

  it("rejects completion when no confirmed evidence is linked", async () => {
    const service = new FormalDevelopmentPlanService({
      find: async () => ({
        id: planId,
        employeeId,
        managerId,
        state: "ACTIVE",
        version: 4,
        evidenceLinks: [],
      }),
      append: async () => undefined,
    });
    await expect(
      service.complete({
        planId,
        actorId: employeeId,
        expectedVersion: 4,
        idempotencyKey: "10000000-0000-4000-8000-000000000005",
      }),
    ).rejects.toMatchObject({ code: "FORMAL_PLAN_CONFIRMED_EVIDENCE_REQUIRED" });
  });

  it("revises an agreed plan back to draft so prior approvals cannot remain effective", async () => {
    let revised: Record<string, unknown> | undefined;
    const service = new FormalDevelopmentPlanService({
      find: async () => ({
        id: planId,
        employeeId,
        managerId,
        state: "MANAGER_AGREED",
        version: 3,
        evidenceLinks: [],
      }),
      append: async () => undefined,
      revise: async (event) => {
        revised = event;
        return { id: planId, state: "DRAFT", version: 4 };
      },
    });
    await expect(
      service.revise({
        schemaVersion: 1,
        planId,
        employeeId,
        expectedVersion: 3,
        idempotencyKey: "10000000-0000-4000-8000-000000000006",
        developmentArea: "Revised development area",
        reason: "Employee changed the agreed plan",
        expectedBehavior: "Use the revised practice",
        activities: ["Practice the revised activity"],
        followUpOwnerId: managerId,
        targetDate: null,
        completionEvidenceDefinition: "One confirmed evidence record",
        sourceEvaluationAssignmentId: null,
      }),
    ).resolves.toEqual({ id: planId, state: "DRAFT", version: 4 });
    expect(revised).toMatchObject({ planId, employeeId, fromState: "MANAGER_AGREED" });
  });

  it.each([
    ["withdraw", "WITHDRAWN", employeeId],
    ["close", "CLOSED", managerId],
  ] as const)("supports %s with a retained reason", async (method, state, actorId) => {
    let event: Record<string, unknown> | undefined;
    const service = new FormalDevelopmentPlanService({
      find: async () => ({
        id: planId,
        employeeId,
        managerId,
        state: "ACTIVE",
        version: 4,
        evidenceLinks: [{ confirmed: true }],
      }),
      append: async (value) => {
        event = value;
      },
    });
    await expect(
      service[method]({
        schemaVersion: 1,
        planId,
        actorId,
        expectedVersion: 4,
        idempotencyKey:
          method === "withdraw"
            ? "10000000-0000-4000-8000-000000000007"
            : "10000000-0000-4000-8000-000000000008",
        reason: "The participants explicitly ended this plan.",
      }),
    ).resolves.toMatchObject({ state, version: 5 });
    expect(event).toMatchObject({ toState: state, reason: "The participants explicitly ended this plan." });
  });

  it("returns a participant-safe current-revision projection", async () => {
    const service = new FormalDevelopmentPlanService({
      find: async () => ({
        id: planId,
        employeeId,
        managerId,
        state: "ACTIVE",
        version: 4,
        evidenceLinks: [{ evidenceId: "10000000-0000-4000-8000-000000000009", confirmed: true }],
        currentRevision: {
          developmentArea: "Decision documentation",
          reason: "Participant-visible reason",
          expectedBehavior: "Describe the decision limitation",
          activities: ["Practice once"],
          followUpOwnerId: managerId,
          targetDate: null,
          completionEvidenceDefinition: "Confirmed evidence",
        },
        agreements: [{ kind: "EMPLOYEE_APPROVED" }, { kind: "MANAGER_AGREED" }],
      }),
      append: async () => undefined,
    });
    await expect(service.read({ planId, actorId: managerId })).resolves.toMatchObject({
      id: planId,
      developmentArea: "Decision documentation",
      evidenceLinks: [{ confirmed: true }],
    });
    await expect(
      service.read({ planId, actorId: "10000000-0000-4000-8000-000000000010" }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE" });
  });
});
