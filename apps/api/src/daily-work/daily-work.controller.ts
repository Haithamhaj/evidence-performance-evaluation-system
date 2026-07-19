import {
  AppError,
  ProgressContractDecisionInputSchema,
  ProgressContractDraftSchema,
} from "@evaluation/contracts";
import { ProgressContractService } from "@evaluation/projects";
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { WorkItemsPolicyGuard } from "../work-items/work-items-policy.guard.js";
import { DailyWorkQueryService } from "./daily-work-query.service.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

const ProposalBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(1_000),
    draft: ProgressContractDraftSchema,
  })
  .strict();

export class DailyWorkController {
  private readonly query: DailyWorkQueryService;

  constructor(query: DailyWorkQueryService) {
    this.query = query;
  }

  myWork(request: Request): Promise<import("@evaluation/contracts").MyWorkResponse> {
    return this.query.myWork(request.principal.userId);
  }

  updateContext(request: Request): Promise<import("@evaluation/contracts").UpdateComposerContext> {
    return this.query.updateContext(request.principal.userId);
  }

  projects(request: Request): Promise<unknown> {
    return this.query.projects(request.principal.userId);
  }

  project(request: Request, projectId: string): Promise<unknown> {
    return this.query.project(request.principal.userId, z.string().uuid().parse(projectId));
  }
}

export class ProgressContractsController {
  private readonly service: ProgressContractService;

  constructor(service: ProgressContractService) {
    this.service = service;
  }

  propose(request: Request, projectId: string, body: unknown) {
    const id = z.string().uuid().parse(projectId);
    const parsed = ProposalBodySchema.parse(body);
    if (parsed.draft.projectId !== id)
      throw new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
    return this.service.propose({
      actor: actor(request),
      correlationId: request.correlationId,
      reason: parsed.reason,
      draft: parsed.draft,
    });
  }

  submit(request: Request, projectId: string, contractId: string, body: unknown) {
    return this.decision("submit", request, projectId, contractId, body);
  }

  approve(request: Request, projectId: string, contractId: string, body: unknown) {
    return this.decision("approve", request, projectId, contractId, body);
  }

  reject(request: Request, projectId: string, contractId: string, body: unknown) {
    return this.decision("reject", request, projectId, contractId, body);
  }

  private decision(
    kind: "submit" | "approve" | "reject",
    request: Request,
    projectId: string,
    contractId: string,
    body: unknown,
  ) {
    const id = z.string().uuid().parse(projectId);
    const command = {
      actor: actor(request),
      correlationId: request.correlationId,
      projectId: id,
      contractId: z.string().uuid().parse(contractId),
      input: ProgressContractDecisionInputSchema.parse(body),
    };
    return kind === "submit"
      ? this.service.submitForApproval(command)
      : kind === "approve"
        ? this.service.approve(command)
        : this.service.reject(command);
  }
}

function actor(request: Request) {
  return { userId: request.principal.userId, active: request.principal.active };
}

Controller("api/v1/daily-work")(DailyWorkController);
UseGuards(WorkItemsPolicyGuard)(DailyWorkController);
Inject(DailyWorkQueryService)(DailyWorkController, undefined, 0);

const myWork = Object.getOwnPropertyDescriptor(DailyWorkController.prototype, "myWork")!;
Req()(DailyWorkController.prototype, "myWork", 0);
Get("my-work")(DailyWorkController.prototype, "myWork", myWork);

const updateContext = Object.getOwnPropertyDescriptor(
  DailyWorkController.prototype,
  "updateContext",
)!;
Req()(DailyWorkController.prototype, "updateContext", 0);
Get("update-context")(DailyWorkController.prototype, "updateContext", updateContext);

const projects = Object.getOwnPropertyDescriptor(DailyWorkController.prototype, "projects")!;
Req()(DailyWorkController.prototype, "projects", 0);
Get("projects")(DailyWorkController.prototype, "projects", projects);

const project = Object.getOwnPropertyDescriptor(DailyWorkController.prototype, "project")!;
Req()(DailyWorkController.prototype, "project", 0);
Param("projectId")(DailyWorkController.prototype, "project", 1);
Get("projects/:projectId")(DailyWorkController.prototype, "project", project);

Controller("api/v1/projects")(ProgressContractsController);
UseGuards(WorkItemsPolicyGuard)(ProgressContractsController);
Inject(ProgressContractService)(ProgressContractsController, undefined, 0);

for (const [method, path] of [
  ["propose", ":projectId/progress-contracts"],
  ["submit", ":projectId/progress-contracts/:contractId/submit"],
  ["approve", ":projectId/progress-contracts/:contractId/approve"],
  ["reject", ":projectId/progress-contracts/:contractId/reject"],
] as const) {
  const descriptor = Object.getOwnPropertyDescriptor(
    ProgressContractsController.prototype,
    method,
  )!;
  Req()(ProgressContractsController.prototype, method, 0);
  Param("projectId")(ProgressContractsController.prototype, method, 1);
  if (method !== "propose") Param("contractId")(ProgressContractsController.prototype, method, 2);
  Body()(ProgressContractsController.prototype, method, method === "propose" ? 2 : 3);
  Post(path)(ProgressContractsController.prototype, method, descriptor);
}
