import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants.js";
import { describe, expect, it, vi } from "vitest";

import { AnalysisCriteriaAuthenticationGuard } from "./analysis-criteria-authentication.guard.js";
import { AnalysisCriteriaPolicyGuard } from "./analysis-criteria-policy.guard.js";
import { DocumentAnalysisController } from "./document-analysis.controller.js";

const actorId = "00000000-0000-4000-8000-000000000001";
const correlationId = "00000000-0000-4000-8000-000000000002";
const documentId = "00000000-0000-4000-8000-000000000003";
const beforeVersionId = "00000000-0000-4000-8000-000000000004";
const afterVersionId = "00000000-0000-4000-8000-000000000005";
const comparisonId = "00000000-0000-4000-8000-000000000006";

const request = {
  principal: {
    userId: actorId,
    oidcSubject: "employee",
    email: "employee@example.invalid",
    roles: ["employee"],
    active: true,
  },
  correlationId,
} as const;

function services() {
  return {
    readiness: {
      request: vi.fn(async (value: unknown) => value),
      getParticipantDetail: vi.fn(async (value: unknown) => value),
      getOperationalSummary: vi.fn(async () => ({
        state: "needs_attention",
        missingItems: ["must-not-leak"],
      })),
    },
    comparisons: {
      request: vi.fn(async (value: unknown) => value),
      review: vi.fn(async (value: unknown) => value),
    },
  };
}

describe("DocumentAnalysisController", () => {
  it("binds the actor and required correlation to strict readiness and comparison commands", async () => {
    const service = services();
    const controller = new DocumentAnalysisController(
      service.readiness as never,
      service.comparisons as never,
    );

    await controller.requestReadiness(request, documentId, {
      idempotencyKey: "readiness-v1",
    });
    expect(service.readiness.request).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      documentId,
      idempotencyKey: "readiness-v1",
    });

    await controller.requestComparison(request, documentId, {
      beforeDocumentVersionId: beforeVersionId,
      afterDocumentVersionId: afterVersionId,
      idempotencyKey: "comparison-v1",
    });
    expect(service.comparisons.request).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      documentId,
      beforeDocumentVersionId: beforeVersionId,
      afterDocumentVersionId: afterVersionId,
      idempotencyKey: "comparison-v1",
    });

    expect(() =>
      controller.requestReadiness(request, documentId, {
        idempotencyKey: "readiness-v1",
        unexpected: true,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "ANALYSIS_CRITERIA_INPUT_INVALID", status: 400 }),
    );
    expect(() =>
      controller.requestComparison(request, documentId, {
        beforeDocumentVersionId: beforeVersionId,
        afterDocumentVersionId: afterVersionId,
        idempotencyKey: "comparison-v1",
        unexpected: true,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "ANALYSIS_CRITERIA_INPUT_INVALID", status: 400 }),
    );
  });

  it("rejects missing correlation and invalid path identifiers before service selection", () => {
    const service = services();
    const controller = new DocumentAnalysisController(
      service.readiness as never,
      service.comparisons as never,
    );
    const withoutCorrelation = { ...request, correlationId: undefined };

    expect(() =>
      controller.requestReadiness(withoutCorrelation as never, documentId, {
        idempotencyKey: "readiness-v1",
      }),
    ).toThrowError(expect.objectContaining({ code: "CORRELATION_ID_REQUIRED", status: 400 }));
    expect(() => controller.getLatest(request, "not-a-uuid")).toThrowError(
      expect.objectContaining({ code: "ANALYSIS_CRITERIA_INPUT_INVALID", status: 400 }),
    );
    expect(service.readiness.request).not.toHaveBeenCalled();
    expect(service.readiness.getParticipantDetail).not.toHaveBeenCalled();
  });

  it("uses a fixed detail service for latest and projects manager state to exactly one field", async () => {
    const service = services();
    const controller = new DocumentAnalysisController(
      service.readiness as never,
      service.comparisons as never,
    );

    await controller.getLatest(request, documentId);
    expect(service.readiness.getParticipantDetail).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      documentId,
    });
    expect(service.readiness.getOperationalSummary).not.toHaveBeenCalled();

    const result = await controller.getOperationalState(request, documentId);
    expect(result).toEqual({ state: "needs_attention" });
    expect(Object.keys(result)).toEqual(["state"]);
    expect(service.readiness.getOperationalSummary).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      documentId,
    });
  });

  it("strictly parses append-only material classification reviews", async () => {
    const service = services();
    const controller = new DocumentAnalysisController(
      service.readiness as never,
      service.comparisons as never,
    );
    const review = { action: "confirm", reason: "Source comparison is accurate" } as const;

    await controller.reviewComparison(request, documentId, comparisonId, review);
    expect(service.comparisons.review).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      comparisonId,
      review,
    });
    expect(() =>
      controller.reviewComparison(request, documentId, comparisonId, {
        ...review,
        classification: "editorial",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "ANALYSIS_CRITERIA_INPUT_INVALID", status: 400 }),
    );
    expect(service.comparisons.review).toHaveBeenCalledTimes(1);
  });

  it("declares all five exact routes with authentication and a method policy guard", () => {
    expect(Reflect.getMetadata(PATH_METADATA, DocumentAnalysisController)).toBe(
      "api/v1/documents/:documentId",
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, DocumentAnalysisController)).toEqual([
      AnalysisCriteriaAuthenticationGuard,
    ]);

    const routes = [
      ["requestReadiness", 1, "readiness-checks"],
      ["getLatest", 0, "readiness-checks/latest"],
      ["getOperationalState", 0, "readiness-checks/latest/operational-state"],
      ["requestComparison", 1, "comparisons"],
      ["reviewComparison", 1, "comparisons/:comparisonId/reviews"],
    ] as const;
    for (const [method, verb, path] of routes) {
      expect(
        Reflect.getMetadata(METHOD_METADATA, DocumentAnalysisController.prototype[method]),
      ).toBe(verb);
      expect(Reflect.getMetadata(PATH_METADATA, DocumentAnalysisController.prototype[method])).toBe(
        path,
      );
      expect(
        Reflect.getMetadata(GUARDS_METADATA, DocumentAnalysisController.prototype[method]),
      ).toEqual([AnalysisCriteriaPolicyGuard]);
    }
  });
});
