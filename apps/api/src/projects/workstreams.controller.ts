import {
  AddMemberSchema,
  AppError,
  CreateWorkstreamSchema,
  EndMembershipSchema,
  UpdateStatusSchema,
} from "@evaluation/contracts";
import { WorkstreamService } from "@evaluation/projects";
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
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

export class WorkstreamsController {
  private readonly service: WorkstreamService;

  constructor(service: WorkstreamService) {
    this.service = service;
  }

  create(request: ProjectRequest, projectId: string, body: unknown) {
    return this.service.createWorkstream({
      actor: actor(request),
      correlationId: request.correlationId,
      projectId: parseId(projectId),
      input: parseInput(CreateWorkstreamSchema, body),
    });
  }

  list(request: ProjectRequest, projectId: string) {
    return this.service.listWorkstreams({ actor: actor(request), projectId: parseId(projectId) });
  }

  get(request: ProjectRequest, projectId: string, workstreamId: string) {
    return this.service.getWorkstream({
      actor: actor(request),
      projectId: parseId(projectId),
      workstreamId: parseId(workstreamId),
    });
  }

  workspace(request: ProjectRequest, projectId: string, workstreamId: string) {
    return this.service.getWorkspace({
      actor: actor(request),
      projectId: parseId(projectId),
      workstreamId: parseId(workstreamId),
    });
  }

  addContributor(request: ProjectRequest, projectId: string, workstreamId: string, body: unknown) {
    return this.service.addContributor({
      actor: actor(request),
      correlationId: request.correlationId,
      projectId: parseId(projectId),
      workstreamId: parseId(workstreamId),
      input: parseInput(AddMemberSchema, body),
    });
  }

  endContributor(
    request: ProjectRequest,
    projectId: string,
    workstreamId: string,
    userId: string,
    body: unknown,
  ) {
    return this.service.endContributor({
      actor: actor(request),
      correlationId: request.correlationId,
      projectId: parseId(projectId),
      workstreamId: parseId(workstreamId),
      userId: parseId(userId),
      input: parseInput(EndMembershipSchema, body),
    });
  }

