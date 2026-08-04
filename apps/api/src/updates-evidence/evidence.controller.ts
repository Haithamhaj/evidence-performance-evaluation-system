import {
  ConfirmEvidenceInputSchema,
  CreateGitHubEvidenceInputSchema,
  CreateManualEvidenceInputSchema,
  RejectEvidenceInputSchema,
  ReviseEvidenceInputSchema,
} from "@evaluation/contracts";
import { ActivityReader, EvidenceService } from "@evaluation/updates-evidence";
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { UpdatesEvidencePolicyGuard } from "./updates-evidence-policy.guard.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

export class EvidenceController {
  private readonly service: EvidenceService;
  private readonly query: ActivityReader;

  constructor(service: EvidenceService, query: ActivityReader) {
    this.service = service;
    this.query = query;
  }

  create(request: Request, body: unknown) {
    return this.service.create({
      actor: actor(request),
      correlationId: request.correlationId,
      input: CreateManualEvidenceInputSchema.parse(body),
    });
  }

  createFromGitHubSuggestion(request: Request, body: unknown) {
    return this.service.createFromGitHubSuggestion({
      actor: actor(request),
      correlationId: request.correlationId,
      input: CreateGitHubEvidenceInputSchema.parse(body),
    });
  }

  review(request: Request, evidenceId: string) {
    return this.query.evidenceReview({
      actorId: request.principal.userId,
      evidenceId: z.string().uuid().parse(evidenceId),
    });
  }

  revise(request: Request, evidenceId: string, body: unknown) {
    return this.service.revise({
      actor: actor(request),
      correlationId: request.correlationId,
      evidenceId: z.string().uuid().parse(evidenceId),
      input: ReviseEvidenceInputSchema.parse(body),
    });
  }

  confirm(request: Request, evidenceId: string, body: unknown) {
    return this.service.confirm({
      actor: actor(request),
      correlationId: request.correlationId,
      evidenceId: z.string().uuid().parse(evidenceId),
      input: ConfirmEvidenceInputSchema.parse(body),
    });
  }

  reject(request: Request, evidenceId: string, body: unknown) {
    return this.service.reject({
      actor: actor(request),
      correlationId: request.correlationId,
      evidenceId: z.string().uuid().parse(evidenceId),
      input: RejectEvidenceInputSchema.parse(body),
    });
  }
}

function actor(request: Request) {
  return { userId: request.principal.userId, active: request.principal.active };
}

Controller("api/v1/evidence")(EvidenceController);
UseGuards(UpdatesEvidencePolicyGuard)(EvidenceController);
Inject(EvidenceService)(EvidenceController, undefined, 0);
Inject(ActivityReader)(EvidenceController, undefined, 1);

for (const [method, verb, path] of [
  ["create", "post", ""],
  ["createFromGitHubSuggestion", "post", "github-suggestions"],
  ["review", "get", ":evidenceId"],
  ["revise", "post", ":evidenceId/revisions"],
  ["confirm", "post", ":evidenceId/confirm"],
  ["reject", "post", ":evidenceId/reject"],
] as const) {
  const descriptor = Object.getOwnPropertyDescriptor(EvidenceController.prototype, method)!;
  Req()(EvidenceController.prototype, method, 0);
  if (!["create", "createFromGitHubSuggestion"].includes(method)) {
    Param("evidenceId")(EvidenceController.prototype, method, 1);
  }
  if (method !== "review") {
    Body()(
      EvidenceController.prototype,
      method,
      ["create", "createFromGitHubSuggestion"].includes(method) ? 1 : 2,
    );
  }
  (verb === "get" ? Get(path) : Post(path))(EvidenceController.prototype, method, descriptor);
}
