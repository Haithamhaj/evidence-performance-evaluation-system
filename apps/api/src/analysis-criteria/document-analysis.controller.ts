import {
  AppError,
  ManagerReadinessSummarySchema,
  ReviewMaterialClassificationSchema,
} from "@evaluation/contracts";
import { ComparisonService, ReadinessService } from "@evaluation/documents";
import { isValidCorrelationId } from "@evaluation/observability";
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { AnalysisCriteriaAuthenticationGuard } from "./analysis-criteria-authentication.guard.js";
import {
  AnalysisCriteriaPolicy,
  AnalysisCriteriaPolicyGuard,
} from "./analysis-criteria-policy.guard.js";

const UuidSchema = z.string().uuid();
const IdempotencyKeySchema = z.string().trim().min(1).max(256);
const ReadinessRequestSchema = z.object({ idempotencyKey: IdempotencyKeySchema }).strict();
const ComparisonRequestSchema = z
  .object({
    beforeDocumentVersionId: UuidSchema,
    afterDocumentVersionId: UuidSchema,
    idempotencyKey: IdempotencyKeySchema,
  })
  .strict()
  .refine((value) => value.beforeDocumentVersionId !== value.afterDocumentVersionId);

type AnalysisRequest = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId?: string;
}>;

export class DocumentAnalysisController {
  private readonly readiness: ReadinessService;
  private readonly comparisons: ComparisonService;

  constructor(readiness: ReadinessService, comparisons: ComparisonService) {
    this.readiness = readiness;
    this.comparisons = comparisons;
  }

  requestReadiness(request: AnalysisRequest, documentId: string, body: unknown) {
    const input = parse(ReadinessRequestSchema, body);
    return this.readiness.request({
      actor: actor(request),
      correlationId: correlation(request),
      documentId: parse(UuidSchema, documentId),
      idempotencyKey: input.idempotencyKey,
    });
  }

  getLatest(request: AnalysisRequest, documentId: string) {
    return this.readiness.getParticipantDetail({
      actor: actor(request),
      documentId: parse(UuidSchema, documentId),
    });
  }

  async getOperationalState(request: AnalysisRequest, documentId: string) {
    const summary = await this.readiness.getOperationalSummary({
      actor: actor(request),
      documentId: parse(UuidSchema, documentId),
    });
    return ManagerReadinessSummarySchema.parse({ state: summary.state });
  }

  requestComparison(request: AnalysisRequest, documentId: string, body: unknown) {
    const input = parse(ComparisonRequestSchema, body);
    return this.comparisons.request({
      actor: actor(request),
      correlationId: correlation(request),
      documentId: parse(UuidSchema, documentId),
      beforeDocumentVersionId: input.beforeDocumentVersionId,
      afterDocumentVersionId: input.afterDocumentVersionId,
      idempotencyKey: input.idempotencyKey,
    });
  }

  reviewComparison(
    request: AnalysisRequest,
    documentId: string,
    comparisonId: string,
    body: unknown,
  ) {
    parse(UuidSchema, documentId);
    return this.comparisons.review({
      actor: actor(request),
      correlationId: correlation(request),
      comparisonId: parse(UuidSchema, comparisonId),
      review: parse(ReviewMaterialClassificationSchema, body),
    });
  }
}

function actor(request: AnalysisRequest) {
  return { userId: request.principal.userId, active: request.principal.active } as const;
}

function correlation(request: AnalysisRequest): string {
  if (!isValidCorrelationId(request.correlationId)) {
    throw new AppError("CORRELATION_ID_REQUIRED", "errors.correlation.required", 400);
  }
  return request.correlationId;
}

function parse<T>(schema: { parse(value: unknown): T }, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      throw new AppError(
        "ANALYSIS_CRITERIA_INPUT_INVALID",
        "errors.analysisCriteria.inputInvalid",
        400,
      );
    }
    throw error;
  }
}

Controller("api/v1/documents/:documentId")(DocumentAnalysisController);
UseGuards(AnalysisCriteriaAuthenticationGuard)(DocumentAnalysisController);
Inject(ReadinessService)(DocumentAnalysisController, undefined, 0);
Inject(ComparisonService)(DocumentAnalysisController, undefined, 1);

function route(
  method: keyof Pick<
    DocumentAnalysisController,
    | "requestReadiness"
    | "getLatest"
    | "getOperationalState"
    | "requestComparison"
    | "reviewComparison"
  >,
  path: string,
  action: import("./analysis-criteria-policy.guard.js").AnalysisCriteriaPolicyAction,
  verb: "get" | "post",
  parameters: readonly ("request" | "documentId" | "comparisonId" | "body")[],
): void {
  const descriptor = Object.getOwnPropertyDescriptor(DocumentAnalysisController.prototype, method)!;
  parameters.forEach((parameter, index) => {
    if (parameter === "request") Req()(DocumentAnalysisController.prototype, method, index);
    if (parameter === "documentId")
      Param("documentId")(DocumentAnalysisController.prototype, method, index);
    if (parameter === "comparisonId")
      Param("comparisonId")(DocumentAnalysisController.prototype, method, index);
    if (parameter === "body") Body()(DocumentAnalysisController.prototype, method, index);
  });
  AnalysisCriteriaPolicy(action)(DocumentAnalysisController.prototype, method, descriptor);
  UseGuards(AnalysisCriteriaPolicyGuard)(DocumentAnalysisController.prototype, method, descriptor);
  if (verb === "get") Get(path)(DocumentAnalysisController.prototype, method, descriptor);
  else Post(path)(DocumentAnalysisController.prototype, method, descriptor);
}

route(
  "requestReadiness",
  "readiness-checks",
  "document.analysis.run",
  "post",
  ["request", "documentId", "body"],
);
route("getLatest", "readiness-checks/latest", "document.readiness.detail.read", "get", [
  "request",
  "documentId",
]);
route(
  "getOperationalState",
  "readiness-checks/latest/operational-state",
  "document.readiness.summary.read",
  "get",
  ["request", "documentId"],
);
route("requestComparison", "comparisons", "document.analysis.run", "post", [
  "request",
  "documentId",
  "body",
]);
route(
  "reviewComparison",
  "comparisons/:comparisonId/reviews",
  "document.comparison.review",
  "post",
  ["request", "documentId", "comparisonId", "body"],
);
