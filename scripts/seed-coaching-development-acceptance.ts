/* eslint-disable no-unused-vars */
import { createDatabaseClient } from "@evaluation/database";

/**
 * Deterministic E5B fixture entrypoint. It intentionally delegates organization
 * identity to the approved pilot seed; its returned IDs support the employee →
 * private action → bounded sharing → manager support → formal-plan evidence journey.
 */
export async function seedCoachingDevelopmentAcceptance(
  database: ReturnType<typeof createDatabaseClient>,
) {
  const ids = {
    employee: "c5100000-0000-4000-8000-000000000001",
    manager: "c5100000-0000-4000-8000-000000000002",
    insight: "c5100000-0000-4000-8000-000000000003",
    action: "c5100000-0000-4000-8000-000000000004",
    plan: "c5100000-0000-4000-8000-000000000005",
    evidence: "c5100000-0000-4000-8000-000000000006",
  } as const;
  const [employee, manager] = await Promise.all([
    database.user.upsert({
      where: { id: ids.employee },
      create: {
        id: ids.employee,
        email: "coaching-employee@seed.invalid",
        displayName: "Coaching Employee",
      },
      update: { active: true },
    }),
    database.user.upsert({
      where: { id: ids.manager },
      create: {
        id: ids.manager,
        email: "coaching-manager@seed.invalid",
        displayName: "Coaching Manager",
      },
      update: { active: true },
    }),
  ]);
  await database.$transaction(async (tx) => {
    await tx.coachingInsight.upsert({
      where: { id: ids.insight },
      create: { id: ids.insight, employeeId: employee.id, state: "DECIDED", version: 2 },
      update: {},
    });
    const action = await tx.developmentAction.upsert({
      where: { id: ids.action },
      create: {
        id: ids.action,
        employeeId: employee.id,
        insightId: ids.insight,
        privacy: "SHARED",
        state: "ACTIVE",
        version: 3,
      },
      update: { privacy: "SHARED", state: "ACTIVE" },
    });
    const revision = await tx.developmentActionRevision.upsert({
      where: { actionId_revision: { actionId: action.id, revision: 1 } },
      create: {
        actionId: action.id,
        revision: 1,
        title: "Document one blocker response",
        objective: "Improve decision traceability",
        expectedBenefit: "A reusable development practice",
        activity: "Record the next blocker and resolution",
        completionEvidenceDefinition: "Employee-confirmed evidence",
        createdById: employee.id,
      },
      update: {},
    });
    await tx.developmentAction.update({
      where: { id: action.id },
      data: { currentRevisionId: revision.id },
    });
    await tx.managerSupportEntry.upsert({
      where: { idempotencyKey: "c5100000-0000-4000-8000-000000000007" },
      create: {
        idempotencyKey: "c5100000-0000-4000-8000-000000000007",
        actionId: action.id,
        managerId: manager.id,
        kind: "RESOURCE",
        body: "Optional training resource",
        resourceUrl: "https://example.invalid/resource",
      },
      update: {},
    });
    const plan = await tx.formalDevelopmentPlan.upsert({
      where: { id: ids.plan },
      create: {
        id: ids.plan,
        employeeId: employee.id,
        managerId: manager.id,
        actionId: action.id,
        state: "ACTIVE",
        version: 3,
      },
      update: { state: "ACTIVE" },
    });
    const planRevision = await tx.formalDevelopmentPlanRevision.upsert({
      where: { planId_revision: { planId: plan.id, revision: 1 } },
      create: {
        planId: plan.id,
        revision: 1,
        developmentArea: "Decision documentation",
        reason: "Employee-selected development action",
        expectedBehavior: "Describe the next decision and limitation",
        activities: ["Practice on one work item"],
        followUpOwnerId: manager.id,
        completionEvidenceDefinition: "Confirmed Evidence",
        createdById: employee.id,
      },
      update: {},
    });
    await tx.formalDevelopmentPlan.update({
      where: { id: plan.id },
      data: { currentRevisionId: planRevision.id },
    });
    for (const [kind, actorId, key] of [
      ["EMPLOYEE_APPROVED", employee.id, "c5100000-0000-4000-8000-000000000008"],
      ["MANAGER_AGREED", manager.id, "c5100000-0000-4000-8000-000000000009"],
    ] as const)
      await tx.formalDevelopmentPlanAgreement.upsert({
        where: { idempotencyKey: key },
        create: {
          idempotencyKey: key,
          planId: plan.id,
          revisionId: planRevision.id,
          kind,
          actorId,
        },
        update: {},
      });
    await tx.formalDevelopmentPlanEvidenceLink.upsert({
      where: { planId_evidenceId: { planId: plan.id, evidenceId: ids.evidence } },
      create: {
        planId: plan.id,
        evidenceId: ids.evidence,
        confirmed: true,
        confirmedAt: new Date(),
        confirmedById: employee.id,
      },
      update: { confirmed: true },
    });
  });
  return {
    employeeId: employee.id,
    managerId: manager.id,
    insightId: ids.insight,
    actionId: ids.action,
    planId: ids.plan,
    evidenceId: ids.evidence,
  };
}
