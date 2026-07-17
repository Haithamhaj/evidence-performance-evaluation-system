import {
  AddMemberSchema,
  AppError,
  CreateProjectSchema,
  EndMembershipSchema,
  UpdateStatusSchema,
} from "@evaluation/contracts";
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
import { ProjectService } from "@evaluation/projects";
import { z } from "zod";

import { PROJECT_POLICY_ACTION, ProjectPolicyGuard } from "./project-policy-loaders.js";
import { ProjectsAuthenticationGuard } from "./projects-authentication.guard.js";

type ProjectRequest = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

export class ProjectsController {
  private readonly service: ProjectService;

  constructor(service: ProjectService) {
    this.service = service;
  }

  create(request: ProjectRequest, body: unknown) {
    return this.service.createProject({
      actor: actor(request),
      correlationId: request.correlationId,
      input: parseInput(CreateProjectSchema, body),
    });
  }

  list(request: ProjectRequest) {
    return this.service.listProjects({ actor: actor(request) });
  }

  get(request: ProjectRequest, projectId: string) {
    return this.service.getProject({ actor: actor(request), projectId: parseId(projectId) });
  }

  addMember(request: ProjectRequest, projectId: string, body: unknown) {
    return this.service.addProjectMember({
      actor: actor(request),
      correlationId: request.correlationId,
      projectId: parseId(projectId),
      input: parseInput(AddMemberSchema, body),
    });
  }

  endMember(request: ProjectRequest, projectId: string, userId: string, body: unknown) {
    return this.service.endProjectMember({
      actor: actor(request),
      correlationId: request.correlationId,
      projectId: parseId(projectId),
      userId: parseId(userId),
      input: parseInput(EndMembershipSchema, body),
    });
  }

  transition(request: ProjectRequest, projectId: string, body: unknown) {
    return this.service.transitionProject({
      actor: actor(request),
      correlationId: request.correlationId,
      projectId: parseId(projectId),
      input: parseInput(UpdateStatusSchema, body),
    });
  }
}

const ResourceIdSchema = z.string().uuid();

function parseId(value: unknown): string {
  return parseInput(ResourceIdSchema, value);
}

function actor(request: ProjectRequest) {
  return { userId: request.principal.userId, active: request.principal.active } as const;
}

function parseInput<T>(schema: { parse(value: unknown): T }, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      throw new AppError("PROJECT_INPUT_INVALID", "errors.projects.inputInvalid", 400);
    }
    throw error;
  }
}

Controller("api/v1/projects")(ProjectsController);
UseGuards(ProjectsAuthenticationGuard)(ProjectsController);
Inject(ProjectService)(ProjectsController, undefined, 0);

const createDescriptor = Object.getOwnPropertyDescriptor(ProjectsController.prototype, "create")!;
Req()(ProjectsController.prototype, "create", 0);
Body()(ProjectsController.prototype, "create", 1);
Post()(ProjectsController.prototype, "create", createDescriptor);
SetMetadata(PROJECT_POLICY_ACTION, "project.create")(
  ProjectsController.prototype,
  "create",
  createDescriptor,
);
UseGuards(ProjectPolicyGuard)(ProjectsController.prototype, "create", createDescriptor);

const listDescriptor = Object.getOwnPropertyDescriptor(ProjectsController.prototype, "list")!;
Req()(ProjectsController.prototype, "list", 0);
Get()(ProjectsController.prototype, "list", listDescriptor);

const getDescriptor = Object.getOwnPropertyDescriptor(ProjectsController.prototype, "get")!;
Req()(ProjectsController.prototype, "get", 0);
Param("projectId")(ProjectsController.prototype, "get", 1);
Get(":projectId")(ProjectsController.prototype, "get", getDescriptor);
SetMetadata(PROJECT_POLICY_ACTION, "resource.read")(
  ProjectsController.prototype,
  "get",
  getDescriptor,
);
UseGuards(ProjectPolicyGuard)(ProjectsController.prototype, "get", getDescriptor);

const addMemberDescriptor = Object.getOwnPropertyDescriptor(
  ProjectsController.prototype,
  "addMember",
)!;
Req()(ProjectsController.prototype, "addMember", 0);
Param("projectId")(ProjectsController.prototype, "addMember", 1);
Body()(ProjectsController.prototype, "addMember", 2);
Post(":projectId/members")(ProjectsController.prototype, "addMember", addMemberDescriptor);
SetMetadata(PROJECT_POLICY_ACTION, "project.manage")(
  ProjectsController.prototype,
  "addMember",
  addMemberDescriptor,
);
UseGuards(ProjectPolicyGuard)(ProjectsController.prototype, "addMember", addMemberDescriptor);

const endMemberDescriptor = Object.getOwnPropertyDescriptor(
  ProjectsController.prototype,
  "endMember",
)!;
Req()(ProjectsController.prototype, "endMember", 0);
Param("projectId")(ProjectsController.prototype, "endMember", 1);
Param("userId")(ProjectsController.prototype, "endMember", 2);
Body()(ProjectsController.prototype, "endMember", 3);
Post(":projectId/members/:userId/end")(
  ProjectsController.prototype,
  "endMember",
  endMemberDescriptor,
);
SetMetadata(PROJECT_POLICY_ACTION, "project.manage")(
  ProjectsController.prototype,
  "endMember",
  endMemberDescriptor,
);
UseGuards(ProjectPolicyGuard)(ProjectsController.prototype, "endMember", endMemberDescriptor);

const transitionDescriptor = Object.getOwnPropertyDescriptor(
  ProjectsController.prototype,
  "transition",
)!;
Req()(ProjectsController.prototype, "transition", 0);
Param("projectId")(ProjectsController.prototype, "transition", 1);
Body()(ProjectsController.prototype, "transition", 2);
Patch(":projectId/status")(ProjectsController.prototype, "transition", transitionDescriptor);
SetMetadata(PROJECT_POLICY_ACTION, "project.manage")(
  ProjectsController.prototype,
  "transition",
  transitionDescriptor,
);
UseGuards(ProjectPolicyGuard)(ProjectsController.prototype, "transition", transitionDescriptor);
