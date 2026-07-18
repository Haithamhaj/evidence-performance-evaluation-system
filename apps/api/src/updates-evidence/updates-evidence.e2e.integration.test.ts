import { describe, expect, it, vi } from "vitest";

import { EvidenceController } from "./evidence.controller.js";
import { TimelineController, UpdatesController } from "./updates.controller.js";

const actorId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const workstreamId = crypto.randomUUID();
const workItemId = crypto.randomUUID();
const sessionId = crypto.randomUUID();
const evidenceId = crypto.randomUUID();
const correlationId = crypto.randomUUID();
const request = {
  principal: { userId: actorId, active: true },
  correlationId,
} as never;

describe("updates and evidence protected API contracts", () => {
  it("starts an update using only the authenticated identity", async () => {
    const start = vi.fn(async () => ({ state: "question" }));
    const controller = new UpdatesController({ start } as never, {} as never);
    const body = {
      idempotencyKey: crypto.randomUUID(),
      projectId,
      workstreamId,
      workItemId,
      rawText: "أنجزت مسار القبول.",
      executionMode: "ai_assisted",
    };

    await controller.start(request, body);

    expect(start).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      input: body,
    });
  });

  it.each(["actorId", "provider", "model", "rating", "productivityScore"])(
    "rejects forbidden update field %s before service execution",
    (field) => {
      const start = vi.fn();
      const controller = new UpdatesController({ start } as never, {} as never);
      expect(() =>
        controller.start(request, {
          idempotencyKey: crypto.randomUUID(),
          projectId,
          workstreamId,
          workItemId,
          rawText: "تحديث.",
          executionMode: "ai_assisted",
          [field]: field === "rating" ? 5 : "forbidden",
        }),
      ).toThrow();
      expect(start).not.toHaveBeenCalled();
    },
  );

  it("binds clarification and confirmation to the route session", async () => {
    const answer = vi.fn(async () => ({ state: "ready_for_review" }));
    const confirm = vi.fn(async () => ({ id: crypto.randomUUID() }));
    const controller = new UpdatesController({ answer, confirm } as never, {} as never);

    await controller.answer(request, sessionId, {
      expectedSessionVersion: 2,
      turnId: crypto.randomUUID(),
      answer: "نجحت 12 حالة.",
    });
    await controller.confirm(request, sessionId, {
      expectedDraftRevision: 2,
      reason: "راجعت التحديث وأكدته.",
    });

    expect(answer).toHaveBeenCalledWith(expect.objectContaining({ sessionId }));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ sessionId }));
  });

  it("creates manual evidence without accepting raw storage paths or actor overrides", async () => {
    const create = vi.fn(async () => ({ id: evidenceId }));
    const controller = new EvidenceController({ create } as never, {} as never);
    const body = {
      idempotencyKey: crypto.randomUUID(),
      projectId,
      workstreamId,
      workItemId,
      capturedFromWorkItem: true,
      updateSourceId: null,
      source: { kind: "pasted_text", text: "12 tests passed" },
      supportedClaim: "نجحت اختبارات القبول.",
      relatedKpiComponentId: null,
      relatedCriterionId: null,
      contributionContext: "نفذت الاختبارات وراجعت النتائج.",
      executionMode: "manual",
    };

    await controller.create(request, body);
    expect(create).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      input: body,
    });

    for (const field of ["actorId", "objectKey", "sourcePath", "provider", "suggestedRating"]) {
      expect(() => controller.create(request, { ...body, [field]: "forbidden" })).toThrow();
    }
  });

  it("binds evidence review, edit, confirmation, and rejection to one route identity", async () => {
    const query = { evidenceReview: vi.fn(async () => ({ id: evidenceId })) };
    const service = {
      revise: vi.fn(async () => ({ id: evidenceId })),
      confirm: vi.fn(async () => ({ id: evidenceId })),
      reject: vi.fn(async () => ({ id: evidenceId })),
    };
    const controller = new EvidenceController(service as never, query as never);

    await controller.review(request, evidenceId);
    await controller.revise(request, evidenceId, {
      expectedRevision: 1,
      supportedClaim: "نجحت اختبارات القبول بعد مراجعة الموظف.",
      contributionContext: "نفذت الاختبارات وتحققت من السجل.",
    });
    await controller.confirm(request, evidenceId, {
      expectedRevision: 2,
      reason: "راجعت الدليل وأكدته.",
    });
    await controller.reject(request, evidenceId, {
      expectedRevision: 2,
      reason: "هذا الدليل لا يدعم الادعاء.",
    });

    expect(query.evidenceReview).toHaveBeenCalledWith({ actorId, evidenceId });
    expect(service.revise).toHaveBeenCalledWith(expect.objectContaining({ evidenceId }));
    expect(service.confirm).toHaveBeenCalledWith(expect.objectContaining({ evidenceId }));
    expect(service.reject).toHaveBeenCalledWith(expect.objectContaining({ evidenceId }));
  });

  it("paginates Timeline for the authenticated viewer and rejects unknown query fields", async () => {
    const timeline = vi.fn(async () => ({ items: [], nextCursor: null }));
    const controller = new TimelineController({ timeline } as never);

    await controller.list(request, {
      projectId,
      workstreamId,
      limit: "20",
      cursor: undefined,
    });
    expect(timeline).toHaveBeenCalledWith({
      actorId,
      projectId,
      workstreamId,
      limit: 20,
      cursor: null,
    });
    expect(() =>
      controller.list(request, {
        projectId,
        workstreamId,
        limit: "20",
        actorId,
      }),
    ).toThrow();
  });
});
