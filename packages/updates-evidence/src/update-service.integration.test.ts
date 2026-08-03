import { afterAll, describe, expect, it, vi } from "vitest";

import { createDatabaseClient } from "@evaluation/database";

import { UpdateService } from "./update-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-07-18T12:00:00.000Z");

afterAll(async () => client.$disconnect());

describe("UpdateService", () => {
  it("persists every manual source as ordered immutable update attachments", async () => {
    const graph = await seedGraph();
    const seen: import("./update-service.js").UpdateStructureContext[] = [];
    const service = new UpdateService(
      client,
      {
        authorizeIn: async () => ({
          organizationId: graph.organizationId,
          projectScopeId: graph.projectId,
          departmentScopeId: graph.departmentId,
          activeContract: null,
        }),
      },
      {
        structure: async (input, persistValidatedOutput) => {
          seen.push(input);
          const output = {
            state: "ready_for_review" as const,
            unresolvedFields: [],
            draft: {
              summary: "Draft from governed sources",
              result: "The employee will review the result.",
              blocker: null,
              nextAction: "Review the draft.",
              contributionContext: "Employee-provided source context.",
              evidenceClaimDrafts: [],
              documentationNeeds: [],
              relatedProgressComponentIds: [],
              comparisonExplanation: "Initial capture.",
            },
          };
          await client.$transaction((transaction) => persistValidatedOutput(transaction, output));
          return output;
        },
      },
      { append: async () => ({ id: crypto.randomUUID(), createdAt: now.toISOString() }) },
      () => now,
    );
    const idempotencyKey = crypto.randomUUID();
    await service.start({
      actor: { userId: graph.employeeId, active: true },
      correlationId: crypto.randomUUID(),
      input: {
        idempotencyKey,
        projectId: graph.projectId,
        workstreamId: null,
        workItemId: null,
        rawText: "",
        sources: [
          { kind: "pasted_code", text: "expect(result).toBe(true);" },
          { kind: "cli_snapshot", text: "pnpm test: 24 passed" },
          { kind: "url", url: "https://example.invalid/acceptance" },
        ],
        executionMode: "ai_assisted",
      },
    });
    const update = await client.updateSource.findUniqueOrThrow({ where: { idempotencyKey } });
    await expect(
      client.$queryRaw<
        Array<{ position: number; kind: string; content: string | null; sourceUrl: string | null }>
      >`
        SELECT "position", "kind"::text, "content", "sourceUrl"
        FROM "UpdateSourceAttachment"
        WHERE "updateSourceId" = ${update.id}::uuid
        ORDER BY "position" ASC
      `,
    ).resolves.toEqual([
      { position: 1, kind: "pasted_code", content: "expect(result).toBe(true);", sourceUrl: null },
      { position: 2, kind: "cli_snapshot", content: "pnpm test: 24 passed", sourceUrl: null },
      { position: 3, kind: "url", content: null, sourceUrl: "https://example.invalid/acceptance" },
    ]);
    expect(seen[0]?.rawText).toContain("BEGIN_UNTRUSTED_UPDATE_SOURCE");
    expect(seen[0]?.rawText).toContain("expect(result).toBe(true);");
  });

  it("resumes a multi-turn update and accepts only the employee-edited revision", async () => {
    const graph = await seedGraph();
    const outputs: import("@evaluation/contracts").UpdateStructureAiOutput[] = [
      question(["result", "next_action"], "ما النتيجة القابلة للتحقق؟"),
      question(["evidence"], "ما الدليل الذي يدعم هذه النتيجة؟"),
      {
        state: "ready_for_review",
        unresolvedFields: [],
        draft: {
          summary: "اكتمل مسار القبول.",
          result: "نجحت 12 حالة من أصل 12.",
          blocker: null,
          nextAction: "إرفاق سجل الاعتماد.",
          contributionContext: "نفذت الاختبارات وراجعت النتائج.",
          evidenceClaimDrafts: ["نجحت اختبارات القبول."],
          documentationNeeds: ["سجل الاعتماد."],
          relatedProgressComponentIds: [graph.componentId],
          comparisonExplanation: "أضيفت نتيجة قابلة للتحقق.",
        },
      },
    ];
    const seen: import("./update-service.js").UpdateStructureContext[] = [];
    const structurer = {
      structure: vi.fn(async (input, persistValidatedOutput) => {
        seen.push(input);
        const output = outputs.shift();
        if (output === undefined) throw new Error("Unexpected structuring call");
        await client.$transaction((transaction) => persistValidatedOutput(transaction, output));
        return output;
      }),
    };
    const scopeReader = {
      authorizeIn: vi.fn(async () => ({
        organizationId: graph.organizationId,
        projectScopeId: graph.projectId,
        departmentScopeId: graph.departmentId,
        activeContract: {
          contractId: graph.contractId,
          contractVersion: 3,
          componentReferences: [`progress-component:${graph.componentId}`],
        },
      })),
    };
    const auditWriter: import("@evaluation/contracts").AuditWriter<
      import("@evaluation/database").DatabaseTransaction
    > = {
      append: vi.fn(async () => ({ id: crypto.randomUUID(), createdAt: now.toISOString() })),
    };
    const service = new UpdateService(client, scopeReader, structurer, auditWriter, () => now);
    const idempotencyKey = crypto.randomUUID();
    const command = {
      actor: { userId: graph.employeeId, active: true },
      correlationId: crypto.randomUUID(),
      input: {
        idempotencyKey,
        projectId: graph.projectId,
        workstreamId: graph.workstreamId,
        workItemId: graph.workItemId,
        rawText: "أنجزت العمل.",
        executionMode: "ai_assisted",
      },
    } as const;

    const first = await service.start(command);
    expect(first).toMatchObject({
      state: "draft_with_question",
      turnNumber: 1,
      remainingFieldCount: 2,
    });
    expect("questions" in first).toBe(false);
    await expect(
      client.acceptedUpdateEvent.count({ where: { projectId: graph.projectId } }),
    ).resolves.toBe(0);

    const resumed = await new UpdateService(
      client,
      scopeReader,
      structurer,
      auditWriter,
      () => now,
    ).start(command);
    expect(resumed).toEqual(first);
    expect(structurer.structure).toHaveBeenCalledTimes(1);

    const second = await service.answer({
      actor: command.actor,
      correlationId: crypto.randomUUID(),
      sessionId: await sessionIdFor(idempotencyKey),
      input: {
        expectedSessionVersion: first.sessionVersion,
        turnId: first.state === "draft_with_question" ? first.turnId : "",
        answer: "نجحت 12 حالة من أصل 12.",
      },
    });
    expect(second).toMatchObject({ state: "draft_with_question", turnNumber: 2 });

    const ready = await service.answer({
      actor: command.actor,
      correlationId: crypto.randomUUID(),
      sessionId: await sessionIdFor(idempotencyKey),
      input: {
        expectedSessionVersion: second.sessionVersion,
        turnId: second.state === "draft_with_question" ? second.turnId : "",
        answer: "سجل الاختبار مرفق في الدليل اليدوي.",
      },
    });
    expect(ready).toMatchObject({
      state: "ready_for_review",
      draft: { revision: 3 },
    });
    await expect(
      client.acceptedUpdateEvent.count({ where: { projectId: graph.projectId } }),
    ).resolves.toBe(0);
    expect(seen.at(-1)).toMatchObject({
      activeContract: {
        contractId: graph.contractId,
        contractVersion: 3,
        componentReferences: [`progress-component:${graph.componentId}`],
      },
      previousAcceptedState: null,
    });
    expect(seen.at(-1)?.answers).toHaveLength(2);
    const storedSource = await client.updateSource.findUniqueOrThrow({
      where: { idempotencyKey },
    });
    expect(seen[0]?.sourceReferences).toContain(`update-source:${storedSource.id}`);

    const sessionId = await sessionIdFor(idempotencyKey);
    await expect(
      service.confirm({
        actor: command.actor,
        correlationId: crypto.randomUUID(),
        sessionId,
        input: { expectedDraftRevision: 3, reason: "Confirmed without edit" },
      }),
    ).rejects.toMatchObject({ code: "UPDATE_EMPLOYEE_EDIT_REQUIRED" });

    const edited = await service.revise({
      actor: command.actor,
      correlationId: crypto.randomUUID(),
      sessionId,
      input: {
        expectedDraftRevision: 3,
        summary: "اكتمل مسار القبول بعد مراجعة الموظف.",
        result: "نجحت 12 حالة من أصل 12.",
        blocker: null,
        nextAction: "إرفاق سجل الاعتماد.",
        contributionContext: "نفذت الاختبارات وراجعت النتائج يدوياً.",
        evidenceClaimDrafts: ["نجحت اختبارات القبول."],
      },
    });
    expect(edited).toMatchObject({ revision: 4, executionMode: "mixed" });

    const accepted = await service.confirm({
      actor: command.actor,
      correlationId: crypto.randomUUID(),
      sessionId,
      input: { expectedDraftRevision: 4, reason: "راجعت وأكدت التحديث." },
    });
    expect(accepted).toMatchObject({
      projectId: graph.projectId,
      workItemId: graph.workItemId,
      employeeId: graph.employeeId,
    });
    await expect(
      client.acceptedUpdateEvent.count({ where: { projectId: graph.projectId } }),
    ).resolves.toBe(1);
    await expect(
      client.progressRecalculationRequest.count({
        where: { acceptedEvent: { projectId: graph.projectId } },
      }),
    ).resolves.toBe(1);

    const acceptedAgain = await service.confirm({
      actor: command.actor,
      correlationId: crypto.randomUUID(),
      sessionId,
      input: { expectedDraftRevision: 4, reason: "إعادة آمنة للطلب." },
    });
    expect(acceptedAgain.id).toBe(accepted.id);
    await expect(
      client.acceptedUpdateEvent.count({ where: { projectId: graph.projectId } }),
    ).resolves.toBe(1);
  });

  it("leaves no partial answer or draft when structuring fails and allows a safe retry", async () => {
    const graph = await seedGraph();
    let attempt = 0;
    const structurer = {
      structure: vi.fn(async (_input, persistValidatedOutput) => {
        const currentAttempt = attempt++;
        if (currentAttempt === 0 || currentAttempt === 2) {
          throw new Error("simulated provider failure");
        }
        const output =
          currentAttempt === 1
            ? question(["result"], "ما النتيجة القابلة للتحقق؟")
            : ({
                state: "ready_for_review",
                unresolvedFields: [],
                draft: {
                  summary: "اكتمل التحديث.",
                  result: "نجحت جميع حالات القبول.",
                  blocker: null,
                  nextAction: "إرفاق سجل الاعتماد.",
                  contributionContext: "نفذت التحقق وراجعت النتيجة.",
                  evidenceClaimDrafts: ["نجحت حالات القبول."],
                  documentationNeeds: [],
                  relatedProgressComponentIds: [],
                  comparisonExplanation: "أضيفت نتيجة قابلة للتحقق.",
                },
              } satisfies import("@evaluation/contracts").UpdateStructureAiOutput);
        await client.$transaction((transaction) => persistValidatedOutput(transaction, output));
        return output;
      }),
    };
    const service = new UpdateService(
      client,
      {
        authorizeIn: async () => ({
          organizationId: graph.organizationId,
          projectScopeId: graph.projectId,
          departmentScopeId: graph.departmentId,
          activeContract: null,
        }),
      },
      structurer,
      { append: async () => ({ id: crypto.randomUUID(), createdAt: now.toISOString() }) },
      () => now,
    );
    const idempotencyKey = crypto.randomUUID();
    const startCommand = {
      actor: { userId: graph.employeeId, active: true },
      correlationId: crypto.randomUUID(),
      input: {
        idempotencyKey,
        projectId: graph.projectId,
        workstreamId: graph.workstreamId,
        workItemId: graph.workItemId,
        rawText: "أنجزت العمل.",
        executionMode: "ai_assisted",
      },
    } as const;

    await expect(service.start(startCommand)).rejects.toThrow("simulated provider failure");
    const emptySession = await client.updateSource.findUniqueOrThrow({
      where: { idempotencyKey },
      include: {
        clarificationSession: {
          include: { turns: { include: { answer: true } }, draftRevisions: true },
        },
      },
    });
    expect(emptySession.clarificationSession).toMatchObject({
      state: "clarifying",
      version: 1,
      turns: [],
      draftRevisions: [],
    });

    const questionState = await service.start(startCommand);
    expect(questionState).toMatchObject({
      state: "draft_with_question",
      sessionVersion: 2,
      draft: { revision: 1 },
    });
    if (questionState.state !== "draft_with_question") {
      throw new Error("Expected a draft with clarification question");
    }
    const answerCommand = {
      actor: startCommand.actor,
      correlationId: crypto.randomUUID(),
      sessionId: emptySession.clarificationSession?.id ?? "",
      input: {
        expectedSessionVersion: questionState.sessionVersion,
        turnId: questionState.turnId,
        answer: "نجحت جميع حالات القبول.",
      },
    } as const;

    await expect(service.answer(answerCommand)).rejects.toThrow("simulated provider failure");
    const unchangedSession = await client.clarificationSession.findUniqueOrThrow({
      where: { id: answerCommand.sessionId },
      include: { turns: { include: { answer: true } }, draftRevisions: true },
    });
    expect(unchangedSession).toMatchObject({
      state: "clarifying",
      version: 2,
      draftRevisions: [expect.objectContaining({ revision: 1 })],
    });
    expect(unchangedSession.turns).toHaveLength(1);
    expect(unchangedSession.turns[0]?.answer).toBeNull();

    await expect(service.answer(answerCommand)).resolves.toMatchObject({
      state: "ready_for_review",
      sessionVersion: 3,
      draft: { revision: 2 },
    });
  });

  it("includes the previous accepted state when a later update starts", async () => {
    const graph = await seedGraph();
    const previous = await seedAcceptedUpdate(graph);
    let captured: import("./update-service.js").UpdateStructureContext | undefined;
    const service = new UpdateService(
      client,
      {
        authorizeIn: async () => ({
          organizationId: graph.organizationId,
          projectScopeId: graph.projectId,
          departmentScopeId: graph.departmentId,
          activeContract: null,
        }),
      },
      {
        structure: async (input, persistValidatedOutput) => {
          captured = input;
          const output = question(["result"], "ما التغيير منذ آخر تحديث؟");
          await client.$transaction((transaction) => persistValidatedOutput(transaction, output));
          return output;
        },
      },
      { append: async () => ({ id: crypto.randomUUID(), createdAt: now.toISOString() }) },
      () => now,
    );

    await service.start({
      actor: { userId: graph.employeeId, active: true },
      correlationId: crypto.randomUUID(),
      input: {
        idempotencyKey: crypto.randomUUID(),
        projectId: graph.projectId,
        workstreamId: graph.workstreamId,
        workItemId: graph.workItemId,
        rawText: "تحديث لاحق.",
        executionMode: "ai_assisted",
      },
    });

    expect(captured?.previousAcceptedState).toMatchObject({
      acceptedEventId: previous.eventId,
      summary: "التحديث السابق",
      result: "اكتملت المرحلة الأولى",
    });
  });
});