  transition(request: ProjectRequest, projectId: string, workstreamId: string, body: unknown) {
    return this.service.transitionWorkstream({
      actor: actor(request),
      correlationId: request.correlationId,
      projectId: parseId(projectId),
      workstreamId: parseId(workstreamId),
      input: parseInput(UpdateStatusSchema, body),
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

function parseInput<T>(schema: { parse(value: unknown): T }, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      throw new AppError("WORKSTREAM_INPUT_INVALID", "errors.workstreams.inputInvalid", 400);
    }
    throw error;
  }
}

Controller("api/v1/projects/:projectId/workstreams")(WorkstreamsController);
UseGuards(ProjectsAuthenticationGuard)(WorkstreamsController);
Inject(WorkstreamService)(WorkstreamsController, undefined, 0);

const createDescriptor = Object.getOwnPropertyDescriptor(
  WorkstreamsController.prototype,
  "create",
)!;
Req()(WorkstreamsController.prototype, "create", 0);
Param("projectId")(WorkstreamsController.prototype, "create", 1);
Body()(WorkstreamsController.prototype, "create", 2);
Post()(WorkstreamsController.prototype, "create", createDescriptor);
SetMetadata(PROJECT_POLICY_ACTION, "workstream.create")(
  WorkstreamsController.prototype,
  "create",
  createDescriptor,
);
UseGuards(ProjectPolicyGuard)(WorkstreamsController.prototype, "create", createDescriptor);

const listDescriptor = Object.getOwnPropertyDescriptor(WorkstreamsController.prototype, "list")!;
Req()(WorkstreamsController.prototype, "list", 0);
Param("projectId")(WorkstreamsController.prototype, "list", 1);
Get()(WorkstreamsController.prototype, "list", listDescriptor);

const getDescriptor = Object.getOwnPropertyDescriptor(WorkstreamsController.prototype, "get")!;
Req()(WorkstreamsController.prototype, "get", 0);
Param("projectId")(WorkstreamsController.prototype, "get", 1);
Param("workstreamId")(WorkstreamsController.prototype, "get", 2);
Get(":workstreamId")(WorkstreamsController.prototype, "get", getDescriptor);
SetMetadata(PROJECT_POLICY_ACTION, "resource.read")(
  WorkstreamsController.prototype,
  "get",
  getDescriptor,
);
UseGuards(ProjectPolicyGuard)(WorkstreamsController.prototype, "get", getDescriptor);

const workspaceDescriptor = Object.getOwnPropertyDescriptor(
  WorkstreamsController.prototype,
  "workspace",
)!;
Req()(WorkstreamsController.prototype, "workspace", 0);
Param("projectId")(WorkstreamsController.prototype, "workspace", 1);
Param("workstreamId")(WorkstreamsController.prototype, "workspace", 2);
Get(":workstreamId/workspace")(WorkstreamsController.prototype, "workspace", workspaceDescriptor);
SetMetadata(PROJECT_POLICY_ACTION, "resource.read")(
  WorkstreamsController.prototype,
  "workspace",
  workspaceDescriptor,
);
UseGuards(ProjectPolicyGuard)(WorkstreamsController.prototype, "workspace", workspaceDescriptor);

const addDescriptor = Object.getOwnPropertyDescriptor(
  WorkstreamsController.prototype,
  "addContributor",
)!;
Req()(WorkstreamsController.prototype, "addContributor", 0);
Param("projectId")(WorkstreamsController.prototype, "addContributor", 1);
Param("workstreamId")(WorkstreamsController.prototype, "addContributor", 2);
Body()(WorkstreamsController.prototype, "addContributor", 3);
Post(":workstreamId/contributors")(
  WorkstreamsController.prototype,
  "addContributor",
  addDescriptor,
);
SetMetadata(PROJECT_POLICY_ACTION, "workstream.participants.manage")(
  WorkstreamsController.prototype,
  "addContributor",
  addDescriptor,
);
UseGuards(ProjectPolicyGuard)(WorkstreamsController.prototype, "addContributor", addDescriptor);

const endDescriptor = Object.getOwnPropertyDescriptor(
  WorkstreamsController.prototype,
  "endContributor",
)!;
Req()(WorkstreamsController.prototype, "endContributor", 0);
Param("projectId")(WorkstreamsController.prototype, "endContributor", 1);
Param("workstreamId")(WorkstreamsController.prototype, "endContributor", 2);
Param("userId")(WorkstreamsController.prototype, "endContributor", 3);
Body()(WorkstreamsController.prototype, "endContributor", 4);
Post(":workstreamId/contributors/:userId/end")(
  WorkstreamsController.prototype,
  "endContributor",
  endDescriptor,
);
SetMetadata(PROJECT_POLICY_ACTION, "workstream.participants.manage")(
  WorkstreamsController.prototype,
  "endContributor",
  endDescriptor,
);
UseGuards(ProjectPolicyGuard)(WorkstreamsController.prototype, "endContributor", endDescriptor);

const transitionDescriptor = Object.getOwnPropertyDescriptor(
  WorkstreamsController.prototype,
  "transition",
)!;
Req()(WorkstreamsController.prototype, "transition", 0);
Param("projectId")(WorkstreamsController.prototype, "transition", 1);
Param("workstreamId")(WorkstreamsController.prototype, "transition", 2);
Body()(WorkstreamsController.prototype, "transition", 3);
Patch(":workstreamId/status")(WorkstreamsController.prototype, "transition", transitionDescriptor);
SetMetadata(PROJECT_POLICY_ACTION, "workstream.stage.close")(
  WorkstreamsController.prototype,
  "transition",
  transitionDescriptor,
);
UseGuards(ProjectPolicyGuard)(WorkstreamsController.prototype, "transition", transitionDescriptor);
