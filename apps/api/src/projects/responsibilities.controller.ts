import { AppError, ResponsibilityAtSchema, TransferOwnershipSchema } from "@evaluation/contracts";
import { ResponsibilityService } from "@evaluation/projects";
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  SetMetadata,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";

import { PROJECT_POLICY_ACTION, ProjectPolicyGuard } from "./project-policy-loaders.js";
import { ProjectsAuthenticationGuard } from "./projects-authentication.guard.js";

type ProjectRequest = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

export class ResponsibilitiesController {
  private readonly service: ResponsibilityService;

  constructor(service: ResponsibilityService) {
    this.service = service;
  }

  transferProject(request: ProjectRequest, projectId: string, body: unknown) {
    return this.service.transferProjectOwner({
      actor: actor(request),
      correlationId: request.correlationId,
      projectId: parseId(projectId),
      input: parseInput(TransferOwnershipSchema, body),
    });
  }

  transferWorkstream(
    request: ProjectRequest,
    projectId: string,
    workstreamId: string,
    body: unknown,
  ) {
    return this.service.transferWorkstreamOwner({
      actor: actor(request),
      correlationId: request.correlationId,
      projectId: parseId(projectId),
      workstreamId: parseId(workstreamId),
      input: parseInput(TransferOwnershipSchema, body),
    });
  }

  projectAt(request: ProjectRequest, projectId: string, at: unknown) {
    return this.service.responsibilitiesAt({
      actor: actor(request),
      projectId: parseId(projectId),
      at: parseAt(at),
    });
  }

  projectHistory(request: ProjectRequest, projectId: string) {
    return this.service.responsibilityHistory({
      actor: actor(request),
      projectId: parseId(projectId),
    });
  }

  workstreamAt(request: ProjectRequest, projectId: string, workstreamId: string, at: unknown) {
    return this.service.workstreamResponsibilitiesAt({
      actor: actor(request),
      projectId: parseId(projectId),
      workstreamId: parseId(workstreamId),
      at: parseAt(at),
    });
  }

  workstreamHistory(request: ProjectRequest, projectId: string, workstreamId: string) {
    return this.service.workstreamResponsibilityHistory({
      actor: actor(request),
      projectId: parseId(projectId),
      workstreamId: parseId(workstreamId),
    });
  }
}

const ResourceIdSchema = z.string().uuid();

function actor(request: ProjectRequest) {
  return { userId: request.principal.userId, active: request.principal.active } as const;
}

function parseId(value: unknown): string {
  return parseInput(ResourceIdSchema, value);
}

function parseAt(value: unknown): string {
  return parseInput(ResponsibilityAtSchema, { at: value }).at;
}

function parseInput<T>(schema: { parse(value: unknown): T }, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      throw new AppError(
        "RESPONSIBILITY_INPUT_INVALID",
        "errors.responsibilities.inputInvalid",
        400,
      );
    }
    throw error;
  }
}

Controller("api/v1/projects/:projectId")(ResponsibilitiesController);
UseGuards(ProjectsAuthenticationGuard)(ResponsibilitiesController);
Inject(ResponsibilityService)(ResponsibilitiesController, undefined, 0);

function protect(
  method: keyof ResponsibilitiesController,
  descriptor: PropertyDescriptor,
  action: "responsibility.transfer" | "resource.read",
) {
  SetMetadata(PROJECT_POLICY_ACTION, action)(
    ResponsibilitiesController.prototype,
    method,
    descriptor,
  );
  UseGuards(ProjectPolicyGuard)(ResponsibilitiesController.prototype, method, descriptor);
}

const transferProjectDescriptor = Object.getOwnPropertyDescriptor(
  ResponsibilitiesController.prototype,
  "transferProject",
)!;
Req()(ResponsibilitiesController.prototype, "transferProject", 0);
Param("projectId")(ResponsibilitiesController.prototype, "transferProject", 1);
Body()(ResponsibilitiesController.prototype, "transferProject", 2);
Post("owner-transfers")(
  ResponsibilitiesController.prototype,
  "transferProject",
  transferProjectDescriptor,
);
protect("transferProject", transferProjectDescriptor, "responsibility.transfer");

const transferWorkstreamDescriptor = Object.getOwnPropertyDescriptor(
  ResponsibilitiesController.prototype,
  "transferWorkstream",
)!;
Req()(ResponsibilitiesController.prototype, "transferWorkstream", 0);
Param("projectId")(ResponsibilitiesController.prototype, "transferWorkstream", 1);
Param("workstreamId")(ResponsibilitiesController.prototype, "transferWorkstream", 2);
Body()(ResponsibilitiesController.prototype, "transferWorkstream", 3);
Post("workstreams/:workstreamId/owner-transfers")(
  ResponsibilitiesController.prototype,
  "transferWorkstream",
  transferWorkstreamDescriptor,
);
protect("transferWorkstream", transferWorkstreamDescriptor, "responsibility.transfer");

const projectAtDescriptor = Object.getOwnPropertyDescriptor(
  ResponsibilitiesController.prototype,
  "projectAt",
)!;
Req()(ResponsibilitiesController.prototype, "projectAt", 0);
Param("projectId")(ResponsibilitiesController.prototype, "projectAt", 1);
Query("at")(ResponsibilitiesController.prototype, "projectAt", 2);
Get("responsibilities")(ResponsibilitiesController.prototype, "projectAt", projectAtDescriptor);
protect("projectAt", projectAtDescriptor, "resource.read");

const projectHistoryDescriptor = Object.getOwnPropertyDescriptor(
  ResponsibilitiesController.prototype,
  "projectHistory",
)!;
Req()(ResponsibilitiesController.prototype, "projectHistory", 0);
Param("projectId")(ResponsibilitiesController.prototype, "projectHistory", 1);
Get("responsibilities/history")(
  ResponsibilitiesController.prototype,
  "projectHistory",
  projectHistoryDescriptor,
);
protect("projectHistory", projectHistoryDescriptor, "resource.read");

const workstreamAtDescriptor = Object.getOwnPropertyDescriptor(
  ResponsibilitiesController.prototype,
  "workstreamAt",
)!;
Req()(ResponsibilitiesController.prototype, "workstreamAt", 0);
Param("projectId")(ResponsibilitiesController.prototype, "workstreamAt", 1);
Param("workstreamId")(ResponsibilitiesController.prototype, "workstreamAt", 2);
Query("at")(ResponsibilitiesController.prototype, "workstreamAt", 3);
Get("workstreams/:workstreamId/responsibilities")(
  ResponsibilitiesController.prototype,
  "workstreamAt",
  workstreamAtDescriptor,
);
protect("workstreamAt", workstreamAtDescriptor, "resource.read");

const workstreamHistoryDescriptor = Object.getOwnPropertyDescriptor(
  ResponsibilitiesController.prototype,
  "workstreamHistory",
)!;
Req()(ResponsibilitiesController.prototype, "workstreamHistory", 0);
Param("projectId")(ResponsibilitiesController.prototype, "workstreamHistory", 1);
Param("workstreamId")(ResponsibilitiesController.prototype, "workstreamHistory", 2);
Get("workstreams/:workstreamId/responsibilities/history")(
  ResponsibilitiesController.prototype,
  "workstreamHistory",
  workstreamHistoryDescriptor,
);
protect("workstreamHistory", workstreamHistoryDescriptor, "resource.read");
