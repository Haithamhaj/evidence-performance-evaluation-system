import { createDatabaseClient } from "@evaluation/database";

const ids = {
  organization: "20000000-0000-4000-8000-000000000001",
  department: "20000000-0000-4000-8000-000000000002",
  departmentScope: "20000000-0000-4000-8000-000000000003",
  owner: "20000000-0000-4000-8000-000000000004",
  manager: "20000000-0000-4000-8000-000000000005",
  projectA: "20000000-0000-4000-8000-000000000010",
  projectB: "20000000-0000-4000-8000-000000000011",
  template: "20000000-0000-4000-8000-000000000020",
  templateVersion: "20000000-0000-4000-8000-000000000021",
  documentA: "20000000-0000-4000-8000-000000000030",
  documentB: "20000000-0000-4000-8000-000000000031",
  documentVersionA: "20000000-0000-4000-8000-000000000032",
  documentVersionB: "20000000-0000-4000-8000-000000000033",
  contractA: "20000000-0000-4000-8000-000000000040",
  contractB: "20000000-0000-4000-8000-000000000041",
  componentKpi: "20000000-0000-4000-8000-000000000042",
  componentMilestone: "20000000-0000-4000-8000-000000000043",
  componentPending: "20000000-0000-4000-8000-000000000044",
  snapshot: "20000000-0000-4000-8000-000000000045",
} as const;

const workstreamIds = Array.from(
  { length: 5 },
  (_, index) => `21000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const workItemIds = Array.from(
  { length: 20 },
  (_, index) => `22000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);

async function main() {
  const slice = process.argv[3];
  if (process.argv[2] !== "--slice" || (slice !== "1" && slice !== "2"))
    throw new Error("Usage: tsx scripts/seed-phase-2-demo.ts --slice <1|2>");
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const client = createDatabaseClient(databaseUrl);
  const now = new Date("2026-07-18T12:00:00.000Z");
  try {
    await client.$transaction(async (transaction) => {
      await transaction.organization.upsert({
        where: { id: ids.organization },
        update: { name: "Phase 2 Demo Organization" },
        create: { id: ids.organization, key: "phase-2-demo", name: "Phase 2 Demo Organization" },
      });
      await transaction.department.upsert({
        where: { id: ids.department },
        update: { name: "فريق الذكاء الاصطناعي التجريبي" },
        create: {
          id: ids.department,
          key: "phase-2-demo-ai",
          name: "فريق الذكاء الاصطناعي التجريبي",
          organizationId: ids.organization,
        },
      });
      await transaction.authorizationScope.upsert({
        where: { id: ids.departmentScope },
        update: {},
        create: {
          id: ids.departmentScope,
          key: "phase-2-demo-department",
          scopeType: "department",
          departmentId: ids.department,
        },
      });
      await transaction.user.upsert({
        where: { id: ids.owner },
        update: { active: true },
        create: {
          id: ids.owner,
          email: "phase2.employee@example.invalid",
          displayName: "ليان الموظفة",
          active: true,
        },
      });
      await transaction.user.upsert({
        where: { id: ids.manager },
        update: { active: true },
        create: {
          id: ids.manager,
          email: "phase2.manager@example.invalid",
          displayName: "ريم المديرة",
          active: true,
        },
      });
      await transaction.roleAssignment.createMany({
        data: [
          {
            userId: ids.owner,
            role: "employee",
            scopeType: "department",
            scopeId: ids.departmentScope,
          },
          {
            userId: ids.manager,
            role: "manager",
            scopeType: "department",
            scopeId: ids.departmentScope,
          },
        ],
        skipDuplicates: true,
      });
      await seedProjects(transaction);
      await seedDocuments(transaction, now);
      await seedWorkItems(transaction);
      await seedContracts(transaction, now);
    });
    process.stdout.write(
      `${JSON.stringify({
        employee: "phase2.employee@example.invalid",
        manager: "phase2.manager@example.invalid",
        projectId: ids.projectA,
        slice: Number(slice),
        workItems: workItemIds.length,
        workstreams: workstreamIds.length,
      })}\n`,
    );
  } finally {
    await client.$disconnect();
  }
}

