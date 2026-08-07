/* eslint-disable no-unused-vars */
import { createDatabaseClient } from "@evaluation/database";

/**
 * Deterministic E5B fixture entrypoint. It intentionally delegates organization
 * identity to the approved pilot seed; its returned IDs support the employee →
 * private action → bounded sharing → manager support → formal-plan evidence journey.
 */
export async function seedCoachingDevelopmentAcceptance(
  database: ReturnType<typeof createDatabaseClient>,
  identities?: Readonly<{ employeeId: string; managerId: string }>,
) {
  const ids = {
    employee: "c5100000-0000-4000-8000-000000000001",
    manager: "c5100000-0000-4000-8000-000000000002",
    insight: "c5100000-0000-4000-8000-000000000003",
    action: "c5100000-0000-4000-8000-000000000004",
    plan: "c5100000-0000-4000-8000-000000000005",
    evidence: "c5100000-0000-4000-8000-000000000006",
    organization: "c5100000-0000-4000-8000-000000000010",
    department: "c5100000-0000-4000-8000-000000000011",
    project: "c5100000-0000-4000-8000-000000000012",
    evidenceRevision: "c5100000-0000-4000-8000-000000000013",
    evidenceConfirmation: "c5100000-0000-4000-8000-000000000014",
    insightRevision: "c5100000-0000-4000-8000-000000000015",
    insightSource: "c5100000-0000-4000-8000-000000000016",
  } as const;
  const [employee, manager] = identities
    ? await Promise.all([
        database.user.findUniqueOrThrow({ where: { id: identities.employeeId } }),
        database.user.findUniqueOrThrow({ where: { id: identities.managerId } }),
      ])
    : await Promise.all([
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
    const organization = await tx.organization.upsert({
      where: { key: "coaching-acceptance" },
      create: { id: ids.organization, key: "coaching-acceptance", name: "Coaching Acceptance" },
      update: {},
    });
    const department = await tx.department.upsert({
      where: { key: "coaching-acceptance-department" },
      create: {
        id: ids.department,
        key: "coaching-acceptance-department",
        name: "Coaching Acceptance Department",
        organizationId: organization.id,
      },
      update: {},
    });
    await tx.authorizationScope.upsert({
      where: { id: ids.project },
      create: {
        id: ids.project,
        key: "coaching-acceptance-project",
        scopeType: "project",
        departmentId: department.id,
      },
      update: {},
    });
    await tx.project.upsert({
      where: { id: ids.project },
      create: {
        id: ids.project,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: ids.project,
        name: "Coaching Acceptance Project",
        description: "Deterministic source of confirmed development-plan evidence.",
        status: "active",
        createdById: employee.id,
      },
      update: {},
    });
    if (!(await tx.evidenceRecord.findUnique({ where: { id: ids.evidence } })))
      await tx.evidenceRecord.create({
        data: {
          id: ids.evidence,
          idempotencyKey: "c5100000-0000-4000-8000-000000000017",
          projectId: ids.project,
          employeeId: employee.id,
          state: "confirmed",
        },
      });
    const evidenceRevision =
      (await tx.evidenceRevision.findUnique({ where: { id: ids.evidenceRevision } })) ??
      (await tx.evidenceRevision.create({
        data: {
          id: ids.evidenceRevision,
          evidenceId: ids.evidence,
          revision: 1,
          revisionKind: "manual_draft",
          sourceKind: "pasted_text",
          sourceText: "A concise source-supported work record.",
          supportedClaim: "A documented blocker response supports the selected practice.",
          contributionContext: "Employee-confirmed evidence for a formal development plan.",
          executionMode: "manual",
          createdById: employee.id,
        },
      }));
    if (!(await tx.evidenceConfirmation.findUnique({ where: { evidenceId: ids.evidence } })))
      await tx.evidenceConfirmation.create({
        data: {
          id: ids.evidenceConfirmation,
          evidenceId: ids.evidence,
          evidenceRevisionId: evidenceRevision.id,
          employeeId: employee.id,
          reason: "Employee confirmed this evidence before plan completion.",
          confirmedAt: new Date("2026-08-05T12:00:00Z"),
        },
      });
    await tx.coachingInsight.upsert({
      where: { id: ids.insight },
      create: { id: ids.insight, employeeId: employee.id, state: "DECIDED", version: 2 },
      update: { state: "DECIDED", version: 2 },
    });
    const insightRevision =
      (await tx.coachingInsightRevision.findUnique({ where: { id: ids.insightRevision } })) ??
      (await tx.coachingInsightRevision.create({
        data: {
          id: ids.insightRevision,
          insightId: ids.insight,
          revision: 1,
          pattern: "The employee documented one blocker response and its limitation.",
          periodStartsAt: new Date("2026-07-01T00:00:00Z"),
          periodEndsAt: new Date("2026-08-01T00:00:00Z"),
          confidence: "LIMITED",
          confidenceBasis: "One confirmed evidence source supports a narrow observation.",
          limitations: ["Cannot infer performance rating from one source."],
          conflicts: [],
          cannotConclude: "Cannot infer performance rating or broad performance pattern.",
          createdById: employee.id,
        },
      }));
    if (!(await tx.coachingInsightSource.findUnique({ where: { id: ids.insightSource } })))
      await tx.coachingInsightSource.create({
        data: {
          id: ids.insightSource,
          insightId: ids.insight,
          revisionId: insightRevision.id,
          sourceId: ids.evidence,
          sourceKind: "EVIDENCE",
          excerpt: "A concise source-supported work record.",
          position: 0,
        },
      });
    await tx.coachingInsight.update({
      where: { id: ids.insight },
      data: { currentRevisionId: insightRevision.id },
    });
    if (
      !(await tx.coachingInsightDecision.findUnique({
        where: { idempotencyKey: "c5100000-0000-4000-8000-000000000018" },
      }))
    )
      await tx.coachingInsightDecision.create({
        data: {
          idempotencyKey: "c5100000-0000-4000-8000-000000000018",
          insightId: ids.insight,
          employeeId: employee.id,
          decision: "ACCEPT",
          resultingVersion: 2,
        },
      });
    const action = await tx.developmentAction.upsert({
      where: { id: ids.action },
      create: {
        id: ids.action,
        employeeId: employee.id,
        insightId: ids.insight,
        privacy: "SHARED",
        state: "ACTIVE",
        version: 4,
      },
      update: { privacy: "SHARED", state: "ACTIVE", version: 4 },
    });
    const revision =
      (await tx.developmentActionRevision.findUnique({
        where: { actionId_revision: { actionId: action.id, revision: 1 } },
      })) ??
      (await tx.developmentActionRevision.create({
        data: {
          actionId: action.id,
          revision: 1,
          title: "Document one blocker response",
          objective: "Improve decision traceability",
          expectedBenefit: "A reusable development practice",
          activity: "Record the next blocker and resolution",
          completionEvidenceDefinition: "Employee-confirmed evidence",
          createdById: employee.id,
        },
      }));
    await tx.developmentAction.update({
      where: { id: action.id },
      data: { currentRevisionId: revision.id },
    });
    const actionTransitions = [
      ["c5100000-0000-4000-8000-000000000020", "DRAFT", "DRAFT", "PRIVATE", "PRIVATE", 1],
      ["c5100000-0000-4000-8000-000000000021", "DRAFT", "DRAFT", "PRIVATE", "SHARED", 2],
      ["c5100000-0000-4000-8000-000000000022", "DRAFT", "ACCEPTED", "SHARED", "SHARED", 3],
      ["c5100000-0000-4000-8000-000000000023", "ACCEPTED", "ACTIVE", "SHARED", "SHARED", 4],
    ] as const;
    for (const [
      idempotencyKey,
      fromState,
      toState,
      fromPrivacy,
      toPrivacy,
      resultingVersion,
    ] of actionTransitions)
      if (!(await tx.developmentActionTransition.findUnique({ where: { idempotencyKey } })))
        await tx.developmentActionTransition.create({
          data: {
            idempotencyKey,
            actionId: action.id,
            fromState,
            toState,
            fromPrivacy,
            toPrivacy,
            actorId: employee.id,
            resultingVersion,
          },
        });
    if (
      !(await tx.managerSupportEntry.findUnique({
        where: { idempotencyKey: "c5100000-0000-4000-8000-000000000007" },
      }))
    )
      await tx.managerSupportEntry.create({
        data: {
          idempotencyKey: "c5100000-0000-4000-8000-000000000007",
          actionId: action.id,
          managerId: manager.id,
          kind: "RESOURCE",
          body: "Optional training resource",
          resourceUrl: "https://example.invalid/resource",
        },
      });
    const plan = await tx.formalDevelopmentPlan.upsert({
      where: { id: ids.plan },
      create: {
        id: ids.plan,
        employeeId: employee.id,
        managerId: manager.id,
        actionId: action.id,
        state: "ACTIVE",
        version: 4,
      },
      update: { state: "ACTIVE", version: 4 },
    });
    const planRevision =
      (await tx.formalDevelopmentPlanRevision.findUnique({
        where: { planId_revision: { planId: plan.id, revision: 1 } },
      })) ??
      (await tx.formalDevelopmentPlanRevision.create({
        data: {
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
      }));
    await tx.formalDevelopmentPlan.update({
      where: { id: plan.id },
      data: { currentRevisionId: planRevision.id },
    });
    for (const [kind, actorId, key] of [
      ["EMPLOYEE_APPROVED", employee.id, "c5100000-0000-4000-8000-000000000008"],
      ["MANAGER_AGREED", manager.id, "c5100000-0000-4000-8000-000000000009"],
    ] as const)
      if (!(await tx.formalDevelopmentPlanAgreement.findUnique({ where: { idempotencyKey: key } })))
        await tx.formalDevelopmentPlanAgreement.create({
          data: {
            idempotencyKey: key,
            planId: plan.id,
            revisionId: planRevision.id,
            kind,
            actorId,
          },
        });
    const planTransitions = [
      ["c5100000-0000-4000-8000-000000000024", "DRAFT", "DRAFT", employee.id, 1],
      ["c5100000-0000-4000-8000-000000000025", "DRAFT", "EMPLOYEE_APPROVED", employee.id, 2],
      [
        "c5100000-0000-4000-8000-000000000026",
        "EMPLOYEE_APPROVED",
        "MANAGER_AGREED",
        manager.id,
        3,
      ],
      ["c5100000-0000-4000-8000-000000000027", "MANAGER_AGREED", "ACTIVE", manager.id, 4],
    ] as const;
    for (const [idempotencyKey, fromState, toState, actorId, resultingVersion] of planTransitions)
      if (!(await tx.formalDevelopmentPlanTransition.findUnique({ where: { idempotencyKey } })))
        await tx.formalDevelopmentPlanTransition.create({
          data: { idempotencyKey, planId: plan.id, fromState, toState, actorId, resultingVersion },
        });
    if (
      !(await tx.formalDevelopmentPlanEvidenceLink.findUnique({
        where: { planId_evidenceId: { planId: plan.id, evidenceId: ids.evidence } },
      }))
    )
      await tx.formalDevelopmentPlanEvidenceLink.create({
        data: {
          planId: plan.id,
          evidenceId: ids.evidence,
          confirmed: true,
          confirmedAt: new Date("2026-08-05T12:00:00Z"),
          confirmedById: employee.id,
        },
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