function question(
  unresolvedFields: Array<
    "result" | "progress_context" | "next_action" | "blocker" | "evidence" | "contribution"
  >,
  text: string,
): import("@evaluation/contracts").UpdateStructureAiOutput {
  return {
    state: "draft_with_question",
    unresolvedFields,
    draft: {
      summary: "مسودة التحديث.",
      result: "النتيجة تحتاج توضيحاً.",
      blocker: null,
      nextAction: "استكمال التحديث.",
      contributionContext: "مساهمة الموظف قيد المراجعة.",
      evidenceClaimDrafts: [],
      documentationNeeds: [],
      relatedProgressComponentIds: [],
      comparisonExplanation: "مسودة مقارنة أولية.",
    },
    nextQuestion: { question: text, affects: unresolvedFields.slice(0, 1) },
  };
}

async function sessionIdFor(idempotencyKey: string): Promise<string> {
  const source = await client.updateSource.findUniqueOrThrow({
    where: { idempotencyKey },
    include: { clarificationSession: true },
  });
  return source.clarificationSession?.id ?? "";
}

type Graph = {
  organizationId: string;
  departmentId: string;
  employeeId: string;
  projectId: string;
  workstreamId: string;
  workItemId: string;
  contractId: string;
  componentId: string;
};

async function seedGraph(): Promise<Graph> {
  const suffix = crypto.randomUUID();
  const organizationId = crypto.randomUUID();
  const departmentId = crypto.randomUUID();
  const employeeId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const workstreamId = crypto.randomUUID();
  const workItemId = crypto.randomUUID();
  const contractId = crypto.randomUUID();
  const componentId = crypto.randomUUID();
  await client.organization.create({
    data: { id: organizationId, key: `updates-org-${suffix}`, name: "Updates" },
  });
  await client.department.create({
    data: { id: departmentId, key: `updates-dept-${suffix}`, name: "Updates", organizationId },
  });
  await client.user.create({
    data: {
      id: employeeId,
      email: `updates-${suffix}@example.invalid`,
      displayName: "Employee",
    },
  });
  await client.authorizationScope.createMany({
    data: [
      {
        id: departmentId,
        key: `updates-department-${suffix}`,
        scopeType: "department",
        departmentId,
      },
      { id: projectId, key: `updates-project-${suffix}`, scopeType: "project", departmentId },
      {
        id: workstreamId,
        key: `updates-workstream-${suffix}`,
        scopeType: "workstream",
        departmentId,
      },
    ],
  });
  await client.project.create({
    data: {
      id: projectId,
      organizationId,
      departmentId,
      authorizationScopeId: projectId,
      name: "Update project",
      description: "",
      status: "active",
      createdById: employeeId,
    },
  });
  await client.workstream.create({
    data: {
      id: workstreamId,
      projectId,
      authorizationScopeId: workstreamId,
      name: "Update stream",
      description: "",
      status: "active",
      createdById: employeeId,
    },
  });
  await client.projectMember.create({
    data: {
      projectId,
      employeeId,
      startsAt: new Date("2026-07-01T00:00:00Z"),
      reason: "Contributor",
      createdById: employeeId,
    },
  });
  await client.workstreamMember.create({
    data: {
      workstreamId,
      employeeId,
      startsAt: new Date("2026-07-01T00:00:00Z"),
      reason: "Contributor",
      createdById: employeeId,
    },
  });
  await client.workItem.create({
    data: {
      id: workItemId,
      projectId,
      workstreamId,
      title: "Acceptance",
      description: "",
      status: "in_progress",
      priority: "high",
      assigneeId: employeeId,
      requirements: [],
      acceptanceConditions: [],
      createdById: employeeId,
    },
  });
  const template = await client.documentTemplate.create({
    data: {
      organizationId,
      scopeType: "organization",
      kind: "project",
      createdById: employeeId,
    },
  });
  const templateVersion = await client.documentTemplateVersion.create({
    data: {
      templateId: template.id,
      version: 1,
      status: "active",
      reason: "Approved project template",
      createdById: employeeId,
      activatedAt: now,
    },
  });
  const document = await client.documentRecord.create({
    data: {
      organizationId,
      departmentId,
      projectId,
      templateVersionId: templateVersion.id,
      currentVersion: 1,
      createdById: employeeId,
    },
  });
  const documentVersion = await client.documentVersion.create({
    data: {
      documentId: document.id,
      version: 1,
      templateVersionId: templateVersion.id,
      createdById: employeeId,
      reason: "Approved source",
    },
  });
  await client.progressContract.create({
    data: {
      id: contractId,
      scopeKind: "project",
      projectId,
      sourceDocumentId: document.id,
      sourceDocumentVersionId: documentVersion.id,
      sourceDocumentVersionNo: 1,
      calculationKind: "weighted",
      calculationSchemaVersion: "1.0.0",
      contractVersion: 3,
      state: "active",
      ownerId: employeeId,
      approverId: employeeId,
      effectiveAt: now,
      approvedAt: now,
      createdById: employeeId,
      components: {
        create: {
          id: componentId,
          position: 1,
          kind: "milestone",
          name: "Pilot accepted",
          description: "Accepted by the product owner",
          weight: 100,
          acceptanceConditions: ["Product owner confirms"],
          requiredEvidence: ["Acceptance record"],
          confirmationMode: "human_confirmed",
        },
      },
    },
  });
  return {
    organizationId,
    departmentId,
    employeeId,
    projectId,
    workstreamId,
    workItemId,
    contractId,
    componentId,
  };
}

