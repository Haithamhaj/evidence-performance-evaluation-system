import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { afterAll, describe, expect, it } from "vitest";

import { EmployeeEvaluationCycleService } from "./cycle-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-08-06T09:00:00Z");
const organizationReader: import("./ports.js").EvaluationOrganizationReader = {
  departmentBelongsToOrganization: async (transaction, input) =>
    (await transaction.department.count({
      where: { id: input.departmentId, organizationId: input.organizationId },
    })) === 1,
};

afterAll(async () => client.$disconnect());

async function fixture(options: Readonly<{ cadence?: string }> = {}) {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `evaluation-cycle-${suffix}`, name: "Evaluation Cycle Organization" },
  });
  const department = await client.department.create({
    data: {
      key: `evaluation-cycle-department-${suffix}`,
      name: "Department",
      organizationId: organization.id,
    },
  });
  const [actor, manager, employee] = await Promise.all([
    client.user.create({
      data: { email: `cycle-actor-${suffix}@example.invalid`, displayName: "Actor" },
    }),
    client.user.create({
      data: { email: `cycle-manager-${suffix}@example.invalid`, displayName: "Manager" },
    }),
    client.user.create({
      data: { email: `cycle-employee-${suffix}@example.invalid`, displayName: "Employee" },
    }),
  ]);
  const rubric = await client.rubricVersion.create({
    data: { organizationId: organization.id, version: "1" },
  });
  const template = await client.evaluationTemplate.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      scope: "DEPARTMENT",
      key: `cycle-template-${suffix}`,
      name: "Cycle Template",
      createdById: actor.id,
    },
  });
  const templateVersion = await client.evaluationTemplateVersion.create({
    data: {
      templateId: template.id,
      rubricVersionId: rubric.id,
      versionNumber: 1,
      status: "ACTIVE",
      ratingScale: [1, 2, 3, 4, 5],
      weightPolicy: { sectionTotal: 100 },
      evaluationPolicy: {
        cadence: options.cadence ?? "QUARTERLY",
        cycleOneType: "CALIBRATION_NON_BASELINE",
      },
      localeAvailability: ["en"],
      version: 2,
      createdById: actor.id,
      activatedById: actor.id,
      activatedAt: now,
    },
  });
  let reads = 0;
  const eligibilityReader: import("./ports.js").EligibilitySnapshotReader = {
    readCycleEligibility: async (input, transaction) => {
      reads += 1;
      const foundationCycle = await transaction.evaluationCycle.create({
        data: {
          departmentId: input.departmentId,
          managerId: manager.id,
          version: reads,
          visibilityMode: "identified",
          sourceReason: "Frozen department eligibility at cycle opening.",
          effectiveFrom: new Date(input.startsAt),
          effectiveTo: new Date(input.endsAt),
        },
      });
      const snapshot = await transaction.eligibilitySnapshot.create({
        data: {
          cycleId: foundationCycle.id,
          version: reads,
          visibilityMode: "identified",
          sourceReason: "Frozen department eligibility at cycle opening.",
          effectiveFrom: new Date(input.startsAt),
          effectiveTo: new Date(input.endsAt),
        },
      });
      await transaction.evaluationCycle.update({
        where: { id: foundationCycle.id },
        data: { openedAt: now },
      });
      return {
        id: snapshot.id,
        version: snapshot.version,
        managerId: manager.id,
        visibilityMode: "identified",
        effectiveFrom: new Date(input.startsAt).toISOString(),
        effectiveTo: new Date(input.endsAt).toISOString(),
        entries: [
          {
            employeeId: employee.id,
            state: "active",
            sourceReason: "Active employee at the frozen boundary.",
            effectiveFrom: new Date(input.startsAt).toISOString(),
            effectiveTo: new Date(input.endsAt).toISOString(),
          },
        ],
      };
    },
  };
  const service = new EmployeeEvaluationCycleService(
    client,
    eligibilityReader,
    organizationReader,
    databaseAuditWriter,
    () => now,
  );
  const input = {
    schemaVersion: 1 as const,
    organizationId: organization.id,
    departmentId: department.id,
    templateVersionId: templateVersion.id,
    actorId: actor.id,
    cycleType: "CALIBRATION_NON_BASELINE" as const,
    startsAt: "2026-07-01T00:00:00Z",
    endsAt: "2026-10-01T00:00:00Z",
    expectedVersion: 1,
    idempotencyKey: crypto.randomUUID(),
    reason: "Open the first quarterly calibration cycle.",
  };
  return {
    actor,
    department,
    employee,
    input,
    manager,
    organization,
    reads: () => reads,
    service,
    templateVersion,
  };
}

