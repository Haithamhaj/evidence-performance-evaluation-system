import {
  ActivateCriteriaSchema,
  AppError,
  OwnerReviewCriteriaSchema,
  RespondToCriteriaSchema,
  ResolveCriteriaObjectionsSchema,
  ReviseCriteriaSchema,
} from "@evaluation/contracts";
import {
  ActivationService,
  CriteriaVersionResolver,
  ProposalService,
  RevisionService,
  WorkstreamReviewService,
} from "@evaluation/criteria";
import { isValidCorrelationId } from "@evaluation/observability";
import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { AnalysisCriteriaAuthenticationGuard } from "./analysis-criteria-authentication.guard.js";
import {
  AnalysisCriteriaPolicy,
  AnalysisCriteriaPolicyGuard,
} from "./analysis-criteria-policy.guard.js";

const UuidSchema = z.string().uuid();
const KindSchema = z.enum(["project", "workstream"]);
const IdempotencyKeySchema = z.string().trim().min(1).max(256);
const ReasonSchema = z.string().trim().min(1).max(1_000);
const OwnerReviewRouteSchema = OwnerReviewCriteriaSchema.refine(
  (review) => review.action !== "approve",
);
const ProposalRequestSchema = z
  .object({
    kind: KindSchema,
    resourceId: UuidSchema,
    documentVersionId: UuidSchema,
    idempotencyKey: IdempotencyKeySchema,
  })
  .strict();
const PublishSchema = z.object({ reason: ReasonSchema }).strict();
const RevisionRequestSchema = z
  .object({
    kind: KindSchema,
    resourceId: UuidSchema,
    idempotencyKey: IdempotencyKeySchema,
    comparisonReviewId: UuidSchema,
    reason: ReasonSchema,
  })
  .strict();
const ActiveQuerySchema = z
  .object({
    kind: KindSchema,
    resourceId: UuidSchema,
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .strict();

type AnalysisRequest = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId?: string;
}>;

export class CriteriaController {
  constructor(
    private readonly proposals: ProposalService,
    private readonly reviews: WorkstreamReviewService,
    private readonly activation: ActivationService,
    private readonly revisions: RevisionService,
    private readonly versions: CriteriaVersionResolver,
  ) {}

  createProposal(request: AnalysisRequest, body: unknown) {
    const input = parse(ProposalRequestSchema, body);
    return this.proposals.requestGeneration({
      actor: actor(request),
      correlationId: correlation(request),
      ...input,
    });
  }

  reviewByOwner(request: AnalysisRequest, proposalId: string, body: unknown) {
    return this.proposals.reviewByOwner({
      actor: actor(request),
      correlationId: correlation(request),
      proposalId: parse(UuidSchema, proposalId),
      review: parse(OwnerReviewRouteSchema, body),
    });
  }

  publish(request: AnalysisRequest, proposalId: string, body: unknown) {
    const input = parse(PublishSchema, body);
    return this.proposals.reviewByOwner({
      actor: actor(request),
      correlationId: correlation(request),
      proposalId: parse(UuidSchema, proposalId),
      review: { action: "approve", reason: input.reason },
    });
  }

  respond(request: AnalysisRequest, proposalId: string, body: unknown) {
    return this.reviews.respond({
      actor: actor(request),
      correlationId: correlation(request),
      proposalId: parse(UuidSchema, proposalId),
      response: parse(RespondToCriteriaSchema, body),
    });
  }

  resolveByManager(request: AnalysisRequest, proposalId: string, body: unknown) {
    return this.reviews.resolve({
      actor: actor(request),
      correlationId: correlation(request),
      proposalId: parse(UuidSchema, proposalId),
      resolution: parse(ResolveCriteriaObjectionsSchema, body),
    });
  }

  activate(request: AnalysisRequest, proposalId: string, body: unknown) {
    return this.activation.activate({
      actor: actor(request),
      correlationId: correlation(request),
      proposalId: parse(UuidSchema, proposalId),
      activation: parse(ActivateCriteriaSchema, body),
    });
  }

  revise(request: AnalysisRequest, body: unknown) {
    const input = parse(RevisionRequestSchema, body);
    return this.revisions.start({
      actor: actor(request),
      correlationId: correlation(request),
      kind: input.kind,
      resourceId: input.resourceId,
      idempotencyKey: input.idempotencyKey,
      revision: {
        comparisonReviewId: input.comparisonReviewId,
        reason: input.reason,
      },
    });
  }

  getActive(_request: AnalysisRequest, query: unknown) {
    const input = parse(ActiveQuerySchema, query);
    return this.versions.resolve({
      kind: input.kind,
      resourceId: input.resourceId,
      occurredAt: new Date(input.occurredAt),
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

Controller("api/v1/dynamic-criteria")(CriteriaController);
UseGuards(AnalysisCriteriaAuthenticationGuard)(CriteriaController);
Inject(ProposalService)(CriteriaController, undefined, 0);
Inject(WorkstreamReviewService)(CriteriaController, undefined, 1);
Inject(ActivationService)(CriteriaController, undefined, 2);
Inject(RevisionService)(CriteriaController, undefined, 3);
Inject(CriteriaVersionResolver)(CriteriaController, undefined, 4);

type RouteMethod =
  | "createProposal"
  | "reviewByOwner"
  | "publish"
  | "respond"
  | "resolveByManager"
  | "activate"
  | "revise"
  | "getActive";

function route(
  method: RouteMethod,
  path: string,
  action: import("./analysis-criteria-policy.guard.js").AnalysisCriteriaPolicyAction,
  verb: "get" | "post",
  parameters: readonly ("request" | "proposalId" | "body" | "query")[],
): void {
  const descriptor = Object.getOwnPropertyDescriptor(CriteriaController.prototype, method)!;
  parameters.forEach((parameter, index) => {
    if (parameter === "request") Req()(CriteriaController.prototype, method, index);
    if (parameter === "proposalId")
      Param("proposalId")(CriteriaController.prototype, method, index);
    if (parameter === "body") Body()(CriteriaController.prototype, method, index);
    if (parameter === "query") Query()(CriteriaController.prototype, method, index);
  });
  AnalysisCriteriaPolicy(action)(CriteriaController.prototype, method, descriptor);
  UseGuards(AnalysisCriteriaPolicyGuard)(CriteriaController.prototype, method, descriptor);
  if (verb === "get") Get(path)(CriteriaController.prototype, method, descriptor);
  else Post(path)(CriteriaController.prototype, method, descriptor);
}

route("createProposal", "proposals", "criteria.generate", "post", ["request", "body"]);
route("reviewByOwner", ":proposalId/owner-reviews", "criteria.owner.review", "post", [
  "request",
  "proposalId",
  "body",
]);
route("publish", ":proposalId/publish", "criteria.owner.review", "post", [
  "request",
  "proposalId",
  "body",
]);
route("respond", ":proposalId/responses", "criteria.contributor.respond", "post", [
  "request",
  "proposalId",
  "body",
]);
route("resolveByManager", ":proposalId/manager-resolutions", "criteria.manager.resolve", "post", [
  "request",
  "proposalId",
  "body",
]);
route("activate", ":proposalId/activate", "criteria.activate", "post", [
  "request",
  "proposalId",
  "body",
]);
route("revise", "revisions", "criteria.generate", "post", ["request", "body"]);
route("getActive", "active", "criteria.read", "get", ["request", "query"]);