async function seedAcceptedUpdate(graph: Graph) {
  const source = await client.updateSource.create({
    data: {
      idempotencyKey: crypto.randomUUID(),
      projectId: graph.projectId,
      workstreamId: graph.workstreamId,
      workItemId: graph.workItemId,
      employeeId: graph.employeeId,
      inputKind: "text",
      rawText: "التحديث السابق",
      executionMode: "manual",
    },
  });
  const session = await client.clarificationSession.create({
    data: {
      updateSourceId: source.id,
      state: "ready_for_review",
      unresolvedFields: [],
    },
  });
  const draft = await client.structuredUpdateDraftRevision.create({
    data: {
      updateSourceId: source.id,
      sessionId: session.id,
      revision: 1,
      revisionKind: "employee_edit",
      summary: "التحديث السابق",
      result: "اكتملت المرحلة الأولى",
      blocker: null,
      nextAction: "المرحلة الثانية",
      contributionContext: "تنفيذ مباشر",
      executionMode: "manual",
      sourceReferences: [`update-source:${source.id}:1`],
      evidenceClaimDrafts: [],
      comparison: {
        previousAcceptedEventId: null,
        changedFields: ["result"],
        explanation: "أول تحديث",
      },
      createdById: graph.employeeId,
    },
  });
  const confirmation = await client.updateConfirmation.create({
    data: {
      updateSourceId: source.id,
      draftRevisionId: draft.id,
      employeeId: graph.employeeId,
      reason: "Confirmed",
      confirmedAt: now,
    },
  });
  const event = await client.acceptedUpdateEvent.create({
    data: {
      confirmationId: confirmation.id,
      updateSourceId: source.id,
      projectId: graph.projectId,
      workstreamId: graph.workstreamId,
      workItemId: graph.workItemId,
      employeeId: graph.employeeId,
      sourceReferences: [`update-source:${source.id}:1`],
      occurredAt: now,
    },
  });
  return { eventId: event.id };
}