describe("EmployeeEvaluationCycleService", () => {
  it("freezes Cycle 1, identified visibility, template configuration, and eligibility exactly once", async () => {
    const { employee, input, reads, service } = await fixture();

    const opened = await service.openCycle(input);
    expect(opened).toMatchObject({
      cycleType: "CALIBRATION_NON_BASELINE",
      state: "OPEN_PREPARATION",
      version: 1,
      snapshot: {
        cycleType: "CALIBRATION_NON_BASELINE",
        visibilityMode: "identified",
        ratingScale: [1, 2, 3, 4, 5],
      },
      assignments: [{ employeeId: employee.id, eligibilityState: "ELIGIBLE", version: 1 }],
    });
    await expect(service.openCycle(input)).resolves.toEqual(opened);
    expect(reads()).toBe(1);
  });

  it("rolls the cycle, snapshot, eligibility foundation, and audit back together", async () => {
    const { input } = await fixture();
    const failingAudit: import("@evaluation/contracts").AuditWriter<
      import("@evaluation/database").DatabaseTransaction
    > = {
      append: async () => {
        throw new Error("audit unavailable");
      },
    };
    const reader: import("./ports.js").EligibilitySnapshotReader = {
      readCycleEligibility: async (cycleInput, transaction) => {
        const foundationCycle = await transaction.evaluationCycle.create({
          data: {
            departmentId: cycleInput.departmentId,
            managerId: input.actorId,
            version: 99,
            visibilityMode: "identified",
            sourceReason: "Atomic rollback fixture.",
            effectiveFrom: new Date(cycleInput.startsAt),
            effectiveTo: new Date(cycleInput.endsAt),
          },
        });
        const snapshot = await transaction.eligibilitySnapshot.create({
          data: {
            cycleId: foundationCycle.id,
            version: 99,
            visibilityMode: "identified",
            sourceReason: "Atomic rollback fixture.",
            effectiveFrom: new Date(cycleInput.startsAt),
            effectiveTo: new Date(cycleInput.endsAt),
          },
        });
        await transaction.evaluationCycle.update({
          where: { id: foundationCycle.id },
          data: { openedAt: now },
        });
        return {
          id: snapshot.id,
          version: 99,
          managerId: input.actorId,
          visibilityMode: "identified",
          effectiveFrom: cycleInput.startsAt,
          effectiveTo: cycleInput.endsAt,
          entries: [],
        };
      },
    };
    const service = new EmployeeEvaluationCycleService(
      client,
      reader,
      organizationReader,
      failingAudit,
      () => now,
    );

    await expect(service.openCycle(input)).rejects.toThrow("audit unavailable");
    await expect(
      client.employeeEvaluationCycle.count({ where: { idempotencyKey: input.idempotencyKey } }),
    ).resolves.toBe(0);
  });

  it("records approved leave append-only and rejects stale assignment versions", async () => {
    const { employee, input, service } = await fixture();
    const opened = await service.openCycle(input);
    const assignment = opened.assignments[0]!;
    const decisionInput = {
      schemaVersion: 1 as const,
      assignmentId: assignment.id,
      employeeId: employee.id,
      actorId: input.actorId,
      state: "APPROVED_LEAVE" as const,
      effectiveAt: "2026-08-10T00:00:00Z",
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
      reason: "Approved leave applies during the frozen cycle period.",
    };

    const decided = await service.recordEligibilityDecision(decisionInput);
    expect(decided).toMatchObject({ eligibilityState: "APPROVED_LEAVE", version: 2 });
    await expect(service.recordEligibilityDecision(decisionInput)).resolves.toEqual(decided);
    await expect(
      service.recordEligibilityDecision({ ...decisionInput, idempotencyKey: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    await expect(
      client.evaluationEligibilityDecision.count({ where: { assignmentId: assignment.id } }),
    ).resolves.toBe(1);
  });

  it("enforces quarterly calibration for the department's first cycle and optimistic transitions", async () => {
    const { input, service } = await fixture();
    await expect(service.openCycle({ ...input, cycleType: "STANDARD" })).rejects.toMatchObject({
      code: "EVALUATION_CYCLE_ONE_TYPE_INVALID",
    });
    await expect(
      service.openCycle({
        ...input,
        idempotencyKey: crypto.randomUUID(),
        endsAt: "2026-09-01T00:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "EVALUATION_CYCLE_CADENCE_INVALID" });

    const opened = await service.openCycle(input);
    const transition = {
      schemaVersion: 1 as const,
      cycleId: opened.id,
      actorId: input.actorId,
      fromState: "OPEN_PREPARATION" as const,
      toState: "SELF_ASSESSMENT" as const,
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
      reason: "Preparation is complete.",
    };
    await expect(service.transitionCycle(transition)).resolves.toMatchObject({
      state: "SELF_ASSESSMENT",
      version: 2,
    });
    await expect(
      service.transitionCycle({ ...transition, idempotencyKey: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  it.each([
    ["SELF_ASSESSMENT", "MANAGER_ASSESSMENT", "EVALUATION_SELF_ASSESSMENT_INCOMPLETE"],
    ["MANAGER_ASSESSMENT", "COMPARISON", "EVALUATION_MANAGER_ASSESSMENT_INCOMPLETE"],
    ["FINALIZATION", "ACKNOWLEDGMENT", "EVALUATION_FINALIZATION_INCOMPLETE"],
  ] as const)(
    "rejects %s advancement while an eligible assignment is incomplete",
    async (fromState, toState, code) => {
      const { input, service } = await fixture();
      const opened = await service.openCycle(input);
      await client.employeeEvaluationCycle.update({
        where: { id: opened.id },
        data: { state: fromState, version: 2 },
      });

      await expect(
        service.transitionCycle({
          schemaVersion: 1,
          cycleId: opened.id,
          actorId: input.actorId,
          fromState,
          toState,
          expectedVersion: 2,
          idempotencyKey: crypto.randomUUID(),
          reason: "Attempt to advance an incomplete eligible assignment.",
        }),
      ).rejects.toMatchObject({ code });
    },
  );

  it("prohibits generic acknowledgment-to-closed transitions", async () => {
    const { input, service } = await fixture();
    const opened = await service.openCycle(input);
    await client.employeeEvaluationCycle.update({
      where: { id: opened.id },
      data: { state: "ACKNOWLEDGMENT", version: 2 },
    });

    await expect(
      service.transitionCycle({
        schemaVersion: 1,
        cycleId: opened.id,
        actorId: input.actorId,
        fromState: "ACKNOWLEDGMENT",
        toState: "CLOSED",
        expectedVersion: 2,
        idempotencyKey: crypto.randomUUID(),
        reason: "Generic closure must not bypass checked finalization closure.",
      }),
    ).rejects.toMatchObject({ code: "EVALUATION_CYCLE_TRANSITION_INVALID" });
  });

  it("rejects opening when the department belongs to another organization", async () => {
    const { department, input, service } = await fixture();
    const otherOrganization = await client.organization.create({
      data: {
        key: `evaluation-cycle-other-${crypto.randomUUID()}`,
        name: "Other Organization",
      },
    });
    await client.department.update({
      where: { id: department.id },
      data: { organizationId: otherOrganization.id },
    });

    await expect(service.openCycle(input)).rejects.toMatchObject({
      code: "EVALUATION_DEPARTMENT_ORGANIZATION_MISMATCH",
    });
  });

  it("rejects an active template whose frozen cadence policy is not quarterly", async () => {
    const { input, service } = await fixture({ cadence: "MONTHLY" });

    await expect(service.openCycle(input)).rejects.toMatchObject({
      code: "EVALUATION_TEMPLATE_POLICY_INVALID",
    });
  });
});