async function seedProjects(transaction: any) {
  for (const [index, projectId] of [ids.projectA, ids.projectB].entries()) {
    await transaction.authorizationScope.upsert({
      where: { id: projectId },
      update: {},
      create: {
        id: projectId,
        key: `phase-2-demo-project-${index + 1}`,
        scopeType: "project",
        departmentId: ids.department,
      },
    });
    await transaction.project.upsert({
      where: { id: projectId },
      update: {},
      create: {
        id: projectId,
        organizationId: ids.organization,
        departmentId: ids.department,
        authorizationScopeId: projectId,
        authorizationScopeType: "project",
        name: index === 0 ? "منصة التقييم المدعوم بالأدلة" : "مساعد المعرفة الداخلي",
        description: "مشروع تجريبي بقاعدة تقدم قابلة للقياس.",
        status: "active",
        createdById: ids.manager,
      },
    });
    const membershipId = `23000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    await transaction.projectMember.upsert({
      where: { id: membershipId },
      update: {},
      create: {
        id: membershipId,
        projectId,
        employeeId: ids.owner,
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        reason: "Phase 2 demo membership",
        createdById: ids.manager,
      },
    });
  }
  for (const [index, workstreamId] of workstreamIds.entries()) {
    const projectId = index < 3 ? ids.projectA : ids.projectB;
    await transaction.authorizationScope.upsert({
      where: { id: workstreamId },
      update: {},
      create: {
        id: workstreamId,
        key: `phase-2-demo-workstream-${index + 1}`,
        scopeType: "workstream",
        departmentId: ids.department,
      },
    });
    await transaction.workstream.upsert({
      where: { id: workstreamId },
      update: {},
      create: {
        id: workstreamId,
        projectId,
        authorizationScopeId: workstreamId,
        authorizationScopeType: "workstream",
        name: `مسار العمل ${index + 1}`,
        description: "مسار عمل تشغيلي للعرض التجريبي.",
        status: "active",
        createdById: ids.manager,
      },
    });
    await transaction.workstreamMember.upsert({
      where: {
        id: `24000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      },
      update: {},
      create: {
        id: `24000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        workstreamId,
        employeeId: ids.owner,
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        reason: "Phase 2 demo workstream membership",
        createdById: ids.manager,
      },
    });
  }
}

async function seedDocuments(transaction: any, now: Date) {
  await transaction.documentTemplate.upsert({
    where: { id: ids.template },
    update: {},
    create: {
      id: ids.template,
      organizationId: ids.organization,
      departmentId: ids.department,
      scopeType: "department",
      kind: "project",
      createdById: ids.manager,
    },
  });
  await transaction.documentTemplateVersion.upsert({
    where: { id: ids.templateVersion },
    update: {},
    create: {
      id: ids.templateVersion,
      templateId: ids.template,
      version: 1,
      status: "active",
      reason: "Phase 2 measurable project document",
      createdById: ids.manager,
      activatedAt: now,
    },
  });
  for (const [index, values] of [
    [ids.documentA, ids.documentVersionA, ids.projectA],
    [ids.documentB, ids.documentVersionB, ids.projectB],
  ].entries()) {
    const [documentId, versionId, projectId] = values as [string, string, string];
    await transaction.documentRecord.upsert({
      where: { id: documentId },
      update: {},
      create: {
        id: documentId,
        organizationId: ids.organization,
        departmentId: ids.department,
        projectId,
        templateVersionId: ids.templateVersion,
        currentVersion: 1,
        createdById: ids.owner,
      },
    });
    await transaction.documentVersion.upsert({
      where: { id: versionId },
      update: {},
      create: {
        id: versionId,
        documentId,
        version: 1,
        templateVersionId: ids.templateVersion,
        createdById: ids.owner,
        reason: `Approved demo source ${index + 1}`,
      },
    });
  }
}

async function seedWorkItems(transaction: any) {
  for (const [index, id] of workItemIds.entries()) {
    const projectId = index < 14 ? ids.projectA : ids.projectB;
    const workstreamId =
      projectId === ids.projectA ? workstreamIds[index % 3] : workstreamIds[3 + (index % 2)];
    const status =
      index < 3
        ? "ready"
        : index < 6
          ? "in_progress"
          : index < 9
            ? "in_review"
            : index < 12
              ? "blocked"
              : "planned";
    await transaction.workItem.upsert({
      where: { id },
      update: {},
      create: {
        id,
        projectId,
        workstreamId,
        title: `عنصر عمل تجريبي ${index + 1}`,
        description: "مخرج تشغيلي يومي مرتبط بالمشروع.",
        status,
        priority: index < 4 ? "high" : "normal",
        assigneeId: ids.owner,
        dueAt: new Date(index < 9 ? "2026-07-18T18:00:00.000Z" : "2026-07-24T18:00:00.000Z"),
        requirements: ["تنفيذ النطاق", "توثيق النتيجة"],
        acceptanceConditions: ["اعتماد المالك"],
        blocker: status === "blocked" ? "بانتظار قرار نطاق" : null,
        nextAction: "تحديث حالة التنفيذ وإرفاق الدليل",
        createdById: ids.manager,
      },
    });
  }
}

async function seedContracts(transaction: any, now: Date) {
  if ((await transaction.progressContract.findUnique({ where: { id: ids.contractA } })) === null) {
    await transaction.progressContract.create({
      data: {
        id: ids.contractA,
        scopeKind: "project",
        projectId: ids.projectA,
        sourceDocumentId: ids.documentA,
        sourceDocumentVersionId: ids.documentVersionA,
        sourceDocumentVersionNo: 1,
        calculationKind: "weighted",
        calculationSchemaVersion: "1.0.0",
        contractVersion: 1,
        ownerId: ids.owner,
        effectiveAt: now,
        createdById: ids.owner,
        components: {
          create: [
            {
              id: ids.componentKpi,
              position: 1,
              kind: "kpi",
              name: "السيناريوهات المعتمدة",
              description: "السيناريوهات التي اعتمدها مالك المنتج.",
              weight: 60,
              baseline: 0,
              target: 12,
              unit: "سيناريو",
              direction: "increase",
              acceptanceConditions: ["اعتماد مالك المنتج"],
              requiredEvidence: ["سجل القبول"],
              confirmationMode: "measured",
            },
            {
              id: ids.componentMilestone,
              position: 2,
              kind: "milestone",
              name: "جاهزية العرض",
              description: "العرض المحلي جاهز بالعربية والإنجليزية.",
              weight: 40,
              acceptanceConditions: ["نجاح العرض المحلي"],
              requiredEvidence: ["لقطات الشاشة"],
              confirmationMode: "human_confirmed",
            },
          ],
        },
      },
    });
    await transitionContract(transaction, ids.contractA, "draft", "pending_approval", 2, now);
    await transaction.progressContract.update({
      where: { id: ids.contractA },
      data: { state: "active", version: { increment: 1 }, approverId: ids.owner, approvedAt: now },
    });
    await transaction.progressContractTransition.create({
      data: {
        contractId: ids.contractA,
        fromState: "pending_approval",
        toState: "active",
        actorId: ids.owner,
        reason: "Approved demo contract",
        resultingVersion: 3,
      },
    });
  }
  if ((await transaction.progressContract.findUnique({ where: { id: ids.contractB } })) === null) {
    await transaction.progressContract.create({
      data: {
        id: ids.contractB,
        scopeKind: "project",
        projectId: ids.projectB,
        sourceDocumentId: ids.documentB,
        sourceDocumentVersionId: ids.documentVersionB,
        sourceDocumentVersionNo: 1,
        calculationKind: "stage_gate",
        calculationSchemaVersion: "1.0.0",
        contractVersion: 1,
        ownerId: ids.owner,
        effectiveAt: now,
        createdById: ids.owner,
        components: {
          create: {
            id: ids.componentPending,
            position: 1,
            kind: "milestone",
            name: "اعتماد النطاق",
            description: "اعتماد نطاق المشروع الثاني.",
            acceptanceConditions: ["اعتماد المالك"],
            requiredEvidence: ["قرار النطاق"],
            confirmationMode: "human_confirmed",
          },
        },
      },
    });
    await transitionContract(transaction, ids.contractB, "draft", "pending_approval", 2, now);
  }
  if ((await transaction.progressSnapshot.findUnique({ where: { id: ids.snapshot } })) === null) {
    await transaction.progressSnapshot.create({
      data: {
        id: ids.snapshot,
        contractId: ids.contractA,
        contractVersion: 1,
        previousPercent: 50,
        percent: 62.5,
        componentState: [
          { componentId: ids.componentKpi, percent: 37.5 },
          { componentId: ids.componentMilestone, percent: 100 },
        ],
        calculationSchemaVersion: "1.0.0",
        reason: "Five of eight measurable outcomes are accepted.",
        correlationId: "20000000-0000-4000-8000-000000000046",
        actorId: ids.owner,
        sources: {
          create: [
            {
              componentId: ids.componentKpi,
              sourceKind: "kpi_measurement",
              sourceId: "20000000-0000-4000-8000-000000000047",
              sourceVersion: 1,
              measuredValue: 7.5,
              observedAt: now,
            },
            {
              componentId: ids.componentMilestone,
              sourceKind: "human_confirmation",
              sourceId: "20000000-0000-4000-8000-000000000048",
              sourceVersion: 1,
              satisfied: true,
              observedAt: now,
            },
          ],
        },
      },
    });
  }
}

async function transitionContract(
  transaction: any,
  contractId: string,
  fromState: "draft",
  toState: "pending_approval",
  resultingVersion: number,
  createdAt: Date,
) {
  await transaction.progressContract.update({
    where: { id: contractId },
    data: { state: toState, version: { increment: 1 } },
  });
  await transaction.progressContractTransition.create({
    data: {
      contractId,
      fromState,
      toState,
      actorId: ids.owner,
      reason: "Submitted demo contract for approval",
      resultingVersion,
      createdAt,
    },
  });
}

await main();
