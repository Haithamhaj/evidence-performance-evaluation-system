import { describe, expect, it } from "vitest";

import {
  AcceptedUpdateEventSchema,
  ClarificationAnswerInputSchema,
  ClarificationStateSchema,
  ConfirmEvidenceInputSchema,
  CreateManualEvidenceInputSchema,
  EvidenceDraftInputSchema,
  ReviseEvidenceInputSchema,
  ReviseUpdateDraftInputSchema,
  StartTextUpdateInputSchema,
  StructuredUpdateDraftSchema,
  UpdateComposerContextSchema,
  UpdateStructureAiOutputSchema,
} from "./updates-evidence.js";

const projectId = crypto.randomUUID();
const workItemId = crypto.randomUUID();
const sourceId = crypto.randomUUID();

describe("updates and evidence contracts", () => {
  it("describes Project-required Update scope with optional Workstream and Work Item choices", () => {
    const workstreamId = crypto.randomUUID();
    expect(
      UpdateComposerContextSchema.parse({
        projects: [
          {
            id: projectId,
            name: "Atlas Delivery",
            workstreams: [{ id: workstreamId, name: "API readiness" }],
            workItems: [
              {
                id: workItemId,
                title: "Verify acceptance flow",
                workstreamId,
              },
            ],
          },
        ],
      }),
    ).toMatchObject({
      projects: [{ id: projectId, workstreams: [{ id: workstreamId }] }],
    });
  });

  it("requires a Project while keeping Work Item and approved rule links conditional", () => {
    const valid = {
      idempotencyKey: crypto.randomUUID(),
      projectId,
      workstreamId: null,
      workItemId: null,
      rawText: "أنجزت مسار المراجعة وأحتاج توثيق نتيجة الاختبار.",
      executionMode: "ai_assisted",
    } as const;
    expect(StartTextUpdateInputSchema.parse(valid)).toEqual(valid);
    expect(() =>
      StartTextUpdateInputSchema.parse({
        ...valid,
        projectId: undefined,
      }),
    ).toThrow();
  });

  it("versions clarification turns and returns exactly one question", () => {
    const sessionId = crypto.randomUUID();
    expect(
      ClarificationStateSchema.parse({
        state: "question",
        sessionId,
        sessionVersion: 2,
        turnId: crypto.randomUUID(),
        turnNumber: 2,
        question: "ما النتيجة القابلة للتحقق؟",
        affects: ["result", "evidence"],
        remainingFieldCount: 3,
      }),
    ).toMatchObject({ state: "question", sessionId, turnNumber: 2, remainingFieldCount: 3 });
    expect(() =>
      ClarificationStateSchema.parse({
        state: "question",
        sessionId,
        sessionVersion: 2,
        questions: ["سؤال 1", "سؤال 2"],
      }),
    ).toThrow();
    expect(() =>
      ClarificationStateSchema.parse({
        state: "ready_for_review",
        sessionVersion: 3,
        draftRevisionId: crypto.randomUUID(),
        draftRevision: 1,
      }),
    ).toThrow();
    expect(
      ClarificationAnswerInputSchema.parse({
        expectedSessionVersion: 2,
        turnId: crypto.randomUUID(),
        answer: "نجحت 12 حالة من أصل 12.",
      }),
    ).toMatchObject({ expectedSessionVersion: 2 });
  });

  it("requires source revision, supported claim, contribution context and execution mode", () => {
    expect(
      EvidenceDraftInputSchema.parse({
        sourceId,
        sourceRevision: 1,
        sourceKind: "cli_snapshot",
        supportedClaim: "نجحت اختبارات القبول المتفق عليها.",
        projectId,
        workstreamId: null,
        workItemId,
        relatedKpiComponentId: null,
        relatedCriterionId: null,
        contributionContext: "نفذت السيناريوهات وراجعت النتيجة مع مالك المنتج.",
        executionMode: "mixed",
      }),
    ).toMatchObject({ sourceId, sourceRevision: 1, workItemId });
    expect(
      CreateManualEvidenceInputSchema.parse({
        idempotencyKey: crypto.randomUUID(),
        projectId,
        workstreamId: null,
        workItemId,
        capturedFromWorkItem: true,
        updateSourceId: null,
        source: { kind: "pasted_code", text: "expect(result).toBe(true);" },
        supportedClaim: "نجح سيناريو القبول.",
        relatedKpiComponentId: null,
        relatedCriterionId: null,
        contributionContext: "نفذت السيناريو وراجعت الناتج.",
        executionMode: "manual",
      }),
    ).toMatchObject({ capturedFromWorkItem: true, workItemId });
    expect(
      ReviseEvidenceInputSchema.parse({
        expectedRevision: 1,
        supportedClaim: "راجعت المطالبة.",
        contributionContext: "مساهمة مباشرة.",
      }),
    ).toMatchObject({ expectedRevision: 1 });
    expect(
      ConfirmEvidenceInputSchema.parse({
        expectedRevision: 2,
        reason: "أكد الموظف الدليل.",
      }),
    ).toMatchObject({ expectedRevision: 2 });
  });

  it("keeps editable drafts distinct from employee-confirmed accepted events", () => {
    expect(
      ReviseUpdateDraftInputSchema.parse({
        expectedDraftRevision: 1,
        summary: "راجع الموظف الملخص.",
        result: "نجحت السيناريوهات المتفق عليها.",
        blocker: null,
        nextAction: "إرفاق سجل الاعتماد.",
        contributionContext: "نفذت الاختبارات وراجعت النتيجة.",
        evidenceClaimDrafts: ["نجحت اختبارات القبول."],
      }),
    ).toMatchObject({ expectedDraftRevision: 1 });

    const draft = StructuredUpdateDraftSchema.parse({
      id: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      revision: 2,
      summary: "اكتمل مسار القبول.",
      result: "نجحت السيناريوهات المتفق عليها.",
      blocker: null,
      nextAction: "إرفاق سجل الاعتماد.",
      contributionContext: "نفذت الاختبارات ونسقت المراجعة.",
      executionMode: "ai_assisted",
      sourceReferences: [`update-source:${sourceId}:1`],
      evidenceIds: [],
      comparison: {
        previousAcceptedEventId: null,
        changedFields: ["result"],
        explanation: "أضيفت نتيجة قابلة للتحقق.",
      },
    });
    expect(draft.revision).toBe(2);

    expect(
      AcceptedUpdateEventSchema.parse({
        id: crypto.randomUUID(),
        updateSourceId: sourceId,
        draftRevisionId: draft.id,
        projectId,
        workstreamId: null,
        workItemId,
        employeeId: crypto.randomUUID(),
        confirmedAt: "2026-07-18T12:00:00.000Z",
        sourceReferences: draft.sourceReferences,
      }),
    ).toMatchObject({ updateSourceId: sourceId, workItemId });
  });

  it.each(["suggestedRating", "rank", "productivityScore", "readinessScore"])(
    "rejects prohibited AI output field %s",
    (field) => {
      expect(() =>
        UpdateStructureAiOutputSchema.parse({
          state: "ready_for_review",
          unresolvedFields: [],
          draft: {
            summary: "تحديث موثق",
            result: "اكتملت النتيجة",
            blocker: null,
            nextAction: "تأكيد الدليل",
            contributionContext: "مساهمة مباشرة",
            evidenceClaimDrafts: [],
            comparisonExplanation: "تغيرت النتيجة.",
          },
          [field]: 4,
        }),
      ).toThrow();
    },
  );
});
