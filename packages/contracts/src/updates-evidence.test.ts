import { describe, expect, it } from "vitest";

import {
  AcceptedUpdateEventSchema,
  ClarificationAnswerInputSchema,
  ClarificationStateSchema,
  ConfirmEvidenceInputSchema,
  CreateManualEvidenceInputSchema,
  EvidenceDraftInputSchema,
  EvidenceReviewSchema,
  ReviseEvidenceInputSchema,
  ReviseUpdateDraftInputSchema,
  StartUpdateInputSchema,
  StartTextUpdateInputSchema,
  StructuredUpdateDraftSchema,
  TimelineItemSchema,
  UpdateComposerContextSchema,
  UpdateResultCardSchema,
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

  it("accepts one or more typed manual sources while keeping legacy text capture compatible", () => {
    const uploadedSourceId = crypto.randomUUID();
    const valid = {
      idempotencyKey: crypto.randomUUID(),
      projectId,
      workstreamId: null,
      workItemId: null,
      rawText: "مختصر التحديث من الموظف.",
      sources: [
        { kind: "pasted_code", text: "expect(result).toBe(true);" },
        { kind: "url", url: "https://example.invalid/acceptance" },
        { kind: "image", uploadedSourceId },
        { kind: "github_snapshot", text: "PR #42 merged after required checks passed." },
      ],
      executionMode: "ai_assisted",
    } as const;
    expect(StartUpdateInputSchema.parse(valid)).toEqual(valid);
    expect(StartUpdateInputSchema.parse({ ...valid, sources: undefined })).toMatchObject({
      rawText: valid.rawText,
    });
  });

  it.each([
    [{ kind: "url", url: "https://example.invalid", text: "ambiguous" }],
    [{ kind: "pasted_code", text: "" }],
    [{ kind: "file", uploadedSourceId: crypto.randomUUID(), url: "https://example.invalid" }],
  ])("rejects unsafe or ambiguous update-source representations", (sources) => {
    expect(() =>
      StartUpdateInputSchema.parse({
        idempotencyKey: crypto.randomUUID(),
        projectId,
        workstreamId: null,
        workItemId: null,
        rawText: "",
        sources,
        executionMode: "manual",
      }),
    ).toThrow();
  });

  it("rejects an Update without text or sources", () => {
    expect(() =>
      StartUpdateInputSchema.parse({
        idempotencyKey: crypto.randomUUID(),
        projectId,
        workstreamId: null,
        workItemId: null,
        rawText: "",
        sources: [],
        executionMode: "manual",
      }),
    ).toThrow();
  });

  it("versions clarification turns and returns exactly one question", () => {
    const sessionId = crypto.randomUUID();
    const draft = {
      id: crypto.randomUUID(),
      sessionId,
      revision: 1,
      summary: "مسودة أولية",
      result: "تم تنفيذ التغيير",
      blocker: null,
      nextAction: "تأكيد النتيجة",
      contributionContext: "نفذ الموظف التغيير",
      executionMode: "ai_assisted",
      sourceReferences: [`update-source:${sourceId}`],
      evidenceIds: [],
      documentationNeeds: [],
      relatedProgressComponentIds: [],
      comparison: {
        previousAcceptedEventId: null,
        changedFields: ["result"],
        explanation: "هذه أول حالة مقبولة.",
      },
    } as const;
    expect(
      ClarificationStateSchema.parse({
        state: "draft_with_question",
        sessionId,
        sessionVersion: 2,
        draft,
        turnId: crypto.randomUUID(),
        turnNumber: 2,
        question: "ما النتيجة القابلة للتحقق؟",
        affects: ["result", "evidence"],
        remainingFieldCount: 3,
      }),
    ).toMatchObject({
      state: "draft_with_question",
      sessionId,
      turnNumber: 2,
      remainingFieldCount: 3,
    });
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

  it("requires the AI question state to include an evolving draft", () => {
    expect(() =>
      UpdateStructureAiOutputSchema.parse({
        state: "draft_with_question",
        unresolvedFields: ["result"],
        nextQuestion: { question: "ما النتيجة؟", affects: ["result"] },
      }),
    ).toThrow();
    expect(
      UpdateStructureAiOutputSchema.parse({
        state: "draft_with_question",
        unresolvedFields: ["result"],
        nextQuestion: { question: "ما النتيجة؟", affects: ["result"] },
        draft: {
          summary: "مسودة أولية",
          result: "تم تنفيذ التغيير",
          blocker: null,
          nextAction: "تأكيد النتيجة",
          contributionContext: "نفذ الموظف التغيير",
          evidenceClaimDrafts: [],
          documentationNeeds: ["سجل القبول"],
          relatedProgressComponentIds: [],
          comparisonExplanation: "هذه أول حالة.",
        },
      }),
    ).toMatchObject({ state: "draft_with_question" });
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
      documentationNeeds: [],
      relatedProgressComponentIds: [],
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

  it("requires source review and Timeline items to carry readable scope and provenance", () => {
    const workstreamId = crypto.randomUUID();
    const componentId = crypto.randomUUID();
    const criterionId = crypto.randomUUID();
    const shared = {
      project: { id: projectId, name: "Atlas Delivery" },
      workstream: { id: workstreamId, name: "API readiness" },
      workItem: { id: workItemId, title: "Verify acceptance flow" },
      relatedKpiComponents: [{ id: componentId, name: "Acceptance completion" }],
      relatedCriteria: [{ id: criterionId, name: "Reliable delivery" }],
      verificationState: "unverified",
    } as const;

    expect(
      EvidenceReviewSchema.parse({
        id: crypto.randomUUID(),
        revisionId: crypto.randomUUID(),
        projectId,
        workstreamId,
        workItemId,
        state: "draft",
        revision: 1,
        revisionKind: "ai_draft",
        sourceKind: "url",
        sourceProvenance: "github_automated",
        sourceText: null,
        sourceUrl: "https://github.com/acme/atlas/pull/42",
        mediaType: null,
        supportedClaim: "Required checks passed.",
        contributionContext: "Implemented and reviewed the acceptance path.",
        executionMode: "ai_assisted",
        ...shared,
      }),
    ).toMatchObject({ sourceProvenance: "github_automated", ...shared });

    expect(
      TimelineItemSchema.parse({
        id: crypto.randomUUID(),
        kind: "evidence",
        projectId,
        workstreamId,
        workItemId,
        employeeId: crypto.randomUUID(),
        occurredAt: "2026-07-20T10:00:00.000Z",
        title: "Required checks passed.",
        detail: "Implemented and reviewed the acceptance path.",
        sourceReferences: [`evidence:${sourceId}`],
        sourceProvenance: "github_automated",
        reviewState: "employee_confirmed",
        ...shared,
      }),
    ).toMatchObject({ reviewState: "employee_confirmed", ...shared });
  });

  it("returns a readable confirmed result without employee-performance fields", () => {
    const acceptedEventId = crypto.randomUUID();
    const result = UpdateResultCardSchema.parse({
      acceptedEventId,
      project: { id: projectId, name: "Atlas Delivery" },
      workstream: null,
      workItem: { id: workItemId, title: "Verify acceptance flow" },
      summary: "اكتمل مسار القبول.",
      result: "نجحت 12 حالة من أصل 12.",
      sourceReferences: [`update-source:${sourceId}:1`],
      comparison: {
        previousAcceptedEventId: null,
        explanation: "هذه أول نتيجة مؤكدة.",
      },
      blocker: null,
      nextAction: "إرفاق سجل الاعتماد.",
      documentationNeeds: ["سجل اعتماد العميل."],
      progressImpact: {
        state: "insufficient_information",
        missing: ["سجل اعتماد العميل."],
      },
      confirmedAt: "2026-07-18T12:00:00.000Z",
    });
    expect(result).toMatchObject({
      acceptedEventId,
      project: { name: "Atlas Delivery" },
      progressImpact: { state: "insufficient_information" },
    });
    expect(() =>
      UpdateResultCardSchema.parse({
        ...result,
        suggestedRating: 5,
      }),
    ).toThrow();
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
